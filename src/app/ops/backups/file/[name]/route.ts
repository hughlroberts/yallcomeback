import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Legacy alias. Lives here (not next.config) so non-admins get a 404. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  await requirePlatformAdminOr404();
  const { name } = await ctx.params;
  redirect(`/ops/settings/backups/file/${encodeURIComponent(name)}`);
}
