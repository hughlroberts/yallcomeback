/**
 * Restore a gzipped JSON backup into DATABASE_URL.
 *
 * DESTRUCTIVE: replaces every table in the target database.
 *
 *   RESTORE_CONFIRM=YALLCOMEBACK npx tsx scripts/restore-backup.ts path/to/backup.json.gz
 */
import { readFileSync } from "fs";
import path from "path";
import { parseBackupBuffer, restoreFullBackup } from "../src/lib/backup";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "Usage: RESTORE_CONFIRM=YALLCOMEBACK npx tsx scripts/restore-backup.ts <backup.json.gz>",
    );
    process.exit(1);
  }
  if (process.env.RESTORE_CONFIRM !== "YALLCOMEBACK") {
    console.error(
      "Refusing to restore. Set RESTORE_CONFIRM=YALLCOMEBACK to replace the target database.",
    );
    process.exit(1);
  }

  const abs = path.resolve(file);
  const buf = readFileSync(abs);
  const backup = parseBackupBuffer(buf);
  console.log(
    `Restoring backup from ${backup.createdAt} (${Object.keys(backup.tables).length} tables)…`,
  );
  const result = await restoreFullBackup(backup);
  console.log(JSON.stringify({ ok: true, restored: result.restored }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
