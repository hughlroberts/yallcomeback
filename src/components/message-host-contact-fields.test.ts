/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { MessageHostContactFields } from "./message-host-contact-fields";

afterEach(() => cleanup());

describe("MessageHostContactFields a11y (D8)", () => {
  it("exposes Your name, Email, and Phone (optional) as accessible names", () => {
    render(createElement(MessageHostContactFields));
    expect(
      screen.getByRole("textbox", { name: "Your name" }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
    expect(
      screen.getByRole("textbox", { name: "Phone (optional)" }),
    ).toBeTruthy();
  });
});
