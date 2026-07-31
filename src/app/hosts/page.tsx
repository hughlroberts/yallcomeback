import { redirect } from "next/navigation";

/** Hosts are no longer a standalone directory - listings include the host card. */
export default function HostsDirectoryPage() {
  redirect("/marketplace");
}
