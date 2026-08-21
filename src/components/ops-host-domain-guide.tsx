import Link from "next/link";
import type { Host } from "@prisma/client";
import { DomainDnsPanel } from "@/components/domain-dns-panel";
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
    | "domainProvisionStatus"
    | "domainProvisionError"
    | "domainSslHostname"
    | "domainDnsCnameHost"
    | "domainDnsCnameTarget"
    | "domainDnsTxtHost"
    | "domainDnsTxtValue"
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
          none of them alone is enough. DNS values below stay saved until cutover.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs">
            <p className="font-semibold text-sky-900">You (Ops / Brand)</p>
            <p className="mt-0.5 text-stone-600">
              Save custom domain + publish state in the app
            </p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-xs">
            <p className="font-semibold text-sky-900">Platform (auto + alert)</p>
            <p className="mt-0.5 text-stone-600">
              Save Brand auto-registers SSL when possible; you always get a
              Messages alert
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

      {domain ? <DomainDnsPanel host={host} variant="ops" /> : null}

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
            2. Platform — SSL (auto) + Messages alert
          </p>
          <p className="mt-1">
            When Brand saves a new custom domain, the app tries to register{" "}
            <code className="rounded bg-white px-1">
              {wwwHost || "www.their-domain.com"}
            </code>{" "}
            and stores CNAME/TXT on the host (card above). You always get an Ops{" "}
            <Link
              href="/admin/messages"
              className="font-semibold text-bonnet hover:underline"
            >
              Messages
            </Link>{" "}
            alert. If status is FAILED, enable the hostname manually and refresh
            provision.
          </p>
        </li>

        <li>
          <p className="font-semibold text-stone-900">
            3. Host (or you for them) — DNS at the registrar
          </p>
          <p className="mt-1">
            Use the saved table above. Log into where they bought{" "}
            <strong>{bare || "their domain"}</strong> and paste CNAME + TXT.
            Optional apex → www 301. Remove old A/CNAME records pointing at the
            previous website host.
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

      <p className="text-sm text-stone-600">
        Full host-facing playbook:{" "}
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
