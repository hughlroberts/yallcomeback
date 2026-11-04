import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const db = vi.hoisted(() => ({
  host: { findUnique: vi.fn() },
  hostingPlan: { findMany: vi.fn(async () => []) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdminOr404: vi.fn(async () => ({})) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
vi.mock("@/app/actions/hosting", () => ({
  issueHostingInvoice: vi.fn(), setHostTestBrand: vi.fn(), suspendHost: vi.fn(), updateHostOps: vi.fn(),
}));
vi.mock("@/components/ops-host-edit-form", () => ({
  OpsHostEditForm: ({ children }: { children: ReactNode }) => createElement("form", null, children),
}));
vi.mock("@/components/ops-host-domain-guide", () => ({ OpsHostDomainGuide: () => null }));
vi.mock("@/components/billing/hosting-invoice-button", () => ({
  HostingInvoiceButton: () => null, TestBrandToggle: () => null,
}));

import OpsHostDetailPage from "./page";

const listing = (over: Record<string, unknown>) => ({
  id: "p", title: "QA Cabin", slug: "qa-cabin", published: false, listOnMarketplace: true,
  archivedAt: null, city: "Austin", baseNightlyRate: 100, _count: { images: 0, bookings: 0 }, ...over,
});

const host = {
  id: "h_qa2", name: "QA Tester Two", slug: "qa-tester-two", plan: null, users: [], invoices: [],
  isTestBrand: true, listOnMarketplace: true, active: true, hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL", subscriptionStatus: "PENDING_PAYMENT", approvalStatus: "APPROVED",
  _count: { properties: 4, conversations: 0 },
  properties: [
    listing({ id: "p1", title: "QA Cabin" }),
    listing({ id: "p2", title: "Untitled listing" }),
    listing({ id: "p3", title: "Live One", published: true }),
    listing({ id: "p4", title: "Old", archivedAt: new Date() }),
  ],
};

describe("T48(3) /ops/hosting/[hostId] listings use the shared status label", () => {
  it("renders Paused / Draft / Live / Archived, never 'Draft'+'Marketplace' for a paused listing", async () => {
    db.host.findUnique.mockResolvedValue(host);
    const html = renderToStaticMarkup(
      await OpsHostDetailPage({ params: Promise.resolve({ hostId: "h_qa2" }) }),
    );
    const badges = [...html.matchAll(/data-testid="ops-listing-status"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(badges).toEqual(["Paused", "Draft", "Live · website + Find a Place", "Archived"]);
  });

  it("the page query selects every field the helper needs", async () => {
    const sel = db.host.findUnique.mock.calls[0][0].include.properties.select;
    for (const f of ["title", "published", "listOnMarketplace", "archivedAt"]) expect(sel[f]).toBe(true);
  });
});
