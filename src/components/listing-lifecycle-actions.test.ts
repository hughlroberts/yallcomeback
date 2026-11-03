import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions/properties", () => ({ deleteProperty: vi.fn() }));
vi.mock("@/app/actions/listing-lifecycle", () => ({
  pauseListing: vi.fn(),
  resumeListing: vi.fn(),
  archiveListing: vi.fn(),
  restoreListing: vi.fn(),
}));

import { ListingLifecycleActions } from "./listing-lifecycle-actions";

function html(p: { published: boolean; archived: boolean; canRemove?: boolean }) {
  return renderToStaticMarkup(
    createElement(ListingLifecycleActions, {
      propertyId: "p1",
      title: "Lake House",
      canRemove: true,
      ...p,
    }),
  );
}

describe("ListingLifecycleActions", () => {
  it("active: Pause, Archive, Delete", () => {
    const h = html({ published: true, archived: false });
    expect(h).toContain(">Pause<");
    expect(h).toContain(">Archive<");
    expect(h).toContain(">Delete<");
    expect(h).not.toContain(">Resume<");
  });

  it("paused (Inactive): Resume and Delete stay available", () => {
    const h = html({ published: false, archived: false });
    expect(h).toContain(">Resume<");
    expect(h).toContain(">Delete<");
  });

  it("archived: Restore and Delete, no Pause/Resume", () => {
    const h = html({ published: false, archived: true });
    expect(h).toContain(">Restore<");
    expect(h).toContain(">Delete<");
    expect(h).not.toContain(">Pause<");
    expect(h).not.toContain(">Resume<");
  });

  it("limited co-host: no Archive, Restore or Delete", () => {
    const h = html({ published: true, archived: false, canRemove: false });
    expect(h).not.toContain(">Delete<");
    expect(h).not.toContain(">Archive<");
  });

  it("Delete uses a closed modal dialog until clicked", () => {
    const h = html({ published: true, archived: false });
    expect(h).toMatch(/<dialog[^>]*role="alertdialog"/);
    expect(h).toMatch(/aria-modal="true"/);
    expect(h).not.toMatch(/<dialog[^>]*\sopen/);
    expect(h).not.toContain("Are you sure?");
  });

  it("only Confirm calls deleteProperty; Cancel just closes", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/listing-lifecycle-actions.tsx"),
      "utf8",
    );
    expect(src).toContain("Are you sure?");
    expect(src).toContain("showModal()");
    expect(src).toContain("delete: deleteProperty");
    // The only run("delete") call is inside the dialog form submit (Confirm).
    expect(src.match(/run\("delete"\)/g)).toHaveLength(1);
    const cancel = src.slice(src.indexOf("Cancel\n              </button>") - 300);
    expect(cancel.slice(0, 300)).not.toContain('run("delete")');
  });
});
