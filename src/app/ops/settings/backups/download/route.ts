import { NextResponse } from "next/server";
import { requirePlatformAdminOr404 } from "@/lib/auth";
import {
  createAndPersistBackup,
  recordBackupRun,
} from "@/lib/backup";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  // Non-admins get a plain 404 (/ops is internal).
  await requirePlatformAdminOr404();

  const startedAt = new Date();
  try {
    const { backup, body, summary } = await createAndPersistBackup();
    await recordBackupRun({ ok: true, summary: `ops-download ${summary}`, startedAt });
    const stamp = backup.createdAt.replace(/[:.]/g, "-");
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="yallcomeback-backup-${stamp}.json.gz"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "backup failed";
    await recordBackupRun({ ok: false, summary: message, startedAt }).catch(
      () => undefined,
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
