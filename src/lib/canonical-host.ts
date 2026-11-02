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
