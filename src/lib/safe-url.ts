import { lookup } from "dns/promises";
import net from "net";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe80:")) return true;
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped?.[1]) return isPrivateIp(mapped[1]);
    return false;
  }
  return false;
}

function hostnameBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  return isPrivateIp(host);
}

/**
 * Host-supplied outbound URLs (iCal import, remote listing photos).
 * HTTPS preferred; HTTP allowed for calendar feeds. Blocks loopback/private DNS.
 */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That URL is not valid");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("That URL is not allowed");
  }
  if (hostnameBlocked(url.hostname)) {
    throw new Error("That URL is not allowed");
  }

  let records: { address: string }[];
  try {
    records = await lookup(url.hostname, { all: true });
  } catch {
    throw new Error("Could not resolve that URL");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new Error("That URL is not allowed");
  }
  return url;
}

/** Fetch a host-supplied URL without following redirects onto private IPs. */
export async function fetchSafeOutbound(
  raw: string,
  init?: RequestInit,
  maxRedirects = 3,
): Promise<Response> {
  let current = await assertSafeOutboundUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current.toString(), {
      ...init,
      redirect: "manual",
    });
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    current = await assertSafeOutboundUrl(new URL(loc, current).toString());
  }
  throw new Error("Too many redirects");
}
