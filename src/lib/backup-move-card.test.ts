import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { moveCardState } from "./backup-move-card";

describe("Platform admin → Backups: Move volume copies card", () => {
  it("disabled and names the variables when the bucket is not set (live today)", () => {
    const s = moveCardState({
      configured: true,
      bucket: { configured: false, keyMissing: false },
    });
    expect(s.enabled).toBe(false);
    const text = s.missing.join(" ");
    for (const v of [
      "BACKUP_S3_ENDPOINT",
      "BACKUP_S3_BUCKET",
      "BACKUP_S3_ACCESS_KEY_ID",
      "BACKUP_S3_SECRET_ACCESS_KEY",
      "BACKUP_ENCRYPTION_KEY",
    ]) {
      expect(text).toContain(v);
    }
  });

  it("disabled when the key is missing", () => {
    const s = moveCardState({
      configured: true,
      bucket: { configured: true, keyMissing: true },
    });
    expect(s.enabled).toBe(false);
    expect(s.missing.join(" ")).toContain("BACKUP_ENCRYPTION_KEY");
  });

  it("disabled when no volume is attached", () => {
    const s = moveCardState({
      configured: false,
      bucket: { configured: true, keyMissing: false },
    });
    expect(s.enabled).toBe(false);
    expect(s.missing.join(" ")).toContain("BACKUP_DIR");
  });

  it("enabled when bucket, key and volume are set", () => {
    expect(
      moveCardState({
        configured: true,
        bucket: { configured: true, keyMissing: false },
      }),
    ).toEqual({ enabled: true, missing: [] });
  });

  it("the page always renders the card (no config condition around it)", () => {
    const src = readFileSync("src/app/ops/settings/backups/page.tsx", "utf8");
    expect(src).toMatch(/\n {6}<Card id="move">/);
    expect(src).not.toMatch(/storage\.bucket\.configured \? \(\s*<Card id="move"/);
    expect(src.match(/disabled=\{!move\.enabled\}/g)?.length).toBe(2);
  });
});

describe("SubmitButton", () => {
  it("a caller's disabled={false} cannot cancel the pending lock", () => {
    const src = readFileSync("src/components/submit-button.tsx", "utf8");
    expect(src.indexOf("{...props}")).toBeLessThan(
      src.indexOf("disabled={pending || props.disabled}"),
    );
  });
});
