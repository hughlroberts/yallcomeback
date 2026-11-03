/**
 * Copy every backup in BACKUP_DIR into the backup bucket, read each one back,
 * and compare sha256. Never deletes anything. Same code as the Platform admin
 * "Copy and verify" button.
 *
 *   npx tsx scripts/copy-backups-to-bucket.ts --dry-run
 *   npx tsx scripts/copy-backups-to-bucket.ts
 *
 * Needs BACKUP_DIR, BACKUP_S3_* and BACKUP_ENCRYPTION_KEY.
 */
import { copyVolumeBackupsToBucket } from "../src/lib/backup";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const r = await copyVolumeBackupsToBucket({ dryRun });
  for (const i of r.items) {
    console.log(`${i.status.padEnd(13)} ${i.name} ${i.bytes}B sha256=${i.sha256}${i.error ? ` (${i.error})` : ""}`);
  }
  console.log(
    `\nvolume files: ${r.volumeCount}, verified in bucket: ${r.verifiedInBucket}, ${dryRun ? "dry run" : r.ok ? "ALL MATCH" : "NOT COMPLETE: do not detach the volume"}`,
  );
  if (!dryRun && !r.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
