import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetEmailWarnThrottle,
  dispatchPlatformEmail,
  emailConfigPresence,
  platformDoNotReplyLine,
} from "@/lib/messaging";

describe("platformDoNotReplyLine", () => {
  it("tells the recipient not to reply", () => {
    const line = platformDoNotReplyLine();
    expect(line.toLowerCase()).toContain("do not reply");
    expect(line.toLowerCase()).toContain("not monitored");
    expect(line).toContain("Yall Come Back");
  });
});

describe("email config logging never includes values (#7)", () => {
  const KEYS = [
    "MESSAGING_EMAIL_FROM",
    "EMAIL_FROM",
    "MESSAGING_EMAIL_API_KEY",
    "RESEND_API_KEY",
    "MESSAGING_SMTP_HOST",
    "SMTP_HOST",
    "MESSAGING_EMAIL_ENABLED",
    "MESSAGING_EMAIL_DRY_RUN",
  ] as const;
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reports presence as booleans only", () => {
    for (const k of KEYS) delete process.env[k];
    process.env.RESEND_API_KEY = "re_fake_test_value";
    process.env.EMAIL_FROM = "Test <bookings@fake.example>";
    const p = emailConfigPresence();
    expect(p).toEqual({
      fromSet: true,
      messagingEmailApiKeySet: false,
      resendApiKeySet: true,
      smtpHostSet: false,
      enabledFlag: "unset",
      dryRun: false,
    });
    expect(JSON.stringify(p)).not.toContain("re_fake_test_value");
  });

  it("warns when email is not configured, without values", async () => {
    for (const k of KEYS) delete process.env[k];
    process.env.MESSAGING_EMAIL_ENABLED = "false";
    process.env.RESEND_API_KEY = "re_fake_test_value";
    __resetEmailWarnThrottle();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await dispatchPlatformEmail({
      to: "guest@fake.example",
      subject: "s",
      text: "t",
    });
    expect(r.status).toBe("not_configured");
    expect(warn).toHaveBeenCalledWith(
      "[messaging:email:not-configured]",
      expect.objectContaining({ enabledFlag: "false", resendApiKeySet: true }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("re_fake_test_value");
    warn.mockRestore();
  });
});
