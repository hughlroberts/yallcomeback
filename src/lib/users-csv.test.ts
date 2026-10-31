import { describe, expect, it } from "vitest";
import {
  buildUsersCsv,
  classifyUserType,
  csvEscape,
  usersCsvFilename,
} from "@/lib/users-csv";

describe("classifyUserType", () => {
  it("HOST role is host even without a brand", () => {
    expect(classifyUserType({ role: "HOST", hostId: null })).toBe("host");
  });
  it("HOST role with brand is host", () => {
    expect(classifyUserType({ role: "HOST", hostId: "h1" })).toBe("host");
  });
  it("admin attached to a host brand counts as host", () => {
    expect(classifyUserType({ role: "ADMIN", hostId: "h1" })).toBe("host");
  });
  it("admin without a brand is guest", () => {
    expect(classifyUserType({ role: "ADMIN", hostId: null })).toBe("guest");
  });
  it("guest is guest", () => {
    expect(classifyUserType({ role: "GUEST", hostId: null })).toBe("guest");
  });
  it("guest with a stale brand link is host", () => {
    expect(classifyUserType({ role: "GUEST", hostId: "h1" })).toBe("host");
  });
});

describe("csvEscape", () => {
  it("leaves plain values alone", () => {
    expect(csvEscape("a@b.com")).toBe("a@b.com");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
  });
  it("neutralizes formula injection", () => {
    expect(csvEscape("=cmd()")).toBe("'=cmd()");
    expect(csvEscape("+1,2")).toBe("\"'+1,2\"");
  });
  it("handles null", () => {
    expect(csvEscape(null)).toBe("");
  });
});

describe("buildUsersCsv", () => {
  it("writes header and rows with CRLF", () => {
    const csv = buildUsersCsv([
      { email: "host@x.com", role: "HOST", hostId: "h1" },
      { email: "guest@x.com", role: "GUEST", hostId: null },
      { email: "admin@x.com", role: "ADMIN", hostId: "h2" },
      { email: 'odd,"name"@x.com', role: "GUEST", hostId: null },
    ]);
    expect(csv).toBe(
      [
        "email,type",
        "host@x.com,host",
        "guest@x.com,guest",
        "admin@x.com,host",
        '"odd,""name""@x.com",guest',
        "",
      ].join("\r\n"),
    );
  });
  it("header only for no users", () => {
    expect(buildUsersCsv([])).toBe("email,type\r\n");
  });
});

describe("usersCsvFilename", () => {
  it("uses YYYY-MM-DD", () => {
    expect(usersCsvFilename(new Date("2026-10-31T12:00:00Z"))).toBe(
      "users-2026-10-31.csv",
    );
  });
});
