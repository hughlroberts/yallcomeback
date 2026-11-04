import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  hostFromSyndicationKey: vi.fn(),
  findUnique: vi.fn(async () => null),
  create: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: m.findUnique, create: m.create, update: vi.fn() },
    propertyImage: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));
vi.mock("@/lib/syndication", async (orig) => ({
  ...(await orig<typeof import("@/lib/syndication")>()),
  hostFromSyndicationKey: m.hostFromSyndicationKey,
}));

import { POST } from "./route";

const HOST = { id: "h1", slug: "test-brand", listOnMarketplace: true };
const post = (raw: string, auth = "Bearer k") =>
  POST(
    new Request("https://www.yallcomeback.app/api/syndication/listings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: raw,
    }),
  );
const valid = { slug: "cabin-1", title: "Cabin", baseNightlyRate: 120 };

beforeEach(() => {
  vi.clearAllMocks();
  m.hostFromSyndicationKey.mockResolvedValue(HOST);
});

describe("POST /api/syndication/listings", () => {
  it("unauthenticated requests still fail auth first (401), even with a bad body", async () => {
    m.hostFromSyndicationKey.mockResolvedValue(null);
    expect((await post("null", "")).status).toBe(401);
    expect((await post("{not json", "")).status).toBe(401);
  });

  for (const raw of ["null", "[]", "42", '"x"', "true", "{bad"]) {
    it(`returns 400 for body ${raw}`, async () => {
      const res = await post(raw);
      expect(res.status).toBe(400);
      expect(m.create).not.toHaveBeenCalled();
    });
  }

  const wrong: [string, unknown][] = [
    ["slug", 5],
    ["title", null],
    ["baseNightlyRate", "120"],
    ["bedrooms", "three"],
    ["city", 7],
    ["published", "yes"],
    ["amenities", { a: 1 }],
    ["images", "x"],
    ["images", [null]],
    ["images", [{ url: 3 }]],
  ];
  for (const [k, v] of wrong) {
    it(`returns 400 when ${k} is ${JSON.stringify(v)}`, async () => {
      const res = await post(JSON.stringify({ ...valid, [k]: v }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain(k === "images" ? "image" : k);
      expect(m.create).not.toHaveBeenCalled();
    });
  }

  it("a valid body still creates the listing", async () => {
    m.create.mockResolvedValue({
      id: "p1", slug: "cabin-1", title: "Cabin", published: false, listOnMarketplace: true,
    });
    const res = await post(JSON.stringify({ ...valid, city: null, amenities: ["wifi"] }));
    expect(res.status).toBe(200);
    expect(m.create).toHaveBeenCalledTimes(1);
  });

  it("a database failure is a 500 without leaking the message", async () => {
    m.create.mockRejectedValue(new Error("prisma internal detail"));
    const res = await post(JSON.stringify(valid));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("prisma");
  });
});
