import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";
import { isSameOriginRequest, isSessionCookieName } from "@/lib/logout";

export const dynamic = "force-dynamic";

/**
 * Plain form POST logout (full page navigation).
 *
 * Why not a server action: a stale page (after a deploy) can post an
 * unknown action id, which reloads the current page with the user still
 * signed in. A full navigation also drops in-flight client fetches that
 * would otherwise re-issue the session cookie after it was cleared.
 * This path is excluded from middleware so no refreshed session cookie is
 * appended to this response.
 */
export async function POST(req: NextRequest) {
  const home = new URL("/", req.nextUrl.origin);
  const sameOrigin = isSameOriginRequest({
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    host: req.headers.get("x-forwarded-host") || req.headers.get("host"),
  });
  if (!sameOrigin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await signOut({ redirect: false });
  } catch (err) {
    console.error("[auth] signOut failed; clearing cookies directly", err);
  }

  const res = NextResponse.redirect(home, 303);
  res.headers.set("Cache-Control", "no-store");
  for (const c of req.cookies.getAll()) {
    if (!isSessionCookieName(c.name)) continue;
    res.cookies.set({
      name: c.name,
      value: "",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: c.name.startsWith("__Secure-") || c.name.startsWith("__Host-"),
    });
  }
  return res;
}

/** GET just goes home; logging out needs a POST from our own page. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
}
