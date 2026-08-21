import Link from "next/link";
import type { Host } from "@prisma/client";
import { domainMapSnippet } from "@/lib/custom-domains";
import { sitePublishStateLabel } from "@/lib/host-site";

const PLATFORM_HOST =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  ) || "www.yallcomeback.app";

type Props = {
  host: Pick<
    Host,
    | "id"
    | "name"
    | "slug"
    | "customDomain"
    | "websiteUrl"
    | "sitePublishState"
    | "sitePresence"
  >;
};

/**
 * Dogfood-friendly DNS + go-live checklist for a managed host brand.
 * Two layers: (1) app routing via customDomain, (2) platform SSL + registrar DNS.
 * Never name hosting vendors or other internal infrastructure in this UI.
 */
export function OpsHostDomainGuide({ host }: Props) {
  const domain = host.customDomain?.trim() || null;
  const bare = domain?.replace(/^www\./, "") || null;
  const wwwHost = bare ? `www.${bare}` : null;
  const previewPath = `/h/${host.slug}`;
  const mapSnippet = bare
    ? domainMapSnippet(bare, host.slug)
    : `${host.slug}.example.com:${host.slug}`;

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-800/80">
          Go live · DNS
        </p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Connect {host.name}&apos;s domain
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Guests can already use the demo at{" "}
          <Link
            href={previewPath}
            target="_blank"
            className="font-semibold text-bonnet hover:underline"
          >
            {previewPath}
          </Link>
          . Pointing a real domain here needs <strong>three</strong> pieces —
          none of them alone is enough.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs">
            <p className="font-semibold text-sky-900">You (Ops / Brand)</p>
            <p className="mt-0.5 text-stone-600">
              Save custom domain + publish state in the app
            </p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs">
            <p className="font-semibold text-sky-900">You (platform SSL)</p>
            <p className="mt-0.5 text-stone-600">
              Register the hostname; copy the CNAME / TXT values to send
            </p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs">
            <p className="font-semibold text-sky-900">Host (registrar)</p>
            <p className="mt-0.5 text-stone-600">
              Paste those records where they bought the domain — or you do it
              for them
            </p>
          </div>
        </div>
      </div>

      <dl className="grid gap-2 rounded-xl border border-sky-100 bg-white/80 px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Publish status
          </dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            {sitePublishStateLabel(host.sitePublishState)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Custom domain (app)
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-stone-900">
            {domain || "— not set —"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Website URL
          </dt>
          <dd className="mt-0.5 break-all text-xs text-stone-900">
            {host.websiteUrl || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Platform site
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-stone-900">
            {PLATFORM_HOST}
          </dd>
        </div>
      </dl>

      <ol className="list-decimal space-y-4 pl-5 text-sm text-stone-700">
        <li>
          <p className="font-semibold text-stone-900">
            1. You — save the domain in Brand
          </p>
          <p className="mt-1">
            Open{" "}
            <Link
              href={`/admin/brand?hostId=${host.id}`}
              className="font-semibold text-bonnet hover:underline"
            >
              Brand &amp; website
            </Link>{" "}
            (host can also edit this if they have Brand access). Set{" "}
            <strong>Custom domain</strong> to the bare hostname (e.g.{" "}
            <code className="rounded bg-white px-1">cherokeelanding.net</code>
            ), keep publish on <strong>Demo</strong> while testing or switch to{" "}
            <strong>Live</strong> at cutover, then Save. That only teaches the
            app which brand owns the Host header — it does{" "}
            <em>not</em> change DNS by itself.
          </p>
          {bare ? (
            <p className="mt-2 rounded-lg bg-white/90 px-3 py-2 font-mono text-[11px] text-stone-600">
              App map ready: {mapSnippet}
            </p>
          ) : (
            <p className="mt-2 text-xs text-amber-900">
              Custom domain is empty — set it in Brand before DNS will do
              anything useful.
            </p>
          )}
        </li>

        <li>
          <p className="font-semibold text-stone-900">
            2. You — enable the domain on the platform (SSL)
          </p>
          <p className="mt-1">
            Hosts never see this step. In platform hosting settings, register
            the hostname so HTTPS works, then copy the DNS values to send:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
            <li>
              Add{" "}
              <code className="rounded bg-white px-1">
                {wwwHost || "www.their-domain.com"}
              </code>{" "}
              as a custom domain on the Yall Come Back service
            </li>
            <li>
              Copy the <strong>CNAME</strong> target the platform shows, plus
              any <strong>TXT</strong> verify record
            </li>
            <li>
              Keep those values private to Ops + the host — do not publish
              internal hostnames in help or marketing
            </li>
          </ul>
          <p className="mt-2 text-xs text-stone-500">
            The public platform site is{" "}
            <code className="rounded bg-white px-1">{PLATFORM_HOST}</code>. Host
            brand domains are separate registrations.
          </p>
        </li>

        <li>
          <p className="font-semibold text-stone-900">
            3. Host (or you for them) — DNS at the registrar
          </p>
          <p className="mt-1">
            This is the only step that lives outside Yall Come Back. Log into
            where they bought{" "}
            <strong>{bare || "their domain"}</strong> and:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
            <li>
              <strong>CNAME</strong> name{" "}
              <code className="rounded bg-white px-1">www</code> → the exact
              target from step 2 (do not invent a value — paste what Ops
              provides)
            </li>
            <li>
              Add the <strong>TXT</strong> verify record if Ops included one
            </li>
            <li>
              Optional: forward apex{" "}
              <code className="rounded bg-white px-1">
                {bare || "domain.com"}
              </code>{" "}
              →{" "}
              <code className="rounded bg-white px-1">
                https://{wwwHost || "www.domain.com"}
              </code>{" "}
              (301) — many registrars cannot CNAME the apex
            </li>
            <li>
              Remove old A/CNAME records that still point at their previous
              website host
            </li>
          </ul>
          <p className="mt-2 rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs text-stone-600">
            <strong className="text-stone-800">What to send the host:</strong>{" "}
            “Add a CNAME for <code className="rounded bg-sky-50 px-1">www</code>{" "}
            pointing to <em>[paste the CNAME target from step 2]</em>, plus this
            TXT if we asked for it: <em>[paste]</em>. Then forward the bare
            domain to https://{wwwHost || "www.…"}.”
          </p>
        </li>

        <li>
          <p className="font-semibold text-stone-900">4. Either of you — verify</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-600">
            <li>
              Platform shows the domain as verified with a valid certificate
            </li>
            <li>
              Open{" "}
              <code className="rounded bg-white px-1">
                https://{wwwHost || "www.their-domain.com"}
              </code>{" "}
              — should show {host.name} chrome (not the YCB marketplace home)
            </li>
            <li>
              Until DNS is ready, keep using{" "}
              <Link
                href={previewPath}
                className="font-semibold text-bonnet hover:underline"
              >
                {previewPath}
              </Link>{" "}
              (Demo publish state)
            </li>
          </ul>
        </li>
      </ol>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        <strong className="font-semibold">Dogfood tip:</strong> Do{" "}
        <em>not</em> point their domain at{" "}
        <code className="rounded bg-white/80 px-1">{PLATFORM_HOST}</code> as a
        shortcut unless Ops explicitly gave that as the CNAME target — and the
        hostname must already be registered on the platform for SSL. Always
        enable the domain on the platform first, then paste{" "}
        <em>those</em> DNS values at the registrar.
      </div>

      <p className="text-sm text-stone-600">
        Full host-facing playbook (marketplace + brand domain + DNS):{" "}
        <Link
          href="/help/branded-website"
          className="font-semibold text-bonnet hover:underline"
        >
          Help · Branded website on your domain
        </Link>
        .
      </p>
    </div>
  );
}
