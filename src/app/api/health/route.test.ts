import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCommitId } from "@/lib/build-info";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("returns 200 ok with the short commit, not cached", async () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "A1C0CE5f00dbabe1234567890abcdef12345678");
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, commit: "a1c0ce5" });
  });
});

describe("buildCommitId", () => {
  it("falls back to GIT_COMMIT_SHA, then unknown", () => {
    expect(buildCommitId({ GIT_COMMIT_SHA: "bfdd2701234" })).toBe("bfdd270");
    expect(buildCommitId({ RAILWAY_GIT_COMMIT_SHA: "", GIT_COMMIT_SHA: "" })).toBe(
      "unknown",
    );
    expect(buildCommitId({ RAILWAY_GIT_COMMIT_SHA: "not-a-sha" })).toBe("unknown");
    expect(buildCommitId({})).toBe("unknown");
  });
});
