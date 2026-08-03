"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HostSitePresence } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {

  SETUP_SERVICE_FEE_USD,
} from "@/lib/hosting";
import { parseSitePublishState } from "@/lib/host-site";

function parseSitePresence(raw: string): HostSitePresence {
  if (raw === "CUSTOM" || raw === "BOTH" || raw === "STAYLOCAL") return raw;
  return "STAYLOCAL";
}

/** Optional social / free-text field: trim, empty → null. */
function optionalText(formData: FormData, key: string, max = 500): string | null {
  const t = String(formData.get(key) || "").trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeWebsiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export async function registerHost(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim();
  const slugRaw = String(formData.get("slug") || displayName);
  const tagline = String(formData.get("tagline") || "").trim() || null;
  const websiteUrl = normalizeWebsiteUrl(
    String(formData.get("websiteUrl") || ""),
  );
  const slug = slugify(slugRaw);

  if (!name || !email || !password || !displayName || !slug) {
    return { error: "Please fill in all required fields." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with that email already exists." };
  }

  const existingHost = await prisma.host.findUnique({ where: { slug } });
  if (existingHost) {
    return { error: "That site slug is already taken. Try another." };
  }

  const passwordHash = await hash(password, 10);

  const planId = String(formData.get("planId") || "").trim() || null;
  const hostingModeRaw = String(formData.get("hostingMode") || "PLATFORM");
  const hostingMode =
    hostingModeRaw === "SELF" ? ("SELF" as const) : ("PLATFORM" as const);

  // Marketplace is optional for both paid and free self-host
  const listOnMarketplace = formData.get("listOnMarketplace") === "1";

  const sitePresenceRaw = String(formData.get("sitePresence") || "");
  const sitePresence: HostSitePresence =
    hostingMode === "SELF"
      ? "CUSTOM"
      : parseSitePresence(sitePresenceRaw || "STAYLOCAL");

  if (
    (sitePresence === "CUSTOM" || sitePresence === "BOTH" || hostingMode === "SELF") &&
    !websiteUrl
  ) {
    // Soft: allow missing URL at apply time; host fills later
  }

  let resolvedPlanId = planId;
  if (hostingMode === "PLATFORM" && !resolvedPlanId) {
    const defaultPlan = await prisma.hostingPlan.findFirst({
      where: { isActive: true, isDefault: true },
    });
    resolvedPlanId = defaultPlan?.id ?? null;
    if (!resolvedPlanId) {
      const anyPlan = await prisma.hostingPlan.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });
      resolvedPlanId = anyPlan?.id ?? null;
    }
  }

  const wantsSetup = formData.get("setupService") === "1";

  await prisma.$transaction(async (tx) => {
    const host = await tx.host.create({
      data: {
        slug,
        name: displayName,
        tagline,
        websiteUrl,
        sitePresence,
        listOnMarketplace,
        contactEmail: email,
        billingEmail: email,
        active: true,
        hostingMode,
        approvalStatus: "PENDING_REVIEW",
        subscriptionStatus: "NONE",
        planId: hostingMode === "PLATFORM" ? resolvedPlanId : null,
        setupServiceStatus: wantsSetup ? "REQUESTED" : "NONE",
        setupServiceAmount: SETUP_SERVICE_FEE_USD,
        setupServiceNotes: wantsSetup
          ? "Host requested full setup at signup (listings, brand, website)."
          : null,
      },
    });

    await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "HOST",
        hostId: host.id,
      },
    });
  });

  revalidatePath("/hosts");
  revalidatePath("/marketplace");
  revalidatePath("/for-hosts");
  revalidatePath("/self-host");
  revalidatePath("/ops/hosting");
  return { ok: true as const };
}

const HOST_PROFILE_PATH = "/admin";

export async function updateHostProfile(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) redirect(`/login?callbackUrl=${HOST_PROFILE_PATH}`);

  const hostId = String(formData.get("hostId") || "");
  if (!hostId) redirect(`${HOST_PROFILE_PATH}?error=missing`);
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect(`${HOST_PROFILE_PATH}?error=forbidden`);
  }

  const existing = await prisma.host.findUnique({ where: { id: hostId } });
  if (!existing) redirect(`${HOST_PROFILE_PATH}?error=missing`);

  const name = String(formData.get("name") || "").trim();
  const tagline = String(formData.get("tagline") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const websiteUrl = normalizeWebsiteUrl(
    String(formData.get("websiteUrl") || ""),
  );
  const logoUrlRaw = String(formData.get("logoUrl") || "").trim();
  // Only http(s) or same-origin relative paths — block javascript:/data: spoof
  const logoUrl =
    !logoUrlRaw
      ? null
      : logoUrlRaw.startsWith("/") && !logoUrlRaw.startsWith("//")
        ? logoUrlRaw
        : /^https?:\/\//i.test(logoUrlRaw)
          ? logoUrlRaw
          : null;
  const primaryColorRaw = String(
    formData.get("primaryColor") || existing.primaryColor || "#2563eb",
  ).trim();
  const primaryColor = /^#[0-9A-Fa-f]{3,8}$/.test(primaryColorRaw)
    ? primaryColorRaw
    : existing.primaryColor || "#2563eb";
  const contactEmail =
    String(formData.get("contactEmail") || "").trim() || null;
  const contactPhone =
    String(formData.get("contactPhone") || "").trim() || null;
  const defaultDisclaimer =
    String(formData.get("defaultDisclaimer") || "").trim() || null;
  const active = formData.get("active") === "on";
  const returnTo = String(formData.get("returnTo") || "").trim();

  // Platform admins can change hosting mode; hosts cannot
  let hostingMode = existing.hostingMode;
  if (access.isPlatform && formData.has("hostingMode")) {
    const raw = String(formData.get("hostingMode") || "");
    hostingMode = raw === "SELF" ? "SELF" : "PLATFORM";
  }

  const isSelf = hostingMode === "SELF";

  let sitePresence = parseSitePresence(
    String(formData.get("sitePresence") || existing.sitePresence),
  );
  if (isSelf) {
    sitePresence = "CUSTOM";
  }

  const listOnMarketplace = formData.get("listOnMarketplace") === "on";

  // Fixed hosted-site pages (toggle only — not a freeform CMS)
  const sitePageAbout = formData.get("sitePageAbout") === "on";
  const sitePageServices = formData.get("sitePageServices") === "on";
  const siteAddress = optionalText(formData, "siteAddress", 500);
  const siteServicesTitle = optionalText(formData, "siteServicesTitle", 120);
  const siteServicesBody = optionalText(formData, "siteServicesBody", 8000);
  const socialFacebook = optionalText(formData, "socialFacebook", 300);
  const socialX = optionalText(formData, "socialX", 300);
  const socialInstagram = optionalText(formData, "socialInstagram", 300);
  const socialTiktok = optionalText(formData, "socialTiktok", 300);

  // Publish lifecycle: UNPUBLISHED (private) → DEMO (shareable) → LIVE (domain)
  const sitePublishState = parseSitePublishState(
    String(formData.get("sitePublishState") || existing.sitePublishState),
  );

  if (!name) redirect(`${HOST_PROFILE_PATH}?error=name`);

  // Domain required when LIVE with custom domain / self-host.
  // DEMO / UNPUBLISHED may use /h/[slug] without a domain yet.
  if (
    sitePublishState === "LIVE" &&
    (sitePresence === "CUSTOM" || sitePresence === "BOTH" || isSelf) &&
    !websiteUrl
  ) {
    redirect(`${HOST_PROFILE_PATH}?error=website`);
  }

  const host = await prisma.host.update({
    where: { id: hostId },
    data: {
      name,
      tagline,
      description,
      websiteUrl,
      logoUrl,
      primaryColor,
      contactEmail,
      contactPhone,
      defaultDisclaimer,
      sitePresence,
      listOnMarketplace,
      siteAddress,
      sitePageAbout,
      sitePageServices,
      siteServicesTitle,
      siteServicesBody,
      socialFacebook,
      socialX,
      socialInstagram,
      socialTiktok,
      sitePublishState,
      ...(access.isPlatform
        ? {
            active,
            hostingMode,
            ...(hostingMode === "SELF"
              ? { planId: null, subscriptionStatus: "NONE" as const }
              : {}),
          }
        : {}),
    },
  });

  // When host opts out of marketplace, unpublish properties from marketplace too
  if (!listOnMarketplace) {
    await prisma.property.updateMany({
      where: { hostId: host.id },
      data: { listOnMarketplace: false },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/brand");
  revalidatePath("/ops/hosting");
  revalidatePath(`/h/${host.slug}`);
  revalidatePath(`/h/${host.slug}/about`);
  revalidatePath(`/h/${host.slug}/contact`);
  revalidatePath(`/h/${host.slug}/stays`);
  revalidatePath(`/h/${host.slug}/services`);
  revalidatePath("/marketplace");
  revalidatePath("/hosts");
  revalidatePath("/self-host");
  const safeReturn =
    returnTo.startsWith("/admin") || returnTo.startsWith("/ops")
      ? returnTo
      : HOST_PROFILE_PATH;
  redirect(`${safeReturn}${safeReturn.includes("?") ? "&" : "?"}saved=1`);
}

/**
 * Issue or rotate the host syndication API key.
 * Used by free self-host / open-source installs to push listings into the
 * central marketplace without a paid hosting subscription.
 */
export async function rotateSyndicationApiKey(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const hostId = String(formData.get("hostId") || "");
  if (!hostId) redirect("/admin/brand?error=missing");
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/brand?error=forbidden");
  }

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) redirect("/admin/brand?error=missing");

  const { generateSyndicationApiKey } = await import("@/lib/syndication");
  const key = generateSyndicationApiKey();
  await prisma.host.update({
    where: { id: hostId },
    data: { syndicationApiKey: key },
  });

  revalidatePath("/admin/brand");
  revalidatePath(`/ops/hosting/${hostId}`);
  // Return key via query once (shown on brand page)
  const returnTo = String(formData.get("returnTo") || "/admin/brand").trim();
  const base =
    returnTo.startsWith("/admin") || returnTo.startsWith("/ops")
      ? returnTo.split("?")[0]
      : "/admin/brand";
  const qs = new URLSearchParams();
  if (access.isPlatform) qs.set("hostId", hostId);
  qs.set("synKey", key);
  redirect(`${base}?${qs.toString()}`);
}
