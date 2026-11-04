import { pageMetadata } from "@/lib/seo";

/** T60: platform copy, so no single host brand is named here. */
export const FOR_HOSTS_DESCRIPTION =
  "Built by hosts, for hosts. Automate return-guest bookings, keep the familiar stay, and skip the giant platform bill.";

export function forHostsMetadata() {
  return pageMetadata({
    title: "Host a Place",
    description: FOR_HOSTS_DESCRIPTION,
    path: "/for-hosts",
  });
}
