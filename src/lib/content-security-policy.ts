/**
 * Site-wide Content-Security-Policy (set in next.config.ts).
 *
 * Next hydration and JSON-LD need inline scripts. This still blocks
 * unexpected script hosts, plugins, and framing.
 *
 * form-action (T38b): hosting billing buttons post a plain form to
 * /api/billing/hosting, which answers 303 to Stripe's hosted Checkout or
 * Billing portal. Browsers apply form-action to every redirect after a form
 * submit, so with only 'self' the redirect is silently blocked: the button
 * spins and the page stays. Allow exactly those two hosted pages.
 */
export const FORM_ACTION_SOURCES = [
  "'self'",
  "https://checkout.stripe.com",
  "https://billing.stripe.com",
] as const;

export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `form-action ${FORM_ACTION_SOURCES.join(" ")}`,
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://www.openstreetmap.org https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");
