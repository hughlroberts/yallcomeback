/**
 * Where daily backups live.
 *
 * - Bucket (preferred): any S3-compatible bucket (Railway Bucket, R2, S3),
 *   set with BACKUP_S3_* env vars. Objects are AES-256-GCM encrypted with
 *   BACKUP_ENCRYPTION_KEY before upload; the bucket never sees plain dumps.
 * - Volume (fallback): BACKUP_DIR (the old /data/backups volume). Still read
 *   so old copies stay listed and downloadable until the volume is detached.
 *
 * With both set, new backups go to both. Nothing here deletes volume files.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import {
  s3DeleteObject,
  s3GetObject,
  s3HeadObject,
  s3ListObjects,
  s3PutObject,
  type S3Config,
} from "@/lib/s3-lite";

type Env = Record<string, string | undefined>;

const MAGIC = Buffer.from("YCBENC1\n", "utf8"); // 8 bytes
const IV_LEN = 12;
const TAG_LEN = 16;

export function bucketConfig(env: Env = process.env): S3Config | null {
  const bucket = env.BACKUP_S3_BUCKET?.trim();
  const endpoint = env.BACKUP_S3_ENDPOINT?.trim();
  const accessKeyId = env.BACKUP_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.BACKUP_S3_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    endpoint: endpoint.replace(/\/+$/, ""),
    region: env.BACKUP_S3_REGION?.trim() || "auto",
    accessKeyId,
    secretAccessKey,
    forcePathStyle: env.BACKUP_S3_FORCE_PATH_STYLE?.trim() === "true",
  };
}

export function bucketPrefix(env: Env = process.env): string {
  const raw = env.BACKUP_S3_PREFIX?.trim() ?? "backups/";
  if (!raw) return "";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/** 32-byte key from BACKUP_ENCRYPTION_KEY (64 hex chars or base64). */
export function backupEncryptionKey(env: Env = process.env): Buffer | null {
  const raw = env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  return b.length === 32 ? b : null;
}

export function isEncryptedBackup(buf: Buffer): boolean {
  return buf.length > MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptBackup(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(buf: Buffer, key: Buffer): Buffer {
  if (!isEncryptedBackup(buf)) throw new Error("Not an encrypted backup");
  const iv = buf.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = buf.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
  const body = buf.subarray(MAGIC.length + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/** Decrypt when needed (restore script, downloads). */
export function plainBackupBytes(buf: Buffer, env: Env = process.env): Buffer {
  if (!isEncryptedBackup(buf)) return buf;
  const key = backupEncryptionKey(env);
  if (!key) throw new Error("Backup is encrypted: set BACKUP_ENCRYPTION_KEY");
  return decryptBackup(buf, key);
}

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/** Bucket mode needs both the bucket and a valid key (never upload plain dumps). */
export function bucketReady(env: Env = process.env): {
  cfg: S3Config;
  key: Buffer;
} | null {
  const cfg = bucketConfig(env);
  const key = backupEncryptionKey(env);
  return cfg && key ? { cfg, key } : null;
}

export type BucketFile = { name: string; size: number; mtime: string };

export async function listBucketBackups(
  isName: (n: string) => boolean,
): Promise<BucketFile[]> {
  const cfg = bucketConfig();
  if (!cfg) return [];
  const prefix = bucketPrefix();
  const objects = await s3ListObjects(cfg, prefix);
  return objects
    .map((o) => ({
      name: o.key.slice(prefix.length),
      size: o.size,
      mtime: o.lastModified ? new Date(o.lastModified).toISOString() : "",
    }))
    .filter((f) => isName(f.name));
}

export async function readBucketBackup(name: string): Promise<Buffer | null> {
  const cfg = bucketConfig();
  if (!cfg) return null;
  const raw = await s3GetObject(cfg, bucketPrefix() + name);
  return raw ? plainBackupBytes(raw) : null;
}

export async function writeBucketBackup(name: string, plain: Buffer): Promise<void> {
  const ready = bucketReady();
  if (!ready) throw new Error("Backup bucket or BACKUP_ENCRYPTION_KEY is not set");
  await s3PutObject(ready.cfg, bucketPrefix() + name, encryptBackup(plain, ready.key), {
    sha256: sha256(plain),
    plainsize: String(plain.length),
  });
}

export async function bucketBackupMeta(
  name: string,
): Promise<{ size: number; sha256?: string } | null> {
  const cfg = bucketConfig();
  if (!cfg) return null;
  const head = await s3HeadObject(cfg, bucketPrefix() + name);
  return head ? { size: head.size, sha256: head.meta.sha256 } : null;
}

/** Keep at least `keepNewest` copies; only touches backup-named objects. */
export async function pruneBucketBackups(opts: {
  isName: (n: string) => boolean;
  cutoff: Date;
  keepNewest: number;
}): Promise<number> {
  const cfg = bucketConfig();
  if (!cfg) return 0;
  const files = (await listBucketBackups(opts.isName)).sort((a, b) =>
    b.name.localeCompare(a.name),
  );
  let removed = 0;
  for (const f of files.slice(opts.keepNewest)) {
    if (f.mtime && Date.parse(f.mtime) < opts.cutoff.getTime()) {
      await s3DeleteObject(cfg, bucketPrefix() + f.name);
      removed++;
    }
  }
  return removed;
}
