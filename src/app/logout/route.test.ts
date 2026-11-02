import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ signOut: vi.fn(async () => undefined) }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";

describe("/logout", () => {
  it("POST goes home with a relative Location (not the server bind address)", async () => {
    const req = new NextRequest("https://0.0.0.0:8080/logout", {
      method: "POST",
      headers: {
        origin: "https://www.yallcomeback.app",
        host: "www.yallcomeback.app",
        "sec-fetch-site": "same-origin",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  it("GET goes home", () => {
    const res = GET();
    expect(res.headers.get("location")).toBe("/");
  });
});
