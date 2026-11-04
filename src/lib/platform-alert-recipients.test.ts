import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/messaging", () => ({ dispatchEmail: vi.fn() }));
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn() }));
vi.mock("@/lib/platform-domains", () => ({ ensurePlatformCustomDomain: vi.fn() }));

import { platformAlertRecipients as fromDomainSetup } from "./domain-setup";
import {
  DEFAULT_PLATFORM_ALERT_EMAIL,
  platformAlertRecipients,
} from "./platform-alerts";

afterEach(() => vi.unstubAllEnvs());

describe("platformAlertRecipients (admin alert inbox)", () => {
  it("defaults to yallcomebackapp@gmail.com", () => {
    expect(DEFAULT_PLATFORM_ALERT_EMAIL).toBe("yallcomebackapp@gmail.com");
    expect(platformAlertRecipients(undefined)).toEqual(["yallcomebackapp@gmail.com"]);
    expect(platformAlertRecipients("")).toEqual(["yallcomebackapp@gmail.com"]);
    expect(platformAlertRecipients("  , bad value,")).toEqual(["yallcomebackapp@gmail.com"]);
  });

  it("PLATFORM_ALERT_EMAIL overrides: lowercased, trimmed, no repeats", () => {
    expect(
      platformAlertRecipients(" Ops@Example.test , ops@example.test,,bad value,b@example.test"),
    ).toEqual(["ops@example.test", "b@example.test"]);
  });

  it("reads the env by default", () => {
    vi.stubEnv("PLATFORM_ALERT_EMAIL", "");
    expect(platformAlertRecipients()).toEqual(["yallcomebackapp@gmail.com"]);
    vi.stubEnv("PLATFORM_ALERT_EMAIL", "alerts@example.test");
    expect(platformAlertRecipients()).toEqual(["alerts@example.test"]);
  });

  it("domain-setup re-exports the same helper", () => {
    expect(fromDomainSetup).toBe(platformAlertRecipients);
  });
});
