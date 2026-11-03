import { randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import {
  backupEncryptionKey,
  bucketConfig,
  bucketPrefix,
  bucketReady,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  plainBackupBytes,
} from "@/lib/backup-storage";
import { parseListObjectsXml, signS3Request } from "@/lib/s3-lite";

const bucketEnv = {
  BACKUP_S3_BUCKET: "b",
  BACKUP_S3_ENDPOINT: "https://t3.storageapi.dev/",
  BACKUP_S3_ACCESS_KEY_ID: "id",
  BACKUP_S3_SECRET_ACCESS_KEY: "secret",
};

describe("backup encryption", () => {
  const key = randomBytes(32);

  it("round-trips and hides the plain bytes", () => {
    const plain = Buffer.from("gzip bytes here");
    const enc = encryptBackup(plain, key);
    expect(isEncryptedBackup(enc)).toBe(true);
    expect(enc.includes(plain)).toBe(false);
    expect(decryptBackup(enc, key).equals(plain)).toBe(true);
  });

  it("rejects a changed byte or a wrong key", () => {
    const enc = encryptBackup(Buffer.from("abc"), key);
    const bad = Buffer.from(enc);
    bad[bad.length - 1] ^= 1;
    expect(() => decryptBackup(bad, key)).toThrow();
    expect(() => decryptBackup(enc, randomBytes(32))).toThrow();
  });

  it("passes plain (old volume) files through unchanged", () => {
    const gz = Buffer.from([0x1f, 0x8b, 1, 2]);
    expect(plainBackupBytes(gz, {})).toBe(gz);
  });

  it("needs a 32-byte key", () => {
    expect(backupEncryptionKey({ BACKUP_ENCRYPTION_KEY: "a".repeat(64) })?.length).toBe(32);
    expect(backupEncryptionKey({ BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("base64") })?.length).toBe(32);
    expect(backupEncryptionKey({ BACKUP_ENCRYPTION_KEY: "short" })).toBeNull();
  });
});

describe("bucket config", () => {
  it("needs all four values; region defaults to auto", () => {
    expect(bucketConfig({})).toBeNull();
    const cfg = bucketConfig(bucketEnv)!;
    expect(cfg.region).toBe("auto");
    expect(cfg.endpoint).toBe("https://t3.storageapi.dev");
    expect(cfg.forcePathStyle).toBe(false);
  });

  it("never uploads without an encryption key", () => {
    expect(bucketReady(bucketEnv)).toBeNull();
    expect(
      bucketReady({ ...bucketEnv, BACKUP_ENCRYPTION_KEY: "b".repeat(64) }),
    ).not.toBeNull();
  });

  it("prefix defaults to backups/", () => {
    expect(bucketPrefix({})).toBe("backups/");
    expect(bucketPrefix({ BACKUP_S3_PREFIX: "x" })).toBe("x/");
  });
});

describe("s3-lite", () => {
  it("matches the AWS SigV4 example (GET object with Range)", () => {
    const h = signS3Request({
      cfg: {
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
        bucket: "examplebucket",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        forcePathStyle: false,
      },
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      qs: "",
      payloadHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      extraHeaders: { range: "bytes=0-9" },
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(h.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("parses a ListObjectsV2 page", () => {
    const xml = `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>tok&amp;1</NextContinuationToken>
      <Contents><Key>backups/a&amp;b.json.gz</Key><LastModified>2026-11-01T07:00:00.000Z</LastModified><Size>42</Size></Contents></ListBucketResult>`;
    expect(parseListObjectsXml(xml)).toEqual({
      objects: [{ key: "backups/a&b.json.gz", size: 42, lastModified: "2026-11-01T07:00:00.000Z" }],
      nextToken: "tok&1",
    });
  });
});
