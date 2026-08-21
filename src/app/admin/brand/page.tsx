import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  clearHostLogo,
  rotateSyndicationApiKey,
  updateHostProfile,
  uploadHostLogo,
} from "@/app/actions/host";
import { setAdminBrandContext } from "@/app/actions/admin-brand";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { maskSyndicationKey } from "@/lib/syndication";
import {
  hostServicesHref,
  hostServicesPathSegment,
  sitePublishStateLabel,
} from "@/lib/host-site";
import {
  hostHasBrandedWebsite,
  hostProductPath,
  marketplaceListingPath,
} from "@/lib/hosting";
import {
  hostProfileFaceUrl,
  hostSiteMarkUrl,
} from "@/lib/host-images";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand & website" };

/**
 * Brand admin is product-path aware:
 * 1. Marketplace only — listing URLs, platform chrome (no logo/palette/about/services)
 * 2. Custom website — logo, palette, fixed pages (stays / about / other services)
 * 3. Open source — self-host; syndication for remote marketplace; AI not in OSS
 */
export default async function AdminBrandPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    hostId?: string;
    synKey?: string;
    logo?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const { resolveHostAccessInfo, canManageBrand } = await import(
    "@/lib/host-access"
  );
  const accessInfo = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(accessInfo)) {
    redirect("/admin?error=limited");
  }

  const params = await searchParams;

  let host = null as Awaited<ReturnType<typeof prisma.host.findUnique>>;
  if (access.isPlatform) {
    // Query hostId or admin brand cookie (access.hostId)
    const pick = params.hostId?.trim() || access.hostId || null;
    if (pick) {
      host = await prisma.host.findUnique({ where: { id: pick } });
    }
  } else if (access.hostId) {
    host = await prisma.host.findUnique({ where: { id: access.hostId } });
  }

  if (!host && access.isPlatform) {
    const hosts = await prisma.host.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        contactEmail: true,
        sitePublishState: true,
        sitePresence: true,
        hostingMode: true,
      },
      take: 50,
    });
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Brand & website</h1>
        <p className="text-sm text-stone-600">
          Platform operators: pick a host brand. Use the amber brand switcher at
          the top of Admin so Properties, Bookings, and Brand stay on one brand
          (e.g. Cherokee vs your personal listings).
        </p>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {hosts.map((h) => {
            const path = hostProductPath(h);
            return (
              <li key={h.id}>
                <form action={setAdminBrandContext}>
                  <input type="hidden" name="hostId" value={h.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`/admin/brand?hostId=${h.id}`}
                  />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-stone-50"
                  >
                    <span>
                      <span className="font-medium text-stone-900">{h.name}</span>
                      {h.contactEmail ? (
                        <span className="mt-0.5 block text-xs text-stone-400">
                          {h.contactEmail}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right text-stone-400">
                      <span className="block text-[11px] font-medium text-stone-600">
                        {path === "marketplace"
                          ? "Marketplace only"
                          : path === "open_source"
                            ? "Open source"
                            : "Custom website"}
                      </span>
                      <span className="block">{h.slug}</span>
                      <span className="text-[11px]">
                        {h.sitePublishState}
                        {!h.active ? " · inactive" : ""}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
        {hosts.length === 0 ? (
          <p className="text-sm text-stone-500">No hosts yet.</p>
        ) : null}
      </div>
    );
  }

  if (!host) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-stone-900">Brand & website</h1>
        <p className="mt-3 text-stone-600">
          No host brand is linked to this account yet.
        </p>
      </div>
    );
  }

  const product = hostProductPath(host);
  const branded = hostHasBrandedWebsite(host);
  const previewPath = `/h/${host.slug}`;
  const returnTo = access.isPlatform
    ? `/admin/brand?hostId=${host.id}`
    : "/admin/brand";

  const listings = await prisma.property.findMany({
    where: { hostId: host.id },
    orderBy: { title: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      listOnMarketplace: true,
    },
    take: 40,
  });

  const brandOwner = await prisma.user.findFirst({
    where: {
      hostId: host.id,
      role: "HOST",
      OR: [{ hostAccess: "OWNER" }, { hostAccess: null }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, avatarUrl: true, email: true },
  });
  const profileAvatarUrl = brandOwner?.avatarUrl ?? null;
  const hasLogo = Boolean(host.logoUrl?.trim());
  const facePreview = hostProfileFaceUrl(host, profileAvatarUrl);
  const siteMarkPreview = hostSiteMarkUrl(host, profileAvatarUrl);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Brand & website
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Choose how guests find you. Marketplace-only stays use shared platform
          pages and listing URLs. A custom website (hosted by Yall Come Back)
          unlocks logo, palette, and fixed pages — including an Other services
          page for things like boat rentals.
        </p>
      </div>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved.
        </p>
      ) : null}
      {params.logo ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Logo uploaded.
        </p>
      ) : null}
      {params.error === "name" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Display name is required.
        </p>
      ) : null}
      {params.error === "website" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Website / domain URL is required when publish status is{" "}
          <strong>Live</strong> with a custom domain.
        </p>
      ) : null}
      {params.error === "logo_file" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Choose an image file to upload as your logo.
        </p>
      ) : null}
      {params.error === "logo_size" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Logo must be under 4&nbsp;MB.
        </p>
      ) : null}
      {params.error === "logo_marketplace" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Marketplace-only brands do not use a custom logo. Switch to a custom
          website product first, or put photos on each listing.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <form
          id="brand-form"
          action={updateHostProfile}
          className="contents"
        >
          <input type="hidden" name="hostId" value={host.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {host.active ? <input type="hidden" name="active" value="on" /> : null}

          {/* —— Product path —— */}
          <Card className="order-1 space-y-4 border-bonnet/20 bg-gradient-to-br from-petal/50 to-white p-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                How guests find you
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Three products — pick the surface that matches your business.
              </p>
            </div>

            {host.hostingMode === "SELF" ? (
              <>
                <input type="hidden" name="sitePresence" value="CUSTOM" />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  <p className="font-semibold">Open source / self-host</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    You run the stack on your own infrastructure. Marketplace
                    discovery is optional via syndication. Platform AI / agentic
                    tools are not part of the open-source tree — they live only
                    on the hosted Yall Come Back product.
                  </p>
                  <p className="mt-2 text-xs">
                    Guide:{" "}
                    <Link href="/self-host" className="font-semibold underline">
                      /self-host
                    </Link>
                    {" · "}
                    <Link
                      href="/help/syndication-api-key"
                      className="font-semibold underline"
                    >
                      Syndication key
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <fieldset className="space-y-2">
                <legend className="sr-only">Guest-facing product</legend>
                {(
                  [
                    {
                      id: "STAYLOCAL" as const,
                      title: "1 · Marketplace only",
                      body: "Same look and feel as every other stay on Yall Come Back (like Airbnb). Guests use listing URLs — no separate brand website, logo, palette, About, or Other services page.",
                    },
                    {
                      id: "BOTH" as const,
                      title: "2 · Custom website + marketplace (optional)",
                      body: "Yall Come Back hosts your brand site: logo, palette, stays, About, and a custom Other services page (boat rentals, camping, etc.). Marketplace listing is optional.",
                    },
                    {
                      id: "CUSTOM" as const,
                      title: "2b · Custom website only",
                      body: "Same branded site as above, without marketplace discovery. Point your domain when you go live.",
                    },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm hover:bg-stone-50 has-[:checked]:border-bonnet/40 has-[:checked]:bg-petal/30"
                  >
                    <input
                      type="radio"
                      name="sitePresence"
                      value={opt.id}
                      defaultChecked={host.sitePresence === opt.id}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-stone-900">
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
                        {opt.body}
                      </span>
                    </span>
                  </label>
                ))}
                <p className="pt-1 text-xs text-stone-500">
                  <strong>3 · Open source:</strong> free self-host path (sign up
                  with Free self-host, or ask Ops to switch hosting mode). Full
                  product minus AI models.
                </p>
              </fieldset>
            )}
          </Card>

          {/* —— Marketplace-only: listing URLs —— */}
          {!branded ? (
            <Card className="order-2 space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Your listing URLs
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Guests share and book these short marketplace links — not a
                  host-name website path. Each listing has its own slug (and
                  stays under the shared platform look).
                </p>
              </div>
              {listings.length === 0 ? (
                <p className="text-sm text-stone-500">
                  No listings yet.{" "}
                  <Link
                    href="/admin/properties"
                    className="font-medium text-bonnet hover:underline"
                  >
                    Add a stay →
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                  {listings.map((p, i) => {
                    const path = marketplaceListingPath(p.slug, host.slug);
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900">
                            <span className="mr-2 font-mono text-xs text-stone-400">
                              #{i + 1}
                            </span>
                            {p.title}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-xs text-stone-500">
                            {path}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {!p.published ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-500">
                              Draft
                            </span>
                          ) : null}
                          <Link
                            href={path}
                            target="_blank"
                            className="text-xs font-semibold text-bonnet hover:underline"
                          >
                            Open →
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-stone-500">
                Host path <code className="rounded bg-stone-100 px-1">/h/{host.slug}</code>{" "}
                is not your public product in marketplace-only mode. Photos,
                story, and contact live on each listing.
              </p>
            </Card>
          ) : null}

          {/* —— Minimal identity (always) —— */}
          <Card className="order-3 space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">
                {branded ? "Identity & palette" : "Account name"}
              </h2>
              {!branded ? (
                <p className="mt-1 text-sm text-stone-500">
                  Shown as the host name on marketplace listings. Logo, colors,
                  and About pages are not used in marketplace-only mode.
                </p>
              ) : null}
            </div>

            {branded ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Profile photo (guests &amp; messages)
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {facePreview ? (
                      <span className="relative size-16 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
                        <Image
                          src={facePreview}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      </span>
                    ) : (
                      <span className="flex size-16 items-center justify-center rounded-full bg-stone-200 text-lg font-semibold text-stone-600">
                        {host.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1 text-sm text-stone-600">
                      <p>
                        Guests see this face when they message you and on “Meet
                        your host.”
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {profileAvatarUrl
                          ? "Using the brand owner’s account photo."
                          : "No profile photo yet — add one under Account → Profile."}
                      </p>
                      <Link
                        href="/account/settings/personal?edit=1"
                        className="mt-2 inline-block text-sm font-semibold text-bonnet hover:underline"
                      >
                        Edit profile photo →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Guest website mark
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {siteMarkPreview ? (
                      <span
                        className={`relative size-14 overflow-hidden bg-stone-100 ring-1 ring-stone-200 ${
                          hasLogo ? "rounded-lg" : "rounded-full"
                        }`}
                      >
                        <Image
                          src={siteMarkPreview}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized
                        />
                      </span>
                    ) : (
                      <span className="flex size-14 items-center justify-center rounded-full bg-bonnet text-lg font-semibold text-white">
                        {host.name.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-600">
                        {hasLogo
                          ? "Using a brand logo in the website header."
                          : "Header uses your profile photo until you add a logo."}
                      </p>
                      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-stone-800">
                        <input
                          type="checkbox"
                          name="useCustomLogo"
                          defaultChecked={hasLogo}
                          className="mt-1"
                          id="useCustomLogo"
                        />
                        <span>
                          <span className="font-medium">
                            Use a brand logo on the website
                          </span>
                          <span className="mt-0.5 block text-xs text-stone-500">
                            Optional. Profile photo still appears on listings
                            and messages.
                          </span>
                        </span>
                      </label>
                      {hasLogo ? (
                        <div className="mt-3 space-y-1.5">
                          <Label htmlFor="logoUrl" className="text-xs text-stone-500">
                            Logo URL or path
                          </Label>
                          <Input
                            id="logoUrl"
                            name="logoUrl"
                            defaultValue={host.logoUrl || ""}
                            placeholder="/brand/hosts/your-logo.png"
                          />
                          <p className="text-[11px] text-stone-400">
                            Prefer a path under /brand/… so deploys keep the file.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={host.name}
                placeholder="Your name or brand"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tagline">
                {branded ? "Tagline" : "Short line on listings (optional)"}
              </Label>
              <Input
                id="tagline"
                name="tagline"
                defaultValue={host.tagline || ""}
                placeholder={
                  branded
                    ? "Lakefront stays on Cedar Creek Lake"
                    : "e.g. Private lake stays on Cedar Creek"
                }
              />
            </div>

            {branded ? (
              <div className="space-y-1.5">
                <Label htmlFor="primaryColor">Primary color</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    defaultValue={
                      /^#[0-9A-Fa-f]{6}$/.test(host.primaryColor)
                        ? host.primaryColor
                        : "#2563eb"
                    }
                    className="h-11 w-14 cursor-pointer rounded-lg border border-stone-200 bg-white p-1"
                  />
                  <p className="text-sm text-stone-500">
                    Buttons, links, and accents on your guest site.
                  </p>
                </div>
              </div>
            ) : null}
          </Card>

          {/* —— Publish (branded sites only) —— */}
          {branded ? (
            <Card className="order-5 space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Publish</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Controls who can see your guest site on Yall Come Back. This
                  does not change DNS or move your old domain by itself.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sitePublishState">Site visibility</Label>
                <select
                  id="sitePublishState"
                  name="sitePublishState"
                  defaultValue={host.sitePublishState}
                  className="block w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-900"
                >
                  <option value="UNPUBLISHED">
                    Unpublished — only you can preview
                  </option>
                  <option value="DEMO">
                    Demo — public at /h/{host.slug} with banner
                  </option>
                  <option value="LIVE">
                    Live — ready for your domain (after DNS)
                  </option>
                </select>
                <p className="text-xs text-stone-500">
                  Choose <strong>Live</strong> when SSL + DNS for your custom
                  domain are done. Until then, stay on Demo and use{" "}
                  <code className="rounded bg-stone-100 px-1">
                    /h/{host.slug}
                  </code>
                  .
                </p>
              </div>
              <p className="text-sm">
                <Link
                  href={previewPath}
                  className="font-semibold text-bonnet hover:underline"
                  target="_blank"
                >
                  Preview guest site →
                </Link>
                <span className="mx-2 text-stone-300">·</span>
                <span className="text-stone-500">
                  Status:{" "}
                  <strong className="text-stone-800">
                    {sitePublishStateLabel(host.sitePublishState)}
                  </strong>
                </span>
              </p>
            </Card>
          ) : null}

          {/* —— Fixed pages (branded) —— */}
          {branded ? (
            <Card id="pages" className="order-6 scroll-mt-24 space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Pages (fixed set)
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  Booking (home + stays) is always on. Toggle About and Other
                  services — e.g. boat rentals or camping, like a standalone
                  services page on your domain.
                </p>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    readOnly
                    className="mt-1"
                    aria-label="Booking always on"
                  />
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      Stays / booking (always on)
                    </p>
                    <p className="text-xs text-stone-500">
                      Home hero + stays catalog. Guests start here.
                    </p>
                  </div>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      name="sitePageAbout"
                      defaultChecked={host.sitePageAbout}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        About
                      </p>
                      <p className="text-xs text-stone-500">
                        Story + phone, address, email, and socials — connection
                        to the hosts.
                      </p>
                    </div>
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-bonnet/30 bg-petal/20 px-4 py-3 hover:bg-petal/40">
                    <input
                      type="checkbox"
                      name="sitePageServices"
                      defaultChecked={host.sitePageServices}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        Other services (custom page)
                      </p>
                      <p className="text-xs text-stone-500">
                        Required for many brands: boats, tours, camping, etc.
                        Photos, pricing, and copy via the block builder below —
                        even when unrelated to lodging.
                      </p>
                    </div>
                  </label>
                </li>
              </ul>
            </Card>
          ) : null}

          {/* —— About story (branded) —— */}
          {branded ? (
            <Card className="order-7 space-y-5 p-6">
              <h2 className="text-lg font-semibold text-stone-900">
                About content
              </h2>
              <p className="text-sm text-stone-500">
                Shown when the About page is on (and a short teaser on the home
                page).
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="description">About us</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={8}
                  defaultValue={host.description || ""}
                  placeholder="Tell guests who you are…"
                />
              </div>
            </Card>
          ) : null}

          {/* —— Public contact → About + footer —— */}
          {branded ? (
            <Card id="contact-details" className="order-7 space-y-5 p-6">
              <h2 className="text-lg font-semibold text-stone-900">
                Contact details
              </h2>
              <p className="text-sm text-stone-500">
                Address, phone, and email appear on the{" "}
                <strong>About → Contact</strong> section and in the{" "}
                <strong>site footer</strong>. Guests can also use{" "}
                <strong>Send a message</strong> (same Messages tools as
                listings) if they prefer not to call or email.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="siteAddress">Address</Label>
                <Textarea
                  id="siteAddress"
                  name="siteAddress"
                  rows={2}
                  defaultValue={host.siteAddress || ""}
                  placeholder={"123 Lake Rd\nLog Cabin, TX 75148"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contactPhone">Public phone</Label>
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    defaultValue={host.contactPhone || ""}
                    placeholder="(903) 555-0100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contactEmail">Public email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={host.contactEmail || ""}
                    placeholder="stay@example.com"
                  />
                </div>
              </div>
              <p className="text-xs text-stone-500">
                After save, open{" "}
                <Link
                  href={`/h/${host.slug}/about#contact`}
                  className="font-medium text-bonnet hover:underline"
                >
                  /h/{host.slug}/about#contact
                </Link>{" "}
                to preview. Messaging works even if phone/email are blank.
              </p>
            </Card>
          ) : null}

          {/* —— Services title (branded) —— */}
          {branded ? (
            <Card className="order-8 space-y-5 p-6">
              <h2 className="text-lg font-semibold text-stone-900">
                Other services page
              </h2>
              <p className="text-sm text-stone-500">
                Turn the page on above, set a title, then build with blocks after
                save. Example: boat rentals & camping — a must for many custom
                websites even when it is not lodging.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="siteServicesTitle">
                  Page name (nav, hero button)
                </Label>
                <Input
                  id="siteServicesTitle"
                  name="siteServicesTitle"
                  defaultValue={host.siteServicesTitle || ""}
                  placeholder="Boat rentals & lake extras"
                />
                <p className="text-xs text-stone-500">
                  Label shown in the site header and home hero.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="siteServicesPath">Page URL</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-stone-500">
                    /h/{host.slug}/
                  </span>
                  <Input
                    id="siteServicesPath"
                    name="siteServicesPath"
                    className="max-w-xs font-mono text-sm"
                    defaultValue={host.siteServicesPath || "services"}
                    placeholder="boat-rentals"
                  />
                </div>
                <p className="text-xs text-stone-500">
                  Letters, numbers, and hyphens only. Examples:{" "}
                  <code className="rounded bg-stone-100 px-1">boat-rentals</code>
                  ,{" "}
                  <code className="rounded bg-stone-100 px-1">boat-rental</code>
                  . Default is{" "}
                  <code className="rounded bg-stone-100 px-1">services</code>.
                  On your own domain this is{" "}
                  <code className="rounded bg-stone-100 px-1">
                    /{host.siteServicesPath || "services"}
                  </code>
                  .
                </p>
              </div>
              <input
                type="hidden"
                name="siteServicesBody"
                value={host.siteServicesBody || ""}
              />
            </Card>
          ) : null}

          {/* —— Socials (branded) —— */}
          {branded ? (
            <Card className="order-9 space-y-5 p-6">
              <h2 className="text-lg font-semibold text-stone-900">
                Social links
              </h2>
              <p className="text-sm text-stone-500">
                Full URL or handle. Shown in footer and on About.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="socialFacebook">Facebook</Label>
                  <Input
                    id="socialFacebook"
                    name="socialFacebook"
                    defaultValue={host.socialFacebook || ""}
                    placeholder="https://facebook.com/… or page name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialX">X (Twitter)</Label>
                  <Input
                    id="socialX"
                    name="socialX"
                    defaultValue={host.socialX || ""}
                    placeholder="https://x.com/… or @handle"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialInstagram">Instagram</Label>
                  <Input
                    id="socialInstagram"
                    name="socialInstagram"
                    defaultValue={host.socialInstagram || ""}
                    placeholder="https://instagram.com/… or @handle"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="socialTiktok">TikTok</Label>
                  <Input
                    id="socialTiktok"
                    name="socialTiktok"
                    defaultValue={host.socialTiktok || ""}
                    placeholder="https://tiktok.com/@… or @handle"
                  />
                </div>
              </div>
            </Card>
          ) : null}

          {/* —— Domain (branded) —— */}
          {branded ? (
            <Card className="order-10 space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">
                  Domain & guest site
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Tell us which domain you want. Saving here does{" "}
                  <strong className="font-semibold text-stone-800">not</strong>{" "}
                  move your old website or change DNS by itself.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">
                  Save on this page ≠ domain cutover
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  Filling in a custom domain only teaches Yall Come Back which
                  brand owns that hostname. Guests keep using your old site until
                  Ops enables SSL and you (or they) update DNS at the registrar.
                  Until then, use the preview link below.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm text-stone-700">
                <p className="font-medium text-stone-900">
                  Preview on Yall Come Back (works now)
                </p>
                <p className="mt-2">
                  <Link
                    href={previewPath}
                    target="_blank"
                    className="font-semibold text-bonnet hover:underline"
                  >
                    {previewPath} →
                  </Link>
                </p>
                <p className="mt-2 text-xs text-stone-500">
                  Keep Site visibility on <strong>Demo</strong> while you build.
                  Switch to <strong>Live</strong> only after DNS works.
                </p>
              </div>

              <ol className="space-y-3 rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-700">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bonnet text-[11px] font-bold text-white">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-stone-900">
                      This form — save your domain name
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      You are here. Enter the bare hostname below and Save brand.
                      Nothing moves on the public internet yet.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-stone-900">
                      Ops — enable the domain for SSL
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Not on this page. Yall Come Back Ops registers the hostname
                      and sends you the exact CNAME / TXT values to paste.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[11px] font-bold text-stone-700">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-stone-900">
                      You — update DNS at your registrar
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Not on this page. At the place you bought the domain, set
                      CNAME <code className="rounded bg-stone-100 px-1">www</code>{" "}
                      to the target Ops sent. Optional: forward the apex to www.
                      Full guide:{" "}
                      <Link
                        href="/help/branded-website"
                        className="font-semibold text-bonnet underline"
                      >
                        Help · Branded website
                      </Link>
                      .
                    </p>
                  </div>
                </li>
              </ol>

              <div className="space-y-1.5">
                <Label htmlFor="customDomain">
                  Domain name to connect (does not change DNS)
                </Label>
                <Input
                  id="customDomain"
                  name="customDomain"
                  defaultValue={host.customDomain || ""}
                  placeholder="e.g. cherokeelanding.net"
                />
                <p className="text-xs text-stone-500">
                  Bare hostname only (no https://). Example:{" "}
                  <code className="rounded bg-stone-100 px-1">
                    cherokeelanding.net
                  </code>
                  . Leave empty to stay on preview only.
                </p>
                {host.customDomain ? (
                  <p className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
                    <strong className="font-semibold">Step 1 done in app:</strong>{" "}
                    mapped{" "}
                    <code className="rounded bg-white px-1 font-mono text-[11px]">
                      {host.customDomain}
                    </code>{" "}
                    → this brand. Steps 2–3 (SSL + DNS) still happen outside this
                    form. Preview remains{" "}
                    <code className="rounded bg-white px-1 font-mono text-[11px]">
                      {previewPath}
                    </code>{" "}
                    until DNS is live.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl">
                  Public website URL (what you tell guests)
                </Label>
                <Input
                  id="websiteUrl"
                  name="websiteUrl"
                  type="url"
                  defaultValue={
                    host.websiteUrl && host.websiteUrl !== "none"
                      ? host.websiteUrl
                      : ""
                  }
                  placeholder={
                    host.customDomain
                      ? `https://www.${host.customDomain.replace(/^www\./, "")}`
                      : `https://www.yallcomeback.app/h/${host.slug}`
                  }
                />
                <p className="text-xs text-stone-500">
                  Usually{" "}
                  <code className="rounded bg-stone-100 px-1">
                    https://www.your-domain.com
                  </code>{" "}
                  after cutover. This is a display / booking link field — it also
                  does not change DNS.
                </p>
              </div>
            </Card>
          ) : null}

          {/* —— Marketplace opt-in (not for marketplace-only; always on) —— */}
          {branded ? (
            <Card className="order-11 space-y-5 p-6">
              <h2 className="text-lg font-semibold text-stone-900">
                Marketplace (optional)
              </h2>
              <p className="text-sm text-stone-500">
                Appear on the shared Yall Come Back marketplace in addition to
                your brand site, or stay domain-only.
              </p>
              <label className="flex items-start gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  name="listOnMarketplace"
                  defaultChecked={host.listOnMarketplace}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-stone-900">
                    List this brand on the free marketplace
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    Each property also has its own marketplace checkbox.
                    Marketplace listings use short property URLs, not your host
                    name path.
                  </span>
                </span>
              </label>
              {listings.length > 0 ? (
                <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                  <p className="text-xs font-medium text-stone-600">
                    Example listing URLs
                  </p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-stone-500">
                    {listings.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        {marketplaceListingPath(p.slug, host.slug)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          ) : (
            <input type="hidden" name="listOnMarketplace" value="on" />
          )}

          {/* —— Disclaimer (always) —— */}
          <Card className="order-12 space-y-3 p-6">
            <h2 className="text-lg font-semibold text-stone-900">
              Booking disclaimer
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="defaultDisclaimer">Default booking disclaimer</Label>
              <Textarea
                id="defaultDisclaimer"
                name="defaultDisclaimer"
                rows={3}
                defaultValue={host.defaultDisclaimer || ""}
                placeholder="Optional house rules summary on bookings…"
              />
            </div>
          </Card>

          <div className="order-13 flex flex-wrap items-center gap-3">
            <SubmitButton>Save</SubmitButton>
            {branded ? (
              <Link
                href={previewPath}
                target="_blank"
                className="text-sm font-medium text-bonnet hover:underline"
              >
                Preview site →
              </Link>
            ) : listings[0] ? (
              <Link
                href={marketplaceListingPath(listings[0].slug, host.slug)}
                target="_blank"
                className="text-sm font-medium text-bonnet hover:underline"
              >
                Open a listing →
              </Link>
            ) : null}
            <Link
              href="/admin"
              className="text-sm font-medium text-stone-600 hover:text-stone-900"
            >
              ← Host dashboard
            </Link>
          </div>
        </form>

        {/* Optional brand logo upload — only needed if “use logo” is checked */}
        {branded ? (
          <Card className="order-4 space-y-4 border-stone-200 p-6">
            <h2 className="text-lg font-semibold text-stone-900">
              Brand logo (optional)
            </h2>
            <p className="text-sm text-stone-500">
              Upload only if you want a logo in the guest website header instead
              of your profile photo. Square PNG or JPG under 4&nbsp;MB.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Note: files uploaded here are stored on the app server and can be
              lost when the site redeploys. For a permanent logo, put the file
              under <code className="font-mono">public/brand/hosts/</code> in
              the project and paste that path (e.g.{" "}
              <code className="font-mono">/brand/hosts/cherokee-landing-logo.png</code>
              ), or re-upload after deploy.
            </p>
            <form
              action={uploadHostLogo}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="hostId" value={host.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="logoFile">Logo file</Label>
                <Input
                  id="logoFile"
                  name="file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  required
                />
              </div>
              <Button type="submit" variant="secondary">
                Upload logo
              </Button>
            </form>
            {hasLogo ? (
              <form action={clearHostLogo} className="pt-1">
                <input type="hidden" name="hostId" value={host.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
                >
                  Remove logo (use profile photo on site)
                </button>
              </form>
            ) : null}
          </Card>
        ) : null}

        {/* Services — edit live on the guest demo page */}
        {branded && host.sitePageServices ? (
          <Card
            id="services-builder"
            className="order-14 scroll-mt-24 space-y-3 p-6"
          >
            <h2 className="text-lg font-semibold text-stone-900">
              Boat rentals / other services
            </h2>
            <p className="text-sm text-stone-600">
              Edit boats, photos, details, and pricing{" "}
              <strong>live on the guest page</strong> — changes preview as you
              type, then Save. Best for fleets (e.g. five boats with rates).
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={hostServicesHref(host, `/h/${host.slug}`)}
                className="inline-flex rounded-full bg-bonnet px-4 py-2 text-sm font-semibold text-white hover:bg-bonnet/90"
              >
                Open live services editor →
              </Link>
              <Link
                href={hostServicesHref(host, `/h/${host.slug}`)}
                target="_blank"
                className="inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                Preview as guest
              </Link>
            </div>
            <p className="text-xs text-stone-500">
              Page name:{" "}
              <strong>
                {host.siteServicesTitle?.trim() || "Other services"}
              </strong>
              {" · "}
              URL:{" "}
              <code className="rounded bg-stone-100 px-1 text-[11px]">
                /h/{host.slug}/{hostServicesPathSegment(host)}
              </code>
              . Edit under Other services page above, then save brand settings.
            </p>
          </Card>
        ) : branded ? (
          <Card
            id="services-builder"
            className="order-14 scroll-mt-24 p-6 text-sm text-stone-500"
          >
            Turn on <strong>Other services</strong> under{" "}
            <a href="#pages" className="font-medium text-bonnet hover:underline">
              Pages
            </a>
            , save, then open the guest services page to add boat cards, photos,
            and pricing live on the site.
          </Card>
        ) : null}

        {/* Syndication — OSS / existing key only */}
        {product === "open_source" ||
        host.syndicationApiKey ||
        params.synKey ? (
          <Card className="order-15 space-y-4 border-stone-200 bg-stone-50/50 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-stone-900">
                    Syndication API key
                  </h2>
                  <Link
                    href="/help/syndication-api-key"
                    target="_blank"
                    className="inline-flex size-7 items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-bold text-stone-600 hover:border-bonnet hover:text-bonnet"
                    title="What is this key?"
                    aria-label="About the syndication API key"
                  >
                    i
                  </Link>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  For a <em>remote</em> open-source install that pushes listings
                  into this marketplace. AI / agentic pricing features are not
                  in the open-source codebase.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                Open source
              </span>
            </div>

            {params.synKey ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Copy your new key now</p>
                <p className="mt-1 break-all font-mono text-xs">{params.synKey}</p>
                <p className="mt-2 text-xs">
                  It will not be shown in full again. Store it in your remote
                  deploy secrets.
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-600">
                Current key:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-stone-200">
                  {maskSyndicationKey(host.syndicationApiKey)}
                </code>
              </p>
            )}

            <form
              action={rotateSyndicationApiKey}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="hostId" value={host.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="secondary">
                {host.syndicationApiKey
                  ? "Rotate syndication API key"
                  : "Generate syndication API key"}
              </Button>
              <Link
                href="/help/syndication-api-key"
                className="text-sm font-medium text-bonnet hover:underline"
              >
                How this works →
              </Link>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
