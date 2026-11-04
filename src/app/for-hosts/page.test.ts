/** R1104-2: signed-in hosts can read /for-hosts and get a dashboard link, not a redirect. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  hostingPlan: { findMany: vi.fn(async () => []) },
}));
const authMock = vi.hoisted(() => ({ auth: vi.fn() }));
const nav = vi.hoisted(() => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => authMock);
vi.mock("next/navigation", () => nav);
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/HostSignupForm", () => ({
  HostSignupForm: () => createElement("form", { "data-testid": "signup-form" }),
}));
vi.mock("@/lib/host-signup", () => ({ destAfterHostAuth: vi.fn(async () => "/admin/calendar") }));

import ForHostsPage from "./page";

const render = async () =>
  renderToStaticMarkup(await ForHostsPage({ searchParams: Promise.resolve({}) }));

beforeEach(() => vi.clearAllMocks());

describe("/for-hosts for signed-in users (R1104-2)", () => {
  it("a signed-in host sees the page with 'Go to dashboard', no redirect, no signup form", async () => {
    authMock.auth.mockResolvedValue({ user: { id: "u1" } });
    db.user.findUnique.mockResolvedValue({ name: "Host", email: "h@example.com", role: "HOST", hostId: "h1" });
    const html = await render();
    expect(nav.redirect).not.toHaveBeenCalled();
    expect(html).toContain("Go to dashboard");
    expect(html).toContain('href="/admin/calendar"');
    expect(html).not.toContain('data-testid="signup-form"');
  });
  it("a signed-out visitor gets the signup form and no dashboard link", async () => {
    authMock.auth.mockResolvedValue(null);
    const html = await render();
    expect(html).toContain('data-testid="signup-form"');
    expect(html).not.toContain("Go to dashboard");
  });
});
