import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateHostProfile } from "@/app/actions/host";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand & website" };

/**
 * Host-owned guest site: logo, name, colors, about, contact.
 * On custom domains (HOST_DOMAIN_MAP) this is what guests see — not YCB chrome.
 */
export default async function AdminBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/brand");

  const params = await searchParams;

  const host = access.isPlatform
    ? await prisma.host.findFirst({
        where: access.hostId ? { id: access.hostId } : { active: true },
        orderBy: { name: "asc" },
      })
    : access.hostId
      ? await prisma.host.findUnique({ where: { id: access.hostId } })
      : null;

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
        <input type="hidden" name="returnTo" value="/admin/brand" />
        {/* Preserve ops fields hosts don't edit on this form */}
        <input type="hidden" name="sitePresence" value={host.sitePresence} />
        {host.listOnMarketplace ? (
          <input type="hidden" name="listOnMarketplace" value="on" />
        ) : null}
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
