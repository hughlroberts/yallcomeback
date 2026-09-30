import { NextResponse } from "next/server";
import {
  createAndPersistBackup,
  recordBackupRun,
} from "@/lib/backup";

/**
 * Daily full backup (listings, hosts, hosting invoices, calendar, bookings).
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.yallcomeback.app/api/cron/backup \
 *     -o ycb-backup.json.gz
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.yallcomeback.app/api/cron/backup?meta=1"
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function cronUnauthorized(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron is not configured (CRON_SECRET missing)" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorized();
  return null;
}

export async function GET(req: Request) {
  const denied = cronUnauthorized(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const metaOnly = url.searchParams.get("meta") === "1";
  const startedAt = new Date();

  try {
    const { backup, body, manifest, file, summary } =
      await createAndPersistBackup();

    await recordBackupRun({ ok: true, summary, startedAt });

    if (metaOnly) {
      return NextResponse.json({
        ok: true,
        persisted: Boolean(file),
        file: file || null,
        ...manifest,
      });
    }

    const stamp = backup.createdAt.replace(/[:.]/g, "-");
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="yallcomeback-backup-${stamp}.json.gz"`,
        "X-Backup-Created-At": backup.createdAt,
        "X-Backup-Summary": summary.slice(0, 500),
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
