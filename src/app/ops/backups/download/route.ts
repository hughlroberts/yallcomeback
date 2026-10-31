import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Legacy alias. Lives here (not next.config) so non-admins get a 404. */
export async function GET() {
  await requirePlatformAdminOr404();
  redirect("/ops/settings/backups/download");
}
