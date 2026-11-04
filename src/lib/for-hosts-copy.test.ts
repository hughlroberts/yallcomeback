import { describe, expect, it } from "vitest";
import { FOR_HOSTS_DESCRIPTION, forHostsMetadata } from "./for-hosts-copy";
const metadata = forHostsMetadata();

describe("T60: /for-hosts meta copy names no host brand", () => {
  it("description, og and twitter start 'Built by hosts, for hosts.' and skip Cherokee", () => {
    const og = metadata.openGraph as { description?: string };
    const tw = metadata.twitter as { description?: string };
    for (const d of [FOR_HOSTS_DESCRIPTION, metadata.description, og?.description, tw?.description]) {
      expect(d).toMatch(/^Built by hosts, for hosts\./);
      expect(d).not.toMatch(/cherokee/i);
    }
  });
});
