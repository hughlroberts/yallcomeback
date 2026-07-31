import { redirect } from "next/navigation";

/** Personal Profile is shared; there is no separate host business page. */
export default function HostProfileRedirect() {
  redirect("/admin");
}
