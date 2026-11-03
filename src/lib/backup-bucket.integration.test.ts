/**
 * End-to-end against a real S3-compatible server. Skipped unless
 * S3_IT_ENDPOINT is set, e.g. a local test server:
 *   rclone serve s3 /tmp/s3root --addr 127.0.0.1:9123 --auth-key k,s --force-path-style=true
 *   S3_IT_ENDPOINT=http://127.0.0.1:9123 S3_IT_BUCKET=ycb-test S3_IT_KEY=k S3_IT_SECRET=s npx vitest run src/lib/backup-bucket.integration.test.ts
 */
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { createHash, randomBytes } from "crypto";
import { gzipSync } from "zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const ep = process.env.S3_IT_ENDPOINT;
const d = ep ? describe : describe.skip;

d("backup bucket (live S3-compatible server)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ycb-vol-"));
  const prefix = `it-${Date.now()}/`;
  const names = [
    "yallcomeback-backup-2026-10-30T07-00-00-000Z.json.gz",
    "yallcomeback-backup-2026-10-31T07-00-00-000Z.json.gz",
    "yallcomeback-backup-2026-11-01T07-00-00-000Z.json.gz",
  ];
  const saved = { ...process.env };

  beforeAll(() => {
    for (const n of names) {
      writeFileSync(path.join(dir, n), gzipSync(JSON.stringify({ n, pad: randomBytes(2000).toString("hex") })));
    }
    writeFileSync(path.join(dir, "notes.txt"), "not a backup");
    Object.assign(process.env, {
      BACKUP_DIR: dir,
      BACKUP_S3_ENDPOINT: ep,
      BACKUP_S3_BUCKET: process.env.S3_IT_BUCKET,
      BACKUP_S3_ACCESS_KEY_ID: process.env.S3_IT_KEY,
      BACKUP_S3_SECRET_ACCESS_KEY: process.env.S3_IT_SECRET,
      BACKUP_S3_FORCE_PATH_STYLE: "true",
      BACKUP_S3_PREFIX: prefix,
      BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    });
  });
  afterAll(() => {
    process.env = saved;
  });

  it("dry run copies nothing", async () => {
    const { copyVolumeBackupsToBucket, listStoredBackups } = await import("./backup");
    const r = await copyVolumeBackupsToBucket({ dryRun: true });
    expect(r.volumeCount).toBe(3);
    expect(r.items.map((i) => i.status)).toEqual(["would_copy", "would_copy", "would_copy"]);
    expect(r.ok).toBe(false);
    expect((await listStoredBackups()).every((f) => f.location === "volume")).toBe(true);
  });

  it("copies, reads back, and matches every checksum; volume untouched", async () => {
    const before = readdirSync(dir).sort();
    const { copyVolumeBackupsToBucket } = await import("./backup");
    const r = await copyVolumeBackupsToBucket({ dryRun: false });
    expect(r.ok).toBe(true);
    expect(r.verifiedInBucket).toBe(3);
    for (const i of r.items) {
      expect(i.sha256).toBe(createHash("sha256").update(readFileSync(path.join(dir, i.name))).digest("hex"));
    }
    expect(readdirSync(dir).sort()).toEqual(before);
    const again = await copyVolumeBackupsToBucket({ dryRun: false });
    expect(again.items.every((i) => i.status === "already_there")).toBe(true);
  });

  it("stores ciphertext only, and lists/reads from the bucket", async () => {
    const { listStoredBackups, readStoredBackup } = await import("./backup");
    const { bucketConfig, bucketPrefix } = await import("./backup-storage");
    const { s3GetObject } = await import("./s3-lite");
    const raw = await s3GetObject(bucketConfig()!, bucketPrefix() + names[0]);
    expect(raw!.subarray(0, 7).toString()).toBe("YCBENC1");
    expect(raw!.includes(Buffer.from(names[0]))).toBe(false);
    const files = await listStoredBackups();
    expect(files.filter((f) => f.location === "bucket").map((f) => f.name).sort()).toEqual(names);
    expect((await readStoredBackup(names[1])).equals(readFileSync(path.join(dir, names[1])))).toBe(true);
  });

  it("new backups go to the bucket and the volume while both are set", async () => {
    const { persistBackupFile, readStoredBackup } = await import("./backup");
    const body = gzipSync("new");
    const r = await persistBackupFile(body, "2026-11-02T07:00:00.000Z");
    expect(r.locations).toEqual(["bucket", "volume"]);
    delete process.env.BACKUP_DIR;
    expect((await readStoredBackup(r.name)).equals(body)).toBe(true);
    process.env.BACKUP_DIR = dir;
  });

  it("a wrong secret is rejected by the server", async () => {
    const { s3ListObjects } = await import("./s3-lite");
    const { bucketConfig } = await import("./backup-storage");
    await expect(
      s3ListObjects({ ...bucketConfig()!, secretAccessKey: "wrong" }, prefix),
    ).rejects.toThrow(/HTTP 40/);
  });
});
