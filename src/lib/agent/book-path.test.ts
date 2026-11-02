import { describe, expect, it } from "vitest";
import { agentCheckoutBookPath } from "./book-path";

describe("agentCheckoutBookPath", () => {
  it("keeps dates, guests and pets from the request", () => {
    expect(
      agentCheckoutBookPath("lake-house", {
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        guests: 4,
        pets: 1,
      }),
    ).toBe(
      "/book/lake-house?checkIn=2026-12-01&checkOut=2026-12-03&guests=4&pets=1",
    );
  });

  it("accepts numeric strings and keeps guests without dates", () => {
    expect(
      agentCheckoutBookPath("lake-house", { guests: "3", pets: "2" }),
    ).toBe("/book/lake-house?guests=3&pets=2");
  });

  it("drops bad or empty values", () => {
    expect(
      agentCheckoutBookPath("lake-house", {
        checkIn: "2026-12-01",
        checkOut: "soon",
        guests: 2.5,
        pets: 0,
      }),
    ).toBe("/book/lake-house");
    for (const guests of [0, -1, 1000, "abc", "", null, true, "2&x=1"]) {
      expect(agentCheckoutBookPath("lake-house", { guests })).toBe(
        "/book/lake-house",
      );
    }
    expect(agentCheckoutBookPath("lake-house")).toBe("/book/lake-house");
  });

  it("rejects a bad slug", () => {
    expect(agentCheckoutBookPath("", { guests: 2 })).toBeNull();
    expect(agentCheckoutBookPath("../admin", { guests: 2 })).toBeNull();
  });
});
