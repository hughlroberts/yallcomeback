import { lookup } from "dns/promises";
import http from "http";
import https from "https";
import net from "net";
import type { LookupFunction } from "net";

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

type ResolvedOutbound = { url: URL; address: string };

/**
 * Host-supplied outbound URLs (iCal import, remote listing photos).
 * HTTPS preferred; HTTP allowed for calendar feeds. Blocks loopback/private DNS.
 */
export async function assertSafeOutboundUrl(raw: string): Promise<URL> {
  return (await resolveSafeOutbound(raw)).url;
}

async function resolveSafeOutbound(raw: string): Promise<ResolvedOutbound> {
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
  return { url, address: records[0]!.address };
}

/** Connect to the address already checked, with the original hostname for SNI. */
export function pinnedLookup(address: string): LookupFunction {
  const family = net.isIP(address) === 6 ? 6 : 4;
  return ((hostname, options, callback) => {
    const cb = typeof options === "function" ? options : callback;
    const opts =
      typeof options === "object" && options
        ? (options as { all?: boolean })
        : {};
    if (!cb) return;
    if (opts.all) {
      cb(null, [{ address, family }]);
      return;
    }
    cb(null, address, family);
    void hostname;
  }) as LookupFunction;
}

function headerPairs(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  const list =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers);
  for (const [key, value] of list) {
    if (value != null) out[key] = String(value);
  }
  return out;
}

function requestPinned(
  url: URL,
  address: string,
  init?: RequestInit,
): Promise<Response> {
  const lib = url.protocol === "https:" ? https : http;
  const headers = headerPairs(init?.headers);
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: init?.method || "GET",
        headers,
        servername: url.hostname,
        lookup: pinnedLookup(address),
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (value == null) continue;
            if (Array.isArray(value)) {
              for (const item of value) responseHeaders.append(key, item);
            } else {
              responseHeaders.set(key, value);
            }
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status: incoming.statusCode || 502,
              headers: responseHeaders,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    const signal = init?.signal;
    if (signal) {
      if (signal.aborted) {
        req.destroy();
        reject(signal.reason ?? new Error("Aborted"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          req.destroy();
          reject(signal.reason ?? new Error("Aborted"));
        },
        { once: true },
      );
    }
    const body = init?.body;
    if (typeof body === "string" || body instanceof Uint8Array) {
      req.end(body);
    } else {
      req.end();
    }
  });
}

/** Fetch a host-supplied URL without following redirects onto private IPs. */
export async function fetchSafeOutbound(
  raw: string,
  init?: RequestInit,
  maxRedirects = 3,
): Promise<Response> {
  let current = await resolveSafeOutbound(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await requestPinned(current.url, current.address, init);
    if (res.status < 300 || res.status >= 400) return res;
    const loc = res.headers.get("location");
    if (!loc) return res;
    current = await resolveSafeOutbound(new URL(loc, current.url).toString());
  }
  throw new Error("Too many redirects");
}
