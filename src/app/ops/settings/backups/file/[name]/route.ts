import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { isStoredBackupName, readStoredBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
