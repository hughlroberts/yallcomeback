import { servicesOverrideBadgeLabel, type ServicesAccessHost } from "@/lib/services-access";

/** Small badge for host lists when a Platform admin turned on the Services override. */
export function ServicesOverrideBadge({ host }: { host: ServicesAccessHost }) {
  const label = servicesOverrideBadgeLabel(host);
  if (!label) return null;
  return (
    <span
      data-testid="services-override-badge"
      title="Platform admin turned on the Services page for this brand. The plan does not change."
      className="ml-2 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 align-middle text-[11px] font-medium text-violet-800"
    >
      {label}
    </span>
  );
}
