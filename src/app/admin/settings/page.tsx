import { redirect } from "next/navigation";

/** Platform settings moved to private ops portal */
export default function AdminSettingsRedirect() {
  redirect("/ops/settings");
}
