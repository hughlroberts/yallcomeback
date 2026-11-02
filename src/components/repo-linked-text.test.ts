import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { REPO_URL, SELF_HOST_STEPS } from "@/lib/features";
import { RepoLinkedText } from "./repo-linked-text";

describe("RepoLinkedText", () => {
  it("makes the repo URL in the self-host install step a link", () => {
    const step = SELF_HOST_STEPS.find((s) => s.body.includes(REPO_URL ?? "\u0000"));
    expect(step).toBeTruthy();
    const html = renderToStaticMarkup(createElement(RepoLinkedText, { text: step!.body }));
    expect(html).toContain(
      `<a href="https://github.com/hughlroberts/yallcomeback" target="_blank" rel="noreferrer" class="font-semibold text-bonnet underline-offset-2 hover:underline">https://github.com/hughlroberts/yallcomeback</a>`,
    );
  });

  it("plain text stays plain", () => {
    expect(renderToStaticMarkup(createElement(RepoLinkedText, { text: "Point your domain." }))).toBe(
      "Point your domain.",
    );
  });
});
