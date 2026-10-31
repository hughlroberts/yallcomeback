import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

export default async function OpsBackupsRedirect() {
  // Layout and page render in parallel: 404 non-admins here too, before redirecting.
  await requirePlatformAdminOr404();
  redirect("/ops/settings/backups");
}
