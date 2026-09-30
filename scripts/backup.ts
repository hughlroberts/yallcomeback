/**
 * Write a full gzipped JSON backup of the database pointed at by DATABASE_URL.
 *
 *   npx tsx scripts/backup.ts
 *   npx tsx scripts/backup.ts --out ./backups
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import {
  createFullBackup,
  publicManifest,
  serializeBackup,
} from "../src/lib/backup";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const outDir = path.resolve(argValue("--out") || "./backups");
  mkdirSync(outDir, { recursive: true });

  const backup = await createFullBackup();
  const gz = serializeBackup(backup);
  const stamp = backup.createdAt.replace(/[:.]/g, "-");
  const file = path.join(outDir, `yallcomeback-backup-${stamp}.json.gz`);
  writeFileSync(file, gz);

  const manifest = publicManifest(backup);
  const manifestFile = path.join(
    outDir,
    `yallcomeback-backup-${stamp}.counts.json`,
  );
  writeFileSync(
    manifestFile,
    JSON.stringify(
      {
        createdAt: manifest.createdAt,
        formatVersion: manifest.formatVersion,
        counts: manifest.counts,
        hostCount: manifest.hostCount,
        invoiceCount: manifest.invoiceCount,
        uploads: manifest.uploads.length,
        uploadFilesEmbedded: manifest.uploadFilesEmbedded,
        file: path.basename(file),
        bytes: gz.length,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        file,
        bytes: gz.length,
        counts: manifest.counts,
        hostCount: manifest.hostCount,
        invoiceCount: manifest.invoiceCount,
      },
      null,
      2,
    ),
  );
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
