import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  rotateSyndicationApiKey,
  updateHostProfile,
  uploadHostLogo,
} from "@/app/actions/host";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { maskSyndicationKey } from "@/lib/syndication";
import { sitePublishStateLabel } from "@/lib/host-site";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand & website" };

/**
 * Limited hosted-website editor — NOT a freeform CMS.
 * Hosts may change: palette, logos, fixed page toggles (booking always on;
 * optional About + Services), social links, and publish state
 * (Unpublished → Demo → Live before domain cutover).
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

  const params = await searchParams;

  let host = null as Awaited<ReturnType<typeof prisma.host.findUnique>>;
  if (access.isPlatform) {
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
      },
      take: 50,
    });
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Brand & website</h1>
        <p className="text-sm text-stone-600">
          Platform operators: pick a host brand to edit (backdoor). Each brand is
          standalone — host users only see their own brand when they log in.
          Guests on that host&apos;s domain see this identity — not Yall Come Back.
        </p>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {hosts.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/brand?hostId=${h.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-stone-50"
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
                  <span className="block">{h.slug}</span>
                  <span className="text-[11px]">
                    {h.sitePublishState}
                    {!h.active ? " · inactive" : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
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

  const previewPath = `/h/${host.slug}`;
  const returnTo = access.isPlatform
    ? `/admin/brand?hostId=${host.id}`
    : "/admin/brand";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Brand & website
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          This is a <strong>hosted site template</strong>, not a full website
          builder. You can change palette, logos, and which fixed pages are on
          (booking is always first). Guests see your brand — not Yall Come Back.
        </p>
        <p className="mt-2 text-sm">
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
      </div>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved. Preview updates on the next request.
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

      <form action={updateHostProfile} className="space-y-6">
        <input type="hidden" name="hostId" value={host.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="sitePresence" value={host.sitePresence} />
        {host.active ? <input type="hidden" name="active" value="on" /> : null}

        {/* —— Publish —— */}
        <Card className="space-y-4 border-bonnet/20 bg-gradient-to-br from-petal/50 to-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Publish</h2>
            <p className="mt-1 text-sm text-stone-600">
              Build privately, share a demo, then go live when you point your
              domain. No arbitrary new pages — only the fixed set below.
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
                Live — production (domain cutover)
              </option>
            </select>
          </div>
          <ol className="list-inside list-decimal space-y-1 text-xs text-stone-500">
            <li>
              <strong>Unpublished</strong> — build logos, pages, content
            </li>
            <li>
              <strong>Demo</strong> — shareable preview before DNS
            </li>
            <li>
              <strong>Live</strong> — point domain +{" "}
              <code className="rounded bg-white px-1">HOST_DOMAIN_MAP</code>
            </li>
          </ol>
        </Card>

        {/* —— Identity —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Identity & palette
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            {host.logoUrl ? (
              <span className="relative size-16 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
                <Image
                  src={host.logoUrl}
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
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                placeholder="https://… or /uploads/…"
                defaultValue={host.logoUrl || ""}
              />
              <p className="text-xs text-stone-500">
                Square works best. Prefer{" "}
                <strong>Upload logo</strong> in the card below the form, or paste
                a public URL.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={host.name}
              placeholder="Cherokee Landing"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              name="tagline"
              defaultValue={host.tagline || ""}
              placeholder="Lakefront stays on Cedar Creek Lake"
            />
          </div>

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
        </Card>

        {/* —— Fixed pages —— */}
        <Card className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Pages (fixed set)
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              You cannot create new pages. Toggle the standard ones only.
              Booking (home + stays) is always on.
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
                  Booking (always on)
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
                  <p className="text-sm font-semibold text-stone-900">About</p>
                  <p className="text-xs text-stone-500">
                    Story + phone, address, email, and socials.
                  </p>
                </div>
              </label>
            </li>
            <li>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 hover:bg-stone-50">
                <input
                  type="checkbox"
                  name="sitePageServices"
                  defaultChecked={host.sitePageServices}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Other services
                  </p>
                  <p className="text-xs text-stone-500">
                    Boats, tours, etc. — optional second content page.
                  </p>
                </div>
              </label>
            </li>
          </ul>
        </Card>

        {/* —— About content —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">About content</h2>
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
          <div className="space-y-1.5">
            <Label htmlFor="siteAddress">Address</Label>
            <Textarea
              id="siteAddress"
              name="siteAddress"
              rows={2}
              defaultValue={host.siteAddress || ""}
              placeholder="123 Lake Rd&#10;Log Cabin, TX 75148"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </Card>

        {/* —— Services content —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Other services content
          </h2>
          <p className="text-sm text-stone-500">
            Only shown when the Services page toggle is on.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="siteServicesTitle">Title</Label>
            <Input
              id="siteServicesTitle"
              name="siteServicesTitle"
              defaultValue={host.siteServicesTitle || ""}
              placeholder="Boat rentals & lake extras"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteServicesBody">Details</Label>
            <Textarea
              id="siteServicesBody"
              name="siteServicesBody"
              rows={6}
              defaultValue={host.siteServicesBody || ""}
              placeholder="Pontoon rentals next door, kayaks, firewood…"
            />
          </div>
        </Card>

        {/* —— Socials —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">Social links</h2>
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

        {/* —— Domain —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Domain & disclaimer
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="customDomain">Custom domain (hostname)</Label>
            <Input
              id="customDomain"
              name="customDomain"
              defaultValue={host.customDomain || ""}
              placeholder="cherokeelanding.net"
            />
            <p className="text-xs text-stone-500">
              Self-serve routing: guests on this hostname get your brand site.
              Point DNS (CNAME/A) at this Railway app, set publish to{" "}
              <strong>Live</strong>, and allow ~1 minute for the domain map to
              refresh. www and bare domain both work.
            </p>
            {host.customDomain ? (
              <p className="rounded-lg bg-stone-50 px-3 py-2 font-mono text-[11px] text-stone-600">
                DNS → this app · map entry: {host.customDomain}:{host.slug}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl">Public website URL</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={host.websiteUrl || ""}
              placeholder="https://www.cherokeelanding.net"
            />
            <p className="text-xs text-stone-500">
              Shown to guests as your site link. Required for{" "}
              <strong>Live</strong> when using a custom domain / self-host.
            </p>
          </div>
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

        {/* —— Marketplace —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Marketplace (optional)
          </h2>
          <p className="text-sm text-stone-500">
            Separate from your hosted site. Appear on the shared Yall Come Back
            marketplace or stay on your domain only.
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
              </span>
            </span>
          </label>
          {host.hostingMode === "SELF" ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              Free self-host mode — $0 / month platform fee.
            </p>
          ) : null}
        </Card>

        {/* —— Syndication —— */}
        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Open-source / remote syndication
          </h2>
          <p className="text-sm text-stone-500">
            If you run a separate open-source copy, use an API key to push
            listings into this marketplace. On-platform hosting does not need
            this.
          </p>
          {params.synKey ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Copy your new key now</p>
              <p className="mt-1 break-all font-mono text-xs">{params.synKey}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              Current key:{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
                {maskSyndicationKey(host.syndicationApiKey)}
              </code>
            </p>
          )}
          {/* nested form not valid HTML — use separate form below */}
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save brand & website</Button>
          <Link
            href={previewPath}
            target="_blank"
            className="text-sm font-medium text-bonnet hover:underline"
          >
            Preview →
          </Link>
          <Link
            href="/admin"
            className="text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            ← Host dashboard
          </Link>
        </div>
      </form>

      {/* Separate forms — cannot nest inside Save brand */}
      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-stone-900">Upload logo</h2>
        <p className="text-sm text-stone-500">
          PNG, JPG, or WebP under 4&nbsp;MB. Updates your logo without saving the
          rest of the form.
        </p>
        <form
          action={uploadHostLogo}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="hostId" value={host.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="logoFile">Image file</Label>
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
      </Card>

      <form action={rotateSyndicationApiKey} className="flex flex-wrap gap-3">
        <input type="hidden" name="hostId" value={host.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Button type="submit" variant="secondary">
          {host.syndicationApiKey
            ? "Rotate syndication API key"
            : "Generate syndication API key"}
        </Button>
      </form>
    </div>
  );
}
