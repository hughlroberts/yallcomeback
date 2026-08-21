/**
 * Persistent DNS cutover card — same records for host Brand and Ops Manage.
 * Does not imply DNS has been changed; only shows what to paste later.
 */

export type DomainDnsPanelHost = {
  name?: string | null;
  customDomain: string | null;
  domainProvisionStatus?: string | null;
  domainProvisionError?: string | null;
  domainSslHostname?: string | null;
  domainDnsCnameHost?: string | null;
  domainDnsCnameTarget?: string | null;
  domainDnsTxtHost?: string | null;
  domainDnsTxtValue?: string | null;
};

type Props = {
  host: DomainDnsPanelHost;
  /** Slightly louder copy for Ops */
  variant?: "brand" | "ops";
};

export function DomainDnsPanel({ host, variant = "brand" }: Props) {
  const bare = host.customDomain?.replace(/^www\./, "") || null;
  if (!bare) return null;

  const wwwHost =
    host.domainSslHostname || `www.${bare}`;
  const ready = Boolean(host.domainDnsCnameTarget);
  const status = (host.domainProvisionStatus || "PENDING").toUpperCase();

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">
            DNS records (saved for cutover)
          </p>
          <p className="mt-0.5 text-xs text-stone-600">
            {variant === "ops"
              ? "Host and Ops can both use these. Pasting at the registrar is what moves the live site — leave them until listings are ready."
              : "Keep these for when you are ready. Your current website stays unchanged until you paste them at your registrar."}
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-700">
          {status}
        </span>
      </div>

      {ready ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-sky-100 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-stone-100 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-stone-800">
                <tr>
                  <td className="px-3 py-2.5 font-sans font-semibold text-stone-700">
                    CNAME
                  </td>
                  <td className="px-3 py-2.5">
                    {host.domainDnsCnameHost || "www"}
                  </td>
                  <td className="break-all px-3 py-2.5">
                    {host.domainDnsCnameTarget}
                  </td>
                </tr>
                {host.domainDnsTxtHost && host.domainDnsTxtValue ? (
                  <tr>
                    <td className="px-3 py-2.5 font-sans font-semibold text-stone-700">
                      TXT
                    </td>
                    <td className="px-3 py-2.5">{host.domainDnsTxtHost}</td>
                    <td className="break-all px-3 py-2.5">
                      {host.domainDnsTxtValue}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-600">
            Zone: <code className="rounded bg-white px-1">{bare}</code>
            {" · "}
            Optional: forward apex →{" "}
            <code className="rounded bg-white px-1">https://{wwwHost}</code>
            {" · "}
            After DNS works, set publish to <strong>Live</strong>.
          </p>
        </>
      ) : (
        <p className="text-xs leading-relaxed text-stone-700">
          {host.domainProvisionError
            ? host.domainProvisionError
            : "DNS values are not ready yet. Ops was notified in Messages."}
        </p>
      )}
    </div>
  );
}
