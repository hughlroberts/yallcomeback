import { NextResponse } from "next/server";

/**
 * Redirect to a same-site path with a relative Location header.
 *
 * Do not build the target from `req.url` / `req.nextUrl.origin` in a route
 * handler: the standalone server reports its bind address there
 * (https://0.0.0.0:8080 in production), so an absolute redirect sends the
 * browser to an address it cannot open. A relative Location keeps the
 * browser on the host it used.
 */
export function redirectToPath(path: string, status = 307): NextResponse {
  const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  return new NextResponse(null, { status, headers: { Location: safe } });
}
