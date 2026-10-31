import { NextResponse } from "next/server";
import { requirePlatformAdminOr404 } from "@/lib/auth";
import { isStoredBackupName, readStoredBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  // Non-admins get a plain 404 (/ops is internal).
  await requirePlatformAdminOr404();

  const { name } = await ctx.params;
  const decoded = decodeURIComponent(name);
  if (!isStoredBackupName(decoded)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await readStoredBackup(decoded);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${decoded}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
