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
    expect(h).not.toMatch(/<dialog[^>]*\sopen(=|\s|>)/);
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

  it("Delete dialog is a centered full-screen overlay (T31)", () => {
    const h = html({ published: true, archived: false });
    const cls = h.match(/<dialog[^>]*class="([^"]*)"/)?.[1] ?? "";
    // The CSS reset strips native dialog centering; the overlay must not rely on it.
    for (const c of ["fixed", "inset-0", "m-0", "w-full", "h-full", "max-w-none", "max-h-none", "open:flex", "items-center", "justify-center", "bg-slate-900/50", "p-4"]) {
      expect(cls.split(/\s+/)).toContain(c);
    }
    // Never "flex" unconditionally: that would show the closed dialog.
    expect(cls.split(/\s+/)).not.toContain("flex");
    const src = readFileSync(
      join(process.cwd(), "src/components/listing-lifecycle-actions.tsx"),
      "utf8",
    );
    expect(src).toMatch(/data-delete-dialog-card[\s\S]{0,40}className="w-full max-w-md/);
  });
  it("Resume uses resumeBtn, distinct from Archive btn (E1104-A2)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/listing-lifecycle-actions.tsx"),
      "utf8",
    );
    expect(src).toContain("const resumeBtn =");
    expect(src).toContain('className={resumeBtn}');
    expect(src).toContain('onClick={() => run("resume")}');
    // Resume button uses resumeBtn (emerald), Archive keeps neutral btn.
    const resumeIdx = src.indexOf('run("resume")');
    const resumeSlice = src.slice(Math.max(0, resumeIdx - 200), resumeIdx);
    expect(resumeSlice).toContain("resumeBtn");
    const archiveIdx = src.indexOf(">\n            Archive");
    const archiveSlice = src.slice(Math.max(0, archiveIdx - 250), archiveIdx);
    expect(archiveSlice).toContain("className={btn}");
    expect(archiveSlice).not.toContain("resumeBtn");
  });

});
