/**
 * Minimal S3-compatible client (SigV4, fetch). Enough for backups:
 * put / get / head / list. Works with Railway Buckets, Cloudflare R2, AWS S3.
 * No SDK dependency on purpose.
 */
import { createHash, createHmac } from "crypto";

export type S3Config = {
  endpoint: string; // e.g. https://t3.storageapi.dev
  region: string; // "auto" for R2 / Railway
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type S3Object = { key: string; size: number; lastModified: string };

const sha256Hex = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding as S3 expects (keep "/" in paths when asked). */
export function s3Encode(value: string, keepSlash = false): string {
  const out = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return keepSlash ? out.replace(/%2F/g, "/") : out;
}

function objectUrl(cfg: S3Config, key: string, query: Record<string, string> = {}) {
  const base = new URL(cfg.endpoint);
  const keyPath = key ? `/${s3Encode(key, true)}` : "/";
  let host = base.host;
  let path = keyPath;
  if (cfg.forcePathStyle) {
    path = `/${s3Encode(cfg.bucket)}${key ? keyPath : ""}`;
  } else {
    host = `${cfg.bucket}.${base.host}`;
  }
  const qs = Object.keys(query)
    .sort()
    .map((k) => `${s3Encode(k)}=${s3Encode(query[k])}`)
    .join("&");
  return { url: `${base.protocol}//${host}${path}${qs ? `?${qs}` : ""}`, host, path, qs };
}

/** SigV4 headers for one request. Exported for tests. */
export function signS3Request(opts: {
  cfg: S3Config;
  method: string;
  host: string;
  path: string;
  qs: string;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
  now?: Date;
}): Record<string, string> {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: opts.host,
    "x-amz-content-sha256": opts.payloadHash,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(opts.extraHeaders ?? {})) {
    headers[k.toLowerCase()] = v.trim();
  }
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    opts.method,
    opts.path,
    opts.qs,
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join("\n");
  const scope = `${day}/${opts.cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${opts.cfg.secretAccessKey}`, day);
  const kRegion = hmac(kDate, opts.cfg.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
  const out: Record<string, string> = { ...headers };
  delete out.host;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${opts.cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return out;
}

async function s3Fetch(
  cfg: S3Config,
  method: string,
  key: string,
  opts: {
    query?: Record<string, string>;
    body?: Buffer;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const { url, host, path, qs } = objectUrl(cfg, key, opts.query);
  const payloadHash = sha256Hex(opts.body ?? "");
  const headers = signS3Request({
    cfg,
    method,
    host,
    path,
    qs,
    payloadHash,
    extraHeaders: opts.headers,
  });
  return fetch(url, {
    method,
    headers,
    body: opts.body ? new Uint8Array(opts.body) : undefined,
    cache: "no-store",
  });
}

async function fail(res: Response, what: string): Promise<never> {
  const text = (await res.text().catch(() => "")).slice(0, 300);
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
  throw new Error(`Bucket ${what} failed: HTTP ${res.status}${code ? ` ${code}` : ""}`);
}

export async function s3PutObject(
  cfg: S3Config,
  key: string,
  body: Buffer,
  meta: Record<string, string> = {},
): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "content-length": String(body.length),
  };
  for (const [k, v] of Object.entries(meta)) headers[`x-amz-meta-${k}`] = v;
  const res = await s3Fetch(cfg, "PUT", key, { body, headers });
  if (!res.ok) await fail(res, "upload");
}

export async function s3GetObject(cfg: S3Config, key: string): Promise<Buffer | null> {
  const res = await s3Fetch(cfg, "GET", key);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, "read");
  return Buffer.from(await res.arrayBuffer());
}

export async function s3HeadObject(
  cfg: S3Config,
  key: string,
): Promise<{ size: number; meta: Record<string, string> } | null> {
  const res = await s3Fetch(cfg, "HEAD", key);
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, "check");
  const meta: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (k.startsWith("x-amz-meta-")) meta[k.slice(11)] = v;
  });
  return { size: Number(res.headers.get("content-length") || 0), meta };
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function parseListObjectsXml(xml: string): {
  objects: S3Object[];
  nextToken: string | null;
} {
  const objects: S3Object[] = [];
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const part = m[1];
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(part)?.[1];
    if (!key) continue;
    objects.push({
      key: xmlUnescape(key),
      size: Number(/<Size>(\d+)<\/Size>/.exec(part)?.[1] || 0),
      lastModified: /<LastModified>([^<]+)<\/LastModified>/.exec(part)?.[1] || "",
    });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const next = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1];
  return { objects, nextToken: truncated && next ? xmlUnescape(next) : null };
}

export async function s3ListObjects(cfg: S3Config, prefix: string): Promise<S3Object[]> {
  const all: S3Object[] = [];
  let token: string | null = null;
  for (let page = 0; page < 100; page++) {
    const query: Record<string, string> = { "list-type": "2", prefix };
    if (token) query["continuation-token"] = token;
    const res = await s3Fetch(cfg, "GET", "", { query });
    if (!res.ok) await fail(res, "list");
    const parsed = parseListObjectsXml(await res.text());
    all.push(...parsed.objects);
    token = parsed.nextToken;
    if (!token) break;
  }
  return all;
}

export async function s3DeleteObject(cfg: S3Config, key: string): Promise<void> {
  const res = await s3Fetch(cfg, "DELETE", key);
  if (!res.ok && res.status !== 404) await fail(res, "delete");
}
