/**
 * T8: a platform admin with Cherokee picked opens a lakefront (Hugh Roberts)
 * thread → switch to that brand and land on the thread. Hosts stay blocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  conversation: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import {
  findThreadBrandSwitch,
  threadBrandSwitchPath,
  type MessagesViewer,
} from "@/lib/messages-access";

const CHEROKEE = "host_cherokee";
const HUGH = "host_hugh";
const THREAD = "cmvzeb3eg0004pa017p0b46bc";

function viewer(over: Partial<MessagesViewer> = {}): MessagesViewer {
  return {
    userId: "u1",
    email: "a@example.com",
    emailVerifiedAt: new Date(),
    role: "ADMIN",
    hostId: CHEROKEE,
    isHost: true,
    isPlatform: true,
    ...over,
  };
}

describe("threadBrandSwitchPath", () => {
  const thread = { hostId: HUGH, hostSlug: "hugh-roberts" };

  it("sends a platform admin through the brand switch back to the thread", () => {
    const path = threadBrandSwitchPath({
      conversationId: THREAD,
      isPlatform: true,
      viewerHostId: CHEROKEE,
      thread,
      alreadySwitched: false,
    });
    expect(path).not.toBeNull();
    const u = new URL(path!, "http://x");
    expect(u.pathname).toBe("/admin/use-brand");
    expect(u.searchParams.get("slug")).toBe("hugh-roberts");
    expect(u.searchParams.get("to")).toBe(`/admin/messages/${THREAD}?switched=1`);
  });

  it("works when no brand is picked yet", () => {
    expect(
      threadBrandSwitchPath({
        conversationId: THREAD,
        isPlatform: true,
        viewerHostId: null,
        thread,
        alreadySwitched: false,
      }),
    ).toContain("slug=hugh-roberts");
  });

  it("blocks hosts (not platform admin)", () => {
    expect(
      threadBrandSwitchPath({
        conversationId: THREAD,
        isPlatform: false,
        viewerHostId: CHEROKEE,
        thread,
        alreadySwitched: false,
      }),
    ).toBeNull();
  });

  it("does not loop after a switch, or when already on that brand, or with no thread", () => {
    const base = {
      conversationId: THREAD,
      isPlatform: true,
      viewerHostId: CHEROKEE,
      thread,
      alreadySwitched: false,
    };
    expect(threadBrandSwitchPath({ ...base, alreadySwitched: true })).toBeNull();
    expect(threadBrandSwitchPath({ ...base, viewerHostId: HUGH })).toBeNull();
    expect(threadBrandSwitchPath({ ...base, thread: null })).toBeNull();
  });
});

describe("findThreadBrandSwitch", () => {
  beforeEach(() => {
    db.user.findUnique.mockReset();
    db.conversation.findUnique.mockReset();
    db.conversation.findUnique.mockResolvedValue({
      hostId: HUGH,
      host: { slug: "hugh-roberts" },
    });
  });

  it("re-reads the admin role from the DB", async () => {
    db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    expect(await findThreadBrandSwitch(THREAD, viewer(), false)).toContain(
      "/admin/use-brand?",
    );
  });

  it("a stale ADMIN token whose DB role is HOST stays blocked", async () => {
    db.user.findUnique.mockResolvedValue({ role: "HOST" });
    expect(await findThreadBrandSwitch(THREAD, viewer(), false)).toBeNull();
  });

  it("a host never triggers a DB lookup", async () => {
    expect(
      await findThreadBrandSwitch(
        THREAD,
        viewer({ role: "HOST", isPlatform: false }),
        false,
      ),
    ).toBeNull();
    expect(db.conversation.findUnique).not.toHaveBeenCalled();
  });

  it("unknown thread stays not found", async () => {
    db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    db.conversation.findUnique.mockResolvedValue(null);
    expect(await findThreadBrandSwitch(THREAD, viewer(), false)).toBeNull();
  });
});
