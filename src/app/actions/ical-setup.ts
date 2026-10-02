"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseIcalEvents } from "@/lib/ical";
import {
  extractIcalUrlsFromText,
  guessIcalSourceName,
  isOwnYcbExportUrl,
  looksLikeOtaListingPage,
  parseLlmUrlJson,
} from "@/lib/ical-setup";
import {
  canUseIcalSetupAgent,
  isIcalSetupAgentEnabled,
} from "@/lib/platform-features";
import { assertPropertyAccess, ensureHostAccess } from "@/lib/scope";
import { assertSafeOutboundUrl, fetchSafeOutbound } from "@/lib/safe-url";
import { pricingLlmChat, pricingLlmConfigured } from "@/lib/pricing-intelligence/llm";

const MAX_PASTE = 12_000;
const MAX_ICS_BYTES = 2_000_000;
const MAX_CANDIDATES = 3;

export type IcalFeedPreview = {
  url: string;
  sourceName: string;
  eventCount: number;
  sample: string[];
};

export type PreviewIcalPasteResult =
  | {
      ok: true;
      candidates: IcalFeedPreview[];
      usedLlm: boolean;
    }
  | { ok: false; error: string };

export type ConnectIcalFeedResult =
  | {
      ok: true;
      connectionId: string;
      name: string;
      eventCount: number;
    }
  | { ok: false; error: string };

async function hostAllowsIcalAgent(access: {
  hostId: string | null;
  isPlatform: boolean;
}): Promise<boolean> {
  if (!isIcalSetupAgentEnabled()) return false;
  if (access.isPlatform && !access.hostId) return true;
  if (!access.hostId) return false;
  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    select: { hostingMode: true },
  });
  return canUseIcalSetupAgent(host);
}

async function extractUrlsWithLlm(paste: string): Promise<string[]> {
  if (!pricingLlmConfigured()) return [];
  const res = await pricingLlmChat({
    system: `You extract iCalendar (.ics) feed URLs from messy host-pasted text.
Return JSON only: {"urls":["https://..."]}.
Include only calendar feed URLs (path contains ical, icalendar, or ends with .ics).
Exclude listing pages such as airbnb.com/rooms/ and vrbo.com/p123.
If none, return {"urls":[]}.`,
    user: paste.slice(0, MAX_PASTE),
    temperature: 0,
    maxTokens: 400,
  });
  if (!res.ok) return [];
  return parseLlmUrlJson(res.text);
}

async function probeIcalFeed(
  rawUrl: string,
  propertyId: string,
): Promise<IcalFeedPreview | { error: string; url: string }> {
  if (isOwnYcbExportUrl(rawUrl, propertyId)) {
    return {
      url: rawUrl,
      error:
        "That's this listing's export URL. Paste Airbnb or VRBO's calendar link instead.",
    };
  }
  if (looksLikeOtaListingPage(rawUrl)) {
    return {
      url: rawUrl,
      error:
        "That's a public listing page, not a calendar feed. In Airbnb or VRBO host settings, copy Export calendar / the .ics link.",
    };
  }

  let url: URL;
  try {
    url = await assertSafeOutboundUrl(rawUrl);
  } catch (e) {
    return {
      url: rawUrl,
      error: e instanceof Error ? e.message : "That URL is not allowed",
    };
  }

  try {
    const res = await fetchSafeOutbound(url.toString(), {
      headers: { "User-Agent": "Yall Come Back-iCal-Sync/1.0" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        url: url.toString(),
        error: `That calendar returned HTTP ${res.status}`,
      };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_ICS_BYTES) {
      return {
        url: url.toString(),
        error: "That calendar file is too large",
      };
    }
    const ics = new TextDecoder("utf-8").decode(buf);
    if (!/BEGIN:VCALENDAR/i.test(ics)) {
      return {
        url: url.toString(),
        error:
          "That URL is not an iCal feed. Copy Export calendar / the .ics link from Airbnb or VRBO host settings — not the public listing page.",
      };
    }
    const events = parseIcalEvents(ics);
    return {
      url: url.toString(),
      sourceName: guessIcalSourceName(url.toString()),
      eventCount: events.length,
      sample: events
        .slice(0, 3)
        .map((e) => e.summary || "Busy")
        .filter(Boolean),
    };
  } catch (e) {
    return {
      url: url.toString(),
      error:
        e instanceof Error ? e.message : "Could not read that calendar",
    };
  }
}

export async function previewIcalPaste(
  formData: FormData,
): Promise<PreviewIcalPasteResult> {
  try {
    const access = await ensureHostAccess();
    const propertyId = String(formData.get("propertyId") || "").trim();
    await assertPropertyAccess(propertyId, access);
    const paste = String(formData.get("paste") || "").trim();
    if (!paste) {
      return {
        ok: false,
        error: "Paste an .ics calendar URL, or the page text that contains it.",
      };
    }
    if (paste.length > MAX_PASTE) {
      return { ok: false, error: "That paste is too long." };
    }

    let urls = extractIcalUrlsFromText(paste);
    let usedLlm = false;
    if (urls.length === 0 && (await hostAllowsIcalAgent(access))) {
      urls = await extractUrlsWithLlm(paste);
      usedLlm = urls.length > 0;
    }

    if (urls.length === 0) {
      if (looksLikeOtaListingPage(paste) || /airbnb\.com\/rooms/i.test(paste)) {
        return {
          ok: false,
          error:
            "That's a listing page. We cannot log into Airbnb or VRBO. Open host Calendar → Availability → Export calendar and paste the .ics link.",
        };
      }
      return {
        ok: false,
        error:
          "No calendar link found. Copy the Export calendar / .ics URL from Airbnb or VRBO host settings.",
      };
    }

    const candidates: IcalFeedPreview[] = [];
    const errors: string[] = [];
    for (const url of urls.slice(0, MAX_CANDIDATES)) {
      const probed = await probeIcalFeed(url, propertyId);
      if ("error" in probed) {
        errors.push(probed.error);
        continue;
      }
      candidates.push(probed);
    }

    if (candidates.length === 0) {
      return {
        ok: false,
        error: errors[0] || "Could not read that calendar feed.",
      };
    }

    return { ok: true, candidates, usedLlm };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not read that paste.",
    };
  }
}

export async function connectIcalFeed(
  formData: FormData,
): Promise<ConnectIcalFeedResult> {
  try {
    const access = await ensureHostAccess();
    const propertyId = String(formData.get("propertyId") || "").trim();
    await assertPropertyAccess(propertyId, access);
    const importUrlRaw = String(formData.get("importUrl") || "").trim();
    const nameRaw = String(formData.get("name") || "").trim();
    if (!importUrlRaw) {
      return { ok: false, error: "Missing calendar URL." };
    }
    if (isOwnYcbExportUrl(importUrlRaw, propertyId)) {
      return {
        ok: false,
        error:
          "That's this listing's export URL. Paste Airbnb or VRBO's calendar link instead.",
      };
    }

    const importUrl = (await assertSafeOutboundUrl(importUrlRaw)).toString();
    const name = nameRaw || guessIcalSourceName(importUrl);

    const existing = await prisma.icalConnection.findFirst({
      where: { propertyId, importUrl },
    });
    const connection =
      existing ??
      (await prisma.icalConnection.create({
        data: {
          propertyId,
          name,
          importUrl,
          enabled: true,
        },
      }));

    if (existing && nameRaw && existing.name !== name) {
      await prisma.icalConnection.update({
        where: { id: existing.id },
        data: { name },
      });
    }

    const { syncIcalConnection } = await import("@/lib/ical");
    const sync = await syncIcalConnection(connection.id);
    revalidatePath("/admin");
    revalidatePath("/admin/calendar");
    revalidatePath(`/admin/properties/${propertyId}`);
    if (!sync.ok) {
      return {
        ok: false,
        error: `Saved the connection, but sync failed: ${sync.error}. Use Sync now.`,
      };
    }
    return {
      ok: true,
      connectionId: connection.id,
      name,
      eventCount: sync.count,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not connect that calendar.",
    };
  }
}
