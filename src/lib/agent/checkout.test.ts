import { describe, expect, it } from "vitest";
import { createAgentStayCheckout } from "./checkout";

describe("agent stay checkout", () => {
  it("rejects paid:true before any calendar write", async () => {
    const result = await createAgentStayCheckout({
      slug: "any",
      checkIn: "2026-08-15",
      checkOut: "2026-08-18",
      guestName: "Guest",
      guestEmail: "guest@example.com",
      acceptTerms: true,
      paid: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/cannot mark a stay paid/i);
    }
  });

  it("requires acceptTerms", async () => {
    const result = await createAgentStayCheckout({
      slug: "any",
      checkIn: "2026-08-15",
      checkOut: "2026-08-18",
      guestName: "Guest",
      guestEmail: "guest@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("T56b: pets over 4 is a 400 before any DB read", async () => {
    const result = await createAgentStayCheckout({
      slug: "any",
      checkIn: "2027-08-15",
      checkOut: "2027-08-18",
      pets: 5,
      guestName: "Guest",
      guestEmail: "guest@example.com",
      acceptTerms: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/0 to 4/);
    }
  });
});
