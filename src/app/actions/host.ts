"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HostSitePresence } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireHostAdmin, signIn } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { hashPassword } from "@/lib/password";
import { incomingIp, rateLimitAllow } from "@/lib/rate-limit";
import { sendSignupVerificationEmail } from "@/lib/account-email";
import {
  readUploadedImage,
  writePublicUpload,
} from "@/lib/upload-image";
import {
  SETUP_SERVICE_FEE_USD,
  applyMarketplaceOptIn,
  planSlugForSitePresence,
} from "@/lib/hosting";
import { parseSitePublishState } from "@/lib/host-site";
import { normalizeCustomDomain } from "@/lib/custom-domains";
import {
  FIRST_LISTING_PATH,
  destAfterHostAuth,
  hostRecordName,
  signupNeedsBrandFields,
  uniqueHostSlug,
} from "@/lib/host-signup";

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

  const ip = await incomingIp();
  if (!rateLimitAllow(`host-register:ip:${ip}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many sign-ups from this network. Try again later." };
  }
  if (formData.get("acceptTerms") !== "on") {
    return {
      error: "You must agree to the Terms of Service and Privacy Policy.",
    };
  }
  if (!name || !email || !password) {
    return { error: "Please fill in all required fields." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return {
      error:
        existingUser.role === "GUEST"
          ? "You already have an account. Sign in, then choose Start hosting."
          : "An account with that email already exists. Sign in to open Host admin.",
    };
  }

  const passwordHash = await hashPassword(password);

  const hostingModeRaw = String(formData.get("hostingMode") || "PLATFORM");
  const hostingMode =
    hostingModeRaw === "SELF" ? ("SELF" as const) : ("PLATFORM" as const);

  const opted = applyMarketplaceOptIn(
    hostingMode,
    hostingMode === "SELF"
      ? "CUSTOM"
      : parseSitePresence(String(formData.get("sitePresence") || "STAYLOCAL")),
    formData.get("listOnMarketplace") === "1",
  );
  const sitePresence = opted.sitePresence;
  const listOnMarketplace = opted.listOnMarketplace;
  const needsBrand = signupNeedsBrandFields({ hostingMode, sitePresence });
  const displayName = hostRecordName({
    personalName: name,
    brandName: String(formData.get("displayName") || ""),
    needsBrand,
  });
  if (!displayName) {
    return {
      error: needsBrand
        ? "Add a brand or business name for your website."
        : "Please fill in all required fields.",
    };
  }
  const tagline = needsBrand
    ? String(formData.get("tagline") || "").trim() || null
    : null;
  const websiteUrl = needsBrand
    ? normalizeWebsiteUrl(String(formData.get("websiteUrl") || ""))
    : null;
  const slugRaw = needsBrand
    ? String(formData.get("slug") || displayName).trim()
    : displayName;
  if (needsBrand && !slugify(slugRaw)) {
    return { error: "Add a URL name for your website." };
  }
  const slug = await uniqueHostSlug(slugRaw);

  if (
    (sitePresence === "CUSTOM" || sitePresence === "BOTH" || hostingMode === "SELF") &&
    !websiteUrl
  ) {
    // Soft: allow missing URL at apply time; host fills later
  }

  let resolvedPlanId: string | null = null;
  if (hostingMode === "PLATFORM") {
    const wantSlug = planSlugForSitePresence(sitePresence);
    const matched = await prisma.hostingPlan.findFirst({
      where: { slug: wantSlug, isActive: true, monthlyPrice: { gt: 0 } },
    });
    resolvedPlanId = matched?.id ?? null;
    if (!resolvedPlanId) {
      const fallback = await prisma.hostingPlan.findFirst({
        where: { isActive: true, monthlyPrice: { gt: 0 } },
        orderBy: { sortOrder: "asc" },
      });
      resolvedPlanId = fallback?.id ?? null;
    }
  }

  const wantsSetup = formData.get("setupService") === "1";

  let userId = "";
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
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
        approvalNotes: "Self-serve. Hosting goes live after payment.",
        subscriptionStatus:
          hostingMode === "PLATFORM" ? "PENDING_PAYMENT" : "NONE",
        planId: hostingMode === "PLATFORM" ? resolvedPlanId : null,
        setupServiceStatus: wantsSetup ? "REQUESTED" : "NONE",
        setupServiceAmount: SETUP_SERVICE_FEE_USD,
        setupServiceNotes: wantsSetup
          ? "Host requested full setup at signup (listings, brand, website)."
          : null,
      },
    });

    const created = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "HOST",
        hostId: host.id,
        hostAccess: "OWNER",
      },
    });
    userId = created.id;
  });

  revalidatePath("/hosts");
  revalidatePath("/marketplace");
  revalidatePath("/for-hosts");
  revalidatePath("/self-host");
  revalidatePath("/ops/hosting");

  try {
    await sendSignupVerificationEmail({
      userId,
      email,
      name,
      kind: "host",
    });
  } catch (err) {
    console.error("[auth] host signup email failed", err);
  }

  await signIn("credentials", {
    email,
    password,
    redirectTo: FIRST_LISTING_PATH,
  });
  return {
    error:
      "Could not sign you in automatically. Use Sign in with the same email and password.",
  };
}

/**
 * Signed-in guest becomes a host on this same account. No ops approval —
 * they add a card under Account → Subscription to go live.
 */
export async function startHosting(formData: FormData) {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/for-hosts");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login?callbackUrl=/for-hosts");
  if (user.role === "ADMIN") redirect("/ops/hosting");
  if (user.role === "HOST" && user.hostId) {
    redirect(
      await destAfterHostAuth({
        role: user.role,
        hostId: user.hostId,
      }),
    );
  }

  if (formData.get("acceptTerms") !== "on") {
    return { error: "You must agree to the Terms of Service and Privacy Policy." };
  }

  const hostingModeRaw = String(formData.get("hostingMode") || "PLATFORM");
  const hostingMode =
    hostingModeRaw === "SELF" ? ("SELF" as const) : ("PLATFORM" as const);
  const opted = applyMarketplaceOptIn(
    hostingMode,
    hostingMode === "SELF"
      ? "CUSTOM"
      : parseSitePresence(String(formData.get("sitePresence") || "STAYLOCAL")),
    formData.get("listOnMarketplace") === "1",
  );
  const sitePresence = opted.sitePresence;
  const listOnMarketplace = opted.listOnMarketplace;
  const needsBrand = signupNeedsBrandFields({ hostingMode, sitePresence });
  const displayName = hostRecordName({
    personalName: user.name || user.email.split("@")[0] || "",
    brandName: String(formData.get("displayName") || ""),
    needsBrand,
  });
  if (!displayName) {
    return {
      error: needsBrand
        ? "Add a brand or business name for your website."
        : "Add your name on this account first.",
    };
  }
  const tagline = needsBrand
    ? String(formData.get("tagline") || "").trim() || null
    : null;
  const websiteUrl = needsBrand
    ? normalizeWebsiteUrl(String(formData.get("websiteUrl") || ""))
    : null;
  const slugRaw = needsBrand
    ? String(formData.get("slug") || displayName).trim()
    : displayName;
  if (needsBrand && !slugify(slugRaw)) {
    return { error: "Add a URL name for your website." };
  }
  const slug = await uniqueHostSlug(slugRaw);
  const wantsSetup = formData.get("setupService") === "1";

  let resolvedPlanId: string | null = null;
  if (hostingMode === "PLATFORM") {
    const wantSlug = planSlugForSitePresence(sitePresence);
    const matched = await prisma.hostingPlan.findFirst({
      where: { slug: wantSlug, isActive: true, monthlyPrice: { gt: 0 } },
    });
    resolvedPlanId = matched?.id ?? null;
    if (!resolvedPlanId) {
      const fallback = await prisma.hostingPlan.findFirst({
        where: { isActive: true, monthlyPrice: { gt: 0 } },
        orderBy: { sortOrder: "asc" },
      });
      resolvedPlanId = fallback?.id ?? null;
    }
  }

  const email = user.email;
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
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
        approvalNotes: "Self-serve. Hosting goes live after payment.",
        subscriptionStatus:
          hostingMode === "PLATFORM" ? "PENDING_PAYMENT" : "NONE",
        planId: hostingMode === "PLATFORM" ? resolvedPlanId : null,
        setupServiceStatus: wantsSetup ? "REQUESTED" : "NONE",
        setupServiceAmount: SETUP_SERVICE_FEE_USD,
        setupServiceNotes: wantsSetup
          ? "Host requested full setup at signup (listings, brand, website)."
          : null,
      },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: "HOST",
        hostId: host.id,
        hostAccess: "OWNER",
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/payments");
  revalidatePath("/account/settings/subscription");
  revalidatePath("/for-hosts");

  try {
    await sendSignupVerificationEmail({
      userId: user.id,
      email,
      name: user.name,
      kind: "host",
    });
  } catch (err) {
    console.error("[auth] start hosting email failed", err);
  }

  redirect(FIRST_LISTING_PATH);
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

  const opted = applyMarketplaceOptIn(
    isSelf ? "SELF" : "PLATFORM",
    parseSitePresence(
      String(formData.get("sitePresence") || existing.sitePresence),
    ),
    formData.get("listOnMarketplace") === "on",
  );
  const sitePresence = opted.sitePresence;
  const listOnMarketplace = opted.listOnMarketplace;

  /**
   * Marketplace-only (STAYLOCAL on platform): shared listing chrome only.
   * No logo/palette/about/services/domain — those live on listing pages.
   */
  const marketplaceOnly = !isSelf && sitePresence === "STAYLOCAL";

  // Brand-site fields: only accept from form when a branded website is on
  let description = existing.description;
  let websiteUrl = existing.websiteUrl;
  let logoUrl = existing.logoUrl;
  let primaryColor = existing.primaryColor || "#2563eb";
  let contactEmail = existing.contactEmail;
  let contactPhone = existing.contactPhone;
  let sitePageAbout = existing.sitePageAbout;
  let sitePageServices = existing.sitePageServices;
  let siteAddress = existing.siteAddress;
  let siteServicesTitle = existing.siteServicesTitle;
  let siteServicesPath = existing.siteServicesPath;
  let siteServicesBody = existing.siteServicesBody;
  let socialFacebook = existing.socialFacebook;
  let socialX = existing.socialX;
  let socialInstagram = existing.socialInstagram;
  let socialTiktok = existing.socialTiktok;
  let customDomain = existing.customDomain;
  let sitePublishState = existing.sitePublishState;

  if (!marketplaceOnly) {
    description = String(formData.get("description") || "").trim() || null;
    websiteUrl = normalizeWebsiteUrl(String(formData.get("websiteUrl") || ""));
    // Logo is optional brand mark for the guest website only.
    // Unchecked = use profile photo on the site (clear logoUrl).
    const useCustomLogo = formData.get("useCustomLogo") === "on";
    if (!useCustomLogo) {
      logoUrl = null;
    } else {
      const logoUrlRaw = String(formData.get("logoUrl") || "").trim();
      logoUrl =
        !logoUrlRaw
          ? existing.logoUrl
          : logoUrlRaw.startsWith("/") && !logoUrlRaw.startsWith("//")
            ? logoUrlRaw
            : /^https?:\/\//i.test(logoUrlRaw)
              ? logoUrlRaw
              : existing.logoUrl;
    }
    const primaryColorRaw = String(
      formData.get("primaryColor") || existing.primaryColor || "#2563eb",
    ).trim();
    primaryColor = /^#[0-9A-Fa-f]{3,8}$/.test(primaryColorRaw)
      ? primaryColorRaw
      : existing.primaryColor || "#2563eb";
    contactEmail =
      String(formData.get("contactEmail") || "").trim() || null;
    contactPhone =
      String(formData.get("contactPhone") || "").trim() || null;
    sitePageAbout = formData.get("sitePageAbout") === "on";
    sitePageServices = formData.get("sitePageServices") === "on";
    siteAddress = optionalText(formData, "siteAddress", 500);
    siteServicesTitle = optionalText(formData, "siteServicesTitle", 120);
    const { normalizeServicesPathInput } = await import("@/lib/host-site");
    siteServicesPath = normalizeServicesPathInput(
      String(formData.get("siteServicesPath") || ""),
    );
    siteServicesBody = optionalText(formData, "siteServicesBody", 8000);
    socialFacebook = optionalText(formData, "socialFacebook", 300);
    socialX = optionalText(formData, "socialX", 300);
    socialInstagram = optionalText(formData, "socialInstagram", 300);
    socialTiktok = optionalText(formData, "socialTiktok", 300);
    customDomain = normalizeCustomDomain(
      String(formData.get("customDomain") || ""),
    );
    sitePublishState = parseSitePublishState(
      String(formData.get("sitePublishState") || existing.sitePublishState),
    );
  } else {
    // Marketplace-only: no brand website pages / vanity domain
    sitePageAbout = false;
    sitePageServices = false;
    customDomain = null;
    websiteUrl = null;
    sitePublishState = "UNPUBLISHED";
  }

  if (!name) redirect(`${HOST_PROFILE_PATH}?error=name`);

  // Domain / public URL only required when LIVE with custom domain presence.
  if (
    !marketplaceOnly &&
    sitePublishState === "LIVE" &&
    (sitePresence === "CUSTOM" || sitePresence === "BOTH") &&
    !websiteUrl &&
    !customDomain
  ) {
    redirect(`${HOST_PROFILE_PATH}?error=website`);
  }
  if (
    !marketplaceOnly &&
    sitePublishState === "LIVE" &&
    isSelf &&
    !websiteUrl &&
    !customDomain
  ) {
    redirect(`${HOST_PROFILE_PATH}?error=website`);
  }

  // Seed boat-rentals starter blocks the first time Other services is turned on
  let seedBlocksJson: string | undefined;
  if (
    sitePageServices &&
    !existing.sitePageServices &&
    !existing.siteServicesBlocks?.trim()
  ) {
    const { boatRentalsStarterBlocks } = await import("@/lib/services-blocks");
    seedBlocksJson = JSON.stringify(boatRentalsStarterBlocks());
    if (!siteServicesTitle) {
      siteServicesTitle = "Boat rentals & lake extras";
    }
    if (!siteServicesPath) {
      siteServicesPath = "boat-rentals";
    }
  }

  const previousCustomDomain = existing.customDomain;

  // Keep paid plan aligned with product path (skip complimentary / self-host)
  let planIdUpdate: string | null | undefined;
  if (!isSelf && hostingMode === "PLATFORM") {
    const currentPlan = existing.planId
      ? await prisma.hostingPlan.findUnique({
          where: { id: existing.planId },
          select: { monthlyPrice: true, slug: true },
        })
      : null;
    const isComplimentary = Boolean(
      currentPlan && currentPlan.monthlyPrice <= 0,
    );
    if (!isComplimentary) {
      const wantSlug = planSlugForSitePresence(sitePresence);
      const matched = await prisma.hostingPlan.findFirst({
        where: { slug: wantSlug, isActive: true, monthlyPrice: { gt: 0 } },
      });
      if (matched && matched.id !== existing.planId) {
        planIdUpdate = matched.id;
      }
    }
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
      siteServicesPath,
      siteServicesBody,
      ...(seedBlocksJson ? { siteServicesBlocks: seedBlocksJson } : {}),
      socialFacebook,
      socialX,
      socialInstagram,
      socialTiktok,
      sitePublishState,
      customDomain,
      ...(planIdUpdate !== undefined ? { planId: planIdUpdate } : {}),
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

  // Domain changed → provision SSL hostname when possible + always alert Ops
  if (previousCustomDomain !== customDomain) {
    try {
      const { handleCustomDomainChange } = await import("@/lib/domain-setup");
      await handleCustomDomainChange({
        hostId: host.id,
        previousDomain: previousCustomDomain,
        nextDomain: customDomain,
      });
    } catch {
      // Never block brand save on provisioning / notify failures
    }
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
 * One-click upgrade: marketplace-only → branded website (BOTH) + branded plan.
 * Unlocks logo/domain/pages. Host still buys the domain at their registrar.
 */
export async function upgradeToBrandedWebsite(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) redirect(`/login?callbackUrl=/admin/brand`);

  const hostId = String(formData.get("hostId") || "");
  if (!hostId) redirect(`/admin/brand?error=missing`);
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect(`/admin/brand?error=forbidden`);
  }

  const existing = await prisma.host.findUnique({
    where: { id: hostId },
    include: { plan: { select: { monthlyPrice: true, slug: true } } },
  });
  if (!existing) redirect(`/admin/brand?error=missing`);
  if (existing.hostingMode === "SELF") {
    redirect(`/admin/brand?hostId=${hostId}&error=self_host`);
  }

  const brandedPlan = await prisma.hostingPlan.findFirst({
    where: { slug: "branded", isActive: true, monthlyPrice: { gt: 0 } },
  });

  const isComplimentary = Boolean(
    existing.plan && existing.plan.monthlyPrice <= 0,
  );

  await prisma.host.update({
    where: { id: hostId },
    data: {
      sitePresence: "BOTH",
      listOnMarketplace: true,
      sitePublishState:
        existing.sitePublishState === "LIVE"
          ? "LIVE"
          : existing.sitePublishState === "DEMO"
            ? "DEMO"
            : "DEMO",
      sitePageAbout: true,
      ...(isComplimentary || !brandedPlan
        ? {}
        : { planId: brandedPlan.id }),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/brand");
  revalidatePath("/ops/hosting");
  revalidatePath("/account/settings/subscription");
  revalidatePath(`/h/${existing.slug}`);
  redirect(`/account/settings/subscription?upgraded=website`);
}

/**
 * Save Services page builder blocks (JSON). Fixed block types only.
 */
export async function saveServicesBlocks(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");

  const hostId = String(formData.get("hostId") || "");
  if (!hostId) throw new Error("Missing host");
  if (!access.isPlatform && access.hostId !== hostId) {
    throw new Error("Forbidden");
  }

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) throw new Error("Host not found");

  const raw = String(formData.get("blocksJson") || "[]");
  let blocks: unknown;
  try {
    blocks = JSON.parse(raw);
  } catch {
    throw new Error("Invalid blocks JSON");
  }
  if (!Array.isArray(blocks)) throw new Error("Blocks must be an array");
  if (blocks.length > 40) throw new Error("Too many blocks (max 40)");

  // Light sanitize (title/details/price/photo for cards)
  const cleaned = blocks.map((b, i) => {
    const o = b as Record<string, unknown>;
    const type = String(o.type || "text").slice(0, 20);
    const imageUrl =
      o.imageUrl != null && String(o.imageUrl).trim()
        ? String(o.imageUrl).trim().slice(0, 2000)
        : type === "image" && o.content
          ? String(o.content).trim().slice(0, 2000)
          : undefined;
    const price =
      o.price != null && String(o.price).trim()
        ? String(o.price).trim().slice(0, 200)
        : undefined;
    return {
      id: String(o.id || `b_${i}`).slice(0, 40),
      type,
      content: String(o.content ?? "").slice(0, 8000),
      secondary:
        o.secondary != null ? String(o.secondary).slice(0, 2000) : undefined,
      ...(imageUrl ? { imageUrl } : {}),
      ...(price ? { price } : {}),
    };
  });

  await prisma.host.update({
    where: { id: hostId },
    data: {
      siteServicesBlocks: JSON.stringify(cleaned),
      sitePageServices: true,
    },
  });

  revalidatePath("/admin/brand");
  revalidatePath(`/h/${host.slug}`);
  revalidatePath(`/h/${host.slug}/services`);
  revalidatePath("/services");
}

/**
 * Upload a photo for Services page blocks (cards / image blocks).
 * Returns URL for client-side live editor (no redirect).
 */
export async function uploadServicesImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const access = await requireHostAdmin();
  if (!access) return { ok: false, error: "Unauthorized" };

  const hostId = String(formData.get("hostId") || "");
  if (!hostId) return { ok: false, error: "Missing host" };
  if (!access.isPlatform && access.hostId !== hostId) {
    return { ok: false, error: "Forbidden" };
  }

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) return { ok: false, error: "Host not found" };

  const parsed = await readUploadedImage(formData.get("file") as File | null);
  if (!parsed.ok) {
    if (parsed.error === "size") return { ok: false, error: "Image must be under 5 MB" };
    if (parsed.error === "type") {
      return { ok: false, error: "Use a JPG, PNG, WebP, or GIF image" };
    }
    return { ok: false, error: "Choose an image file" };
  }

  const { publicUrl: url } = await writePublicUpload(
    ["hosts", hostId, "services"],
    parsed.image,
  );
  revalidatePath(`/h/${host.slug}/services`);
  return { ok: true, url };
}

/**
 * Upload a logo image for the host brand (stored under public/uploads/hosts/{id}).
 * Same pattern as listing photos — path works on the app host; paste URL still OK.
 */
export async function uploadHostLogo(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const hostId = String(formData.get("hostId") || "");
  const returnToRaw = String(formData.get("returnTo") || "/admin/brand").trim();
  const returnTo =
    returnToRaw.startsWith("/admin") || returnToRaw.startsWith("/ops")
      ? returnToRaw
      : "/admin/brand";
  if (!hostId) redirect("/admin/brand?error=missing");
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/brand?error=forbidden");
  }

  const parsed = await readUploadedImage(formData.get("file") as File | null, {
    maxBytes: 4 * 1024 * 1024,
  });
  if (!parsed.ok) {
    const code =
      parsed.error === "size"
        ? "logo_size"
        : parsed.error === "type"
          ? "logo_type"
          : "logo_file";
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${code}`);
  }

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) redirect("/admin/brand?error=missing");

  // Marketplace-only hosts use platform chrome — no brand logo
  if (
    host.hostingMode !== "SELF" &&
    host.sitePresence === "STAYLOCAL"
  ) {
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}error=logo_marketplace`,
    );
  }

  const { publicUrl: logoUrl } = await writePublicUpload(
    ["hosts", hostId],
    parsed.image,
  );
  await prisma.host.update({
    where: { id: hostId },
    data: { logoUrl },
  });

  revalidatePath("/admin/brand");
  revalidatePath(`/h/${host.slug}`);
  revalidatePath(`/h/${host.slug}/about`);
  const safe =
    returnTo.startsWith("/admin") || returnTo.startsWith("/ops")
      ? returnTo
      : "/admin/brand";
  redirect(`${safe}${safe.includes("?") ? "&" : "?"}logo=1`);
}

/** Remove brand logo so guest site falls back to profile photo. */
export async function clearHostLogo(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const hostId = String(formData.get("hostId") || "");
  const returnToRaw = String(formData.get("returnTo") || "/admin/brand").trim();
  const returnTo =
    returnToRaw.startsWith("/admin") || returnToRaw.startsWith("/ops")
      ? returnToRaw
      : "/admin/brand";
  if (!hostId) redirect("/admin/brand?error=missing");
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/brand?error=forbidden");
  }

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) redirect("/admin/brand?error=missing");

  await prisma.host.update({
    where: { id: hostId },
    data: { logoUrl: null },
  });

  revalidatePath("/admin/brand");
  revalidatePath(`/h/${host.slug}`);
  const safe =
    returnTo.startsWith("/admin") || returnTo.startsWith("/ops")
      ? returnTo
      : "/admin/brand";
  redirect(`${safe}${safe.includes("?") ? "&" : "?"}logo=cleared`);
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
