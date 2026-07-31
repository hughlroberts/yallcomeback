import { redirect } from "next/navigation";

/** Message delivery prefs live under Messages - no separate notifications hub. */
export default function NotificationsRedirect() {
  redirect("/messages");
}
