import { describe, expect, it } from "vitest";
import { platformDoNotReplyLine } from "@/lib/messaging";

describe("platformDoNotReplyLine", () => {
  it("tells the recipient not to reply", () => {
    const line = platformDoNotReplyLine();
    expect(line.toLowerCase()).toContain("do not reply");
    expect(line.toLowerCase()).toContain("not monitored");
    expect(line).toContain("Yall Come Back");
  });
});
