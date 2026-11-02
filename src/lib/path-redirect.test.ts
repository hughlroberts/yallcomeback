import { describe, expect, it } from "vitest";
import { redirectToPath } from "./path-redirect";

describe("redirectToPath", () => {
  it("sends a relative Location with the given status", () => {
    const res = redirectToPath("/admin?x=1", 303);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin?x=1");
  });

  it("only same-site paths", () => {
    expect(redirectToPath("//evil.example/").headers.get("location")).toBe("/");
    expect(redirectToPath("https://0.0.0.0:8080/").headers.get("location")).toBe("/");
  });
});
