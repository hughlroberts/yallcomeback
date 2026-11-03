/**
 * State of the "Move volume copies to the bucket" card in Platform admin →
 * Backups. The card always shows; its buttons are enabled only when the
 * bucket, the encryption key, and the volume are all set.
 */
export const BUCKET_VARIABLES = [
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
] as const;

export type MoveCardInput = {
  /** Volume (BACKUP_DIR) attached. */
  configured: boolean;
  bucket: { configured: boolean; keyMissing: boolean };
};

export function moveCardState(s: MoveCardInput): {
  enabled: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!s.bucket.configured) {
    missing.push(
      `Set the bucket variables on the web service: ${BUCKET_VARIABLES.join(", ")} (optional: BACKUP_S3_REGION, BACKUP_S3_FORCE_PATH_STYLE).`,
    );
  }
  if (s.bucket.keyMissing) {
    missing.push(
      "Set BACKUP_ENCRYPTION_KEY (32 bytes: 64 hex characters or base64). Keep a copy outside the platform.",
    );
  } else if (!s.bucket.configured) {
    missing.push(
      "Also set BACKUP_ENCRYPTION_KEY (32 bytes: 64 hex characters or base64) if it is not set.",
    );
  }
  if (!s.configured) {
    missing.push(
      "BACKUP_DIR is not set, so there is no volume to copy from.",
    );
  }
  return { enabled: missing.length === 0, missing };
}
