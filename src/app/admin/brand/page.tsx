import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  rotateSyndicationApiKey,
  updateHostProfile,
} from "@/app/actions/host";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { maskSyndicationKey } from "@/lib/syndication";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand & website" };

/**
 * Host-owned guest site: logo, name, colors, about, contact.
 * On custom domains (HOST_DOMAIN_MAP) this is what guests see — not YCB chrome.
 */
export default async function AdminBrandPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    hostId?: string;
    synKey?: string;
  }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const params = await searchParams;

  // Hosts: always their brand. Platform: require ?hostId= (never edit "first" host).
  let host = null as Awaited<ReturnType<typeof prisma.host.findUnique>>;
  if (access.isPlatform) {
    const pick =
      params.hostId?.trim() ||
      access.hostId ||
      null;
    if (pick) {
      host = await prisma.host.findUnique({ where: { id: pick } });
    }
  } else if (access.hostId) {
    host = await prisma.host.findUnique({ where: { id: access.hostId } });
  }

  if (!host && access.isPlatform) {
    const hosts = await prisma.host.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, active: true },
      take: 50,
    });
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-stone-900">Brand & website</h1>
        <p className="text-sm text-stone-600">
          Platform operators: pick a host brand to edit. Guests on that host&apos;s
          custom domain see this identity — not Yall Come Back.
        </p>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {hosts.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/brand?hostId=${h.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50"
              >
                <span className="font-medium text-stone-900">{h.name}</span>
                <span className="text-stone-400">
                  {h.slug}
                  {!h.active ? " · inactive" : ""}
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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Brand & website
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Guests on your own domain see <strong>your</strong> logo, name, colors,
          about page, and contact info — not Yall Come Back. You own the customer
          relationship; we just run the booking stack.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href={previewPath}
            className="font-semibold text-bonnet hover:underline"
            target="_blank"
          >
            Preview guest site →
          </Link>
        </p>
      </div>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Brand saved. Custom domains pick this up on the next request.
        </p>
      ) : null}
      {params.error === "name" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Display name is required.
        </p>
      ) : null}
      {params.error === "website" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Website / domain URL is required for custom-domain hosts.
        </p>
      ) : null}

      <form action={updateHostProfile} className="space-y-6">
        <input type="hidden" name="hostId" value={host.id} />
        <input
          type="hidden"
          name="returnTo"
          value={
            access.isPlatform
              ? `/admin/brand?hostId=${host.id}`
              : "/admin/brand"
          }
        />
        {/* Preserve ops fields hosts don't edit on this form */}
        <input type="hidden" name="sitePresence" value={host.sitePresence} />
        {host.active ? <input type="hidden" name="active" value="on" /> : null}

        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">Identity</h2>

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
                Square works best (shown as a circle in the header). Paste a
                public image URL for now.
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
                Buttons, links, and accents on your guest site. Leave as-is if
                you prefer the default.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">About page</h2>
          <p className="text-sm text-stone-500">
            Shown on your About page and a short teaser on the home page.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="description">About us</Label>
            <Textarea
              id="description"
              name="description"
              rows={8}
              defaultValue={host.description || ""}
              placeholder="Tell guests who you are, what makes the place special, and what to expect…"
            />
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Marketplace (optional)
          </h2>
          <p className="text-sm text-stone-500">
            Free self-host and paid hosts both control this. Turn on to appear on
            the shared Yall Come Back marketplace; leave off for your domain only.
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
                Each property also has its own marketplace checkbox. Both must be
                on for a stay to appear under Find a Place.
              </span>
            </span>
          </label>
          {host.hostingMode === "SELF" ? (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
              Free self-host mode — $0 / month platform fee. Marketplace is still
              optional.
            </p>
          ) : null}
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">
            Open-source / remote syndication
          </h2>
          <p className="text-sm text-stone-500">
            If you run a separate open-source copy of Yall Come Back on your own
            servers, use an API key to push listings into{" "}
            <strong>this</strong> marketplace. On-platform free self-host (same
            app, your domain via DNS) does not need this — just publish listings
            here and toggle marketplace above.
          </p>
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
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
                {maskSyndicationKey(host.syndicationApiKey)}
              </code>
            </p>
          )}
          <form action={rotateSyndicationApiKey} className="flex flex-wrap gap-3">
            <input type="hidden" name="hostId" value={host.id} />
            <input
              type="hidden"
              name="returnTo"
              value={
                access.isPlatform
                  ? `/admin/brand?hostId=${host.id}`
                  : "/admin/brand"
              }
            />
            <Button type="submit" variant="secondary">
              {host.syndicationApiKey
                ? "Rotate syndication API key"
                : "Generate syndication API key"}
            </Button>
          </form>
          <div className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
            <p className="font-semibold text-stone-800">Example push</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-stone-700">{`curl -X POST "$YCB_ORIGIN/api/syndication/listings" \\
  -H "Authorization: Bearer $SYNDICATION_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"slug":"lake-cabin","title":"Lake cabin","baseNightlyRate":175,"published":true,"city":"Malakoff","region":"TX","images":[{"url":"https://example.com/cover.jpg","isCover":true}]}'`}</pre>
            <p className="mt-2">
              Host marketplace must be on, and the payload should set{" "}
              <code className="rounded bg-white px-1">published: true</code>.
              Full guide:{" "}
              <Link
                href="/open-source#marketplace"
                className="font-medium text-bonnet hover:underline"
              >
                Open source → List on the marketplace
              </Link>
              {" "}(repo:{" "}
              <code className="rounded bg-white px-1">
                docs/remote-open-source-marketplace.md
              </code>
              ).
            </p>
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="text-lg font-semibold text-stone-900">Contact</h2>
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
          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl">Website / custom domain</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              defaultValue={host.websiteUrl || ""}
              placeholder="https://www.cherokeelanding.net"
            />
            <p className="text-xs text-stone-500">
              Point DNS here and set{" "}
              <code className="rounded bg-stone-100 px-1">HOST_DOMAIN_MAP</code>{" "}
              (e.g.{" "}
              <code className="rounded bg-stone-100 px-1">
                cherokeelanding.net:{host.slug}
              </code>
              ) so guests land on your brand.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="defaultDisclaimer">Default booking disclaimer</Label>
            <Textarea
              id="defaultDisclaimer"
              name="defaultDisclaimer"
              rows={3}
              defaultValue={host.defaultDisclaimer || ""}
              placeholder="Optional house rules summary or legal note on bookings…"
            />
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save brand</Button>
          <Link
            href="/admin"
            className="text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            ← Host dashboard
          </Link>
        </div>
      </form>
    </div>
  );
}
