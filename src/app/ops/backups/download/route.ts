import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  createFullBackup,
  publicManifest,
  recordBackupRun,
  serializeBackup,
} from "@/lib/backup";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  try {
    const backup = await createFullBackup();
    const manifest = publicManifest(backup);
    const summary = `ops-download ${manifest.createdAt} hosts=${manifest.hostCount} invoices=${manifest.invoiceCount} properties=${manifest.counts.Property ?? 0}`;
    await recordBackupRun({ ok: true, summary, startedAt });
    const body = serializeBackup(backup);
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
