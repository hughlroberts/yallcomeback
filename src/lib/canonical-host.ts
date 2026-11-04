import { PRODUCT_DOMAIN, PRODUCT_ORIGIN } from "./features";

/**
 * Bare product domain → https://www with the same path and query.
 * Today DNS sends the bare domain to the registrar's forwarding (root only),
 * so this runs only if the bare domain is later attached to this app.
 * Other hosts (www, custom domains, localhost) are left alone; plain-http →
 * https on www is already done by the hosting edge.
 */
export function bareDomainRedirect(input: {
  hostname: string | null;
  pathname: string;
  search: string;
}): string | null {
  if ((input.hostname || "").toLowerCase() !== PRODUCT_DOMAIN) return null;
  return `${PRODUCT_ORIGIN}${input.pathname || "/"}${input.search || ""}`;
}

/**
 * R1/T2: plain-http request on the product domain (www or bare) that reached
 * the app → https://www, same path. Today Railway's edge answers http with a
 * 500 before the app sees it, so this is a backstop for when that is fixed.
 * /api/* is never redirected: Stripe and Resend webhooks and cron callers do
 * not follow redirects, so they are served as-is.
 */
export function httpsRedirect(input: {
  hostname: string | null;
  forwardedProto: string | null;
  pathname: string;
  search: string;
}): string | null {
  const host = (input.hostname || "").toLowerCase();
  if (host !== PRODUCT_DOMAIN && host !== `www.${PRODUCT_DOMAIN}`) return null;
  const proto = (input.forwardedProto || "").split(",")[0]?.trim().toLowerCase();
  if (proto !== "http") return null;
  if (input.pathname === "/api" || input.pathname.startsWith("/api/")) return null;
  return `${PRODUCT_ORIGIN}${input.pathname || "/"}${input.search || ""}`;
}
