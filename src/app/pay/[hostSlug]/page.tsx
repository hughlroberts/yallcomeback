import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Guest extras storefront is paused — not offered until we support it. */
export default function HostPayPage() {
  notFound();
}
