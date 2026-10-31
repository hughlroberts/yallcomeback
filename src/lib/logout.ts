/** Helpers for the POST /logout route (kept pure for tests). */

/** Session cookie names Auth.js may use, including chunked parts (.0, .1…). */
export function isSessionCookieName(name: string): boolean {
  return /^(__Secure-|__Host-)?(authjs|next-auth)\.session-token(\.\d+)?$/.test(
    name,
  );
}

/**
 * Only accept logout posts from our own pages. Browsers send Origin on
 * POST; Sec-Fetch-Site is a fallback when Origin is missing.
 */
export function isSameOriginRequest(input: {
  origin: string | null;
  secFetchSite: string | null;
  host: string | null;
}): boolean {
  const { origin, secFetchSite, host } = input;
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }
  return false;
}
