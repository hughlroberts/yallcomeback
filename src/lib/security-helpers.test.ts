import { afterEach, describe, expect, it } from "vitest";
import { isStoredBackupName } from "@/lib/backup";
import { formatContinueSearchText } from "@/lib/browse-history";
import { cronUnauthorized } from "@/lib/cron-auth";
import {
  canonicalSiteOrigin,
  isLocalHostname,
  PRODUCT_ORIGIN,
} from "@/lib/features";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import {
  guestPaymentOptions,
  guestValueToPaymentMethod,
  parsePaymentMethod,
  resolveBookingChannel,
} from "@/lib/host-payments";
import { stripeCollectionIsPaused } from "@/lib/platform-billing";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  connectOriginFromHeaders,
  isTrustedConnectRequest,
} from "@/lib/stripe-connect";

describe("resolveBookingChannel", () => {
  it("treats Find a Place as marketplace even if a guest posts via=host_site", () => {
    expect(
      resolveBookingChannel({
        tenantHostSlug: null,
        listingHostSlug: "cherokee-landing",
      }),
    ).toBe("marketplace");
  });

  it("uses host-site only when the tenant slug matches the listing host", () => {
    expect(
      resolveBookingChannel({
        tenantHostSlug: "cherokee-landing",
        listingHostSlug: "cherokee-landing",
      }),
    ).toBe("host_site");
  });

  it("does not let a mismatched tenant look like the host site", () => {
    expect(
      resolveBookingChannel({
        tenantHostSlug: "other-brand",
        listingHostSlug: "cherokee-landing",
      }),
    ).toBe("marketplace");
  });
});

describe("guestPaymentOptions", () => {
  const host = {
    stripeAccountId: "acct_test",
    websitePaymentMethod: "MANUAL" as const,
  };

  it("marketplace stays card-only even when the listing is cash or bitcoin", () => {
    const options = guestPaymentOptions(host, "marketplace", {
      websitePaymentMethod: "BITCOIN",
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.value).toBe("card");
  });

  it("host site follows the listing deposit method", () => {
    const options = guestPaymentOptions(host, "host_site", {
      websitePaymentMethod: "IN_PERSON_CARD",
    });
    expect(options[0]?.value).toBe("in_person_card");
  });
});

describe("payment method parsing", () => {
  it("keeps IN_PERSON_CARD and rejects unknown values", () => {
    expect(parsePaymentMethod("IN_PERSON_CARD")).toBe("IN_PERSON_CARD");
    expect(parsePaymentMethod("WIRE", "MANUAL")).toBe("MANUAL");
    expect(guestValueToPaymentMethod("in_person_card")).toBe("IN_PERSON_CARD");
  });
});

describe("canManageBrand", () => {
  it("blocks LIMITED co-hosts from brand money settings", () => {
    expect(
      canManageBrand(
        resolveHostAccessInfo({
          isPlatform: false,
          hostId: "h1",
          hostAccess: "LIMITED",
        }),
      ),
    ).toBe(false);
  });

  it("allows OWNER, FULL, and platform", () => {
    expect(
      canManageBrand(
        resolveHostAccessInfo({
          isPlatform: false,
          hostId: "h1",
          hostAccess: "OWNER",
        }),
      ),
    ).toBe(true);
    expect(
      canManageBrand(
        resolveHostAccessInfo({
          isPlatform: false,
          hostId: "h1",
          hostAccess: "FULL",
        }),
      ),
    ).toBe(true);
    expect(
      canManageBrand(
        resolveHostAccessInfo({
          isPlatform: true,
          hostId: "h1",
          hostAccess: null,
        }),
      ),
    ).toBe(true);
  });
});

describe("Connect origin", () => {
  it("rejects a cross-site Origin", () => {
    const headers = new Headers({
      origin: "https://evil.example",
      host: "www.yallcomeback.app",
    });
    expect(isTrustedConnectRequest(headers)).toBe(false);
  });

  it("accepts same-site Origin on the live host", () => {
    const headers = new Headers({
      origin: "https://www.yallcomeback.app",
      host: "www.yallcomeback.app",
    });
    expect(isTrustedConnectRequest(headers)).toBe(true);
  });

  it("never returns localhost as a Stripe return URL", () => {
    const headers = new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    expect(connectOriginFromHeaders(headers)).toBe(PRODUCT_ORIGIN);
  });
});

describe("canonicalSiteOrigin", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
  const prevAuth = process.env.AUTH_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    process.env.AUTH_URL = prevAuth;
  });

  it("skips localhost env and uses the live origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.AUTH_URL = "http://127.0.0.1:3000";
    expect(canonicalSiteOrigin()).toBe(PRODUCT_ORIGIN);
    expect(isLocalHostname("localhost:3000")).toBe(true);
  });
});

describe("cronUnauthorized", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("fails closed when the secret is missing", () => {
    delete process.env.CRON_SECRET;
    const res = cronUnauthorized(new Request("https://www.yallcomeback.app/api/cron/sync-ical"));
    expect(res?.status).toBe(503);
  });

  it("rejects a bad bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const res = cronUnauthorized(
      new Request("https://www.yallcomeback.app/api/cron/sync-ical", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("allows the matching bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const res = cronUnauthorized(
      new Request("https://www.yallcomeback.app/api/cron/sync-ical", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res).toBeNull();
  });
});

describe("safeInternalPath", () => {
  it("blocks open redirects", () => {
    expect(safeInternalPath("https://evil.example")).toBe("/");
    expect(safeInternalPath("//evil.example")).toBe("/");
    expect(safeInternalPath("/\\evil.example")).toBe("/");
    expect(safeInternalPath("/admin")).toBe("/admin");
    expect(safeInternalPath("/login?callbackUrl=/admin")).toBe(
      "/login?callbackUrl=/admin",
    );
  });
});

describe("isStoredBackupName", () => {
  it("allowlists backup filenames", () => {
    expect(
      isStoredBackupName("yallcomeback-backup-2026-10-01T12-00-00Z.json.gz"),
    ).toBe(true);
    expect(isStoredBackupName("../etc/passwd")).toBe(false);
    expect(isStoredBackupName("yallcomeback-backup-2026.json")).toBe(false);
  });
});

describe("formatContinueSearchText", () => {
  it("does not say anywhere", () => {
    expect(formatContinueSearchText({ searchedAt: 0 })).toBe(
      "Continue searching for homes",
    );
    expect(formatContinueSearchText({ where: "Malakoff", searchedAt: 0 })).toBe(
      "Continue searching for homes near Malakoff",
    );
  });
});

describe("stripeCollectionIsPaused", () => {
  it("treats a pause_collection object as paused", () => {
    expect(stripeCollectionIsPaused({ behavior: "void" })).toBe(true);
    expect(stripeCollectionIsPaused(null)).toBe(false);
    expect(stripeCollectionIsPaused(undefined)).toBe(false);
  });
});
