import { describe, expect, it } from "vitest";
import {
  readStepBlob,
  resolveWizardDraftValues,
  stableSnapshot,
} from "@/lib/listing-wizard-draft";

describe("stableSnapshot", () => {
  it("ignores key order", () => {
    expect(stableSnapshot({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stableSnapshot({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
});

describe("resolveWizardDraftValues", () => {
  const initial = { title: "" };

  it("restores a draft started from the current server values", () => {
    const blob = {
      values: { title: "Lake cabin" },
      savedAt: 1,
      base: stableSnapshot(initial),
    };
    // Server timestamp far newer (another step saved / clock skew): still restore.
    const r = resolveWizardDraftValues(initial, blob, 9_999_999_999_999);
    expect(r).toEqual({ values: { title: "Lake cabin" }, restored: true });
  });

  it("drops the draft when this step was saved on the server since", () => {
    const blob = {
      values: { title: "Old draft" },
      savedAt: Date.now(),
      base: stableSnapshot({ title: "" }),
    };
    const r = resolveWizardDraftValues({ title: "Saved title" }, blob, 0);
    expect(r.restored).toBe(false);
    expect(r.values).toEqual({ title: "Saved title" });
  });

  it("keeps the old timestamp rule for drafts without a base", () => {
    expect(
      resolveWizardDraftValues(initial, { values: { title: "x" }, savedAt: 200 }, 100)
        .restored,
    ).toBe(true);
    expect(
      resolveWizardDraftValues(initial, { values: { title: "x" }, savedAt: 50 }, 100)
        .restored,
    ).toBe(false);
  });

  it("returns server values when there is no draft", () => {
    expect(resolveWizardDraftValues(initial, null, null)).toEqual({
      values: initial,
      restored: false,
    });
  });

  it("works for the description step too", () => {
    const init = { description: "" };
    const blob = readStepBlob(
      {
        description: {
          values: { description: "Quiet cove" },
          base: stableSnapshot(init),
        },
      },
      "description",
    );
    expect(resolveWizardDraftValues(init, blob, null).values.description).toBe(
      "Quiet cove",
    );
  });
});
