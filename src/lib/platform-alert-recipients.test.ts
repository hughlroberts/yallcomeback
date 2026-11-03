import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/messaging", () => ({ dispatchEmail: vi.fn() }));
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn() }));
vi.mock("@/lib/platform-domains", () => ({ ensurePlatformCustomDomain: vi.fn() }));

import { platformAlertRecipients } from "./domain-setup";

describe("platformAlertRecipients", () => {
  it("adds PLATFORM_ALERT_EMAIL to the admin list, lowercased, no repeats", () => {
    expect(
      platformAlertRecipients(
        ["Admin@Example.test"],
        " ops@example.test , admin@example.test,,bad value",
      ),
    ).toEqual(["admin@example.test", "ops@example.test"]);
  });

  it("works with no env value", () => {
    expect(platformAlertRecipients(["a@example.test"], undefined)).toEqual([
      "a@example.test",
    ]);
  });
});
