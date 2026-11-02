/** Form field names shared by the web form (client) and server checks. */
/** Hidden field real people never see or fill. */
export const HONEYPOT_FIELD = "company_website";
export const STAMP_FIELD = "form_stamp";
export const TURNSTILE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ACTION = "inquiry";

/** Faster than this from opening the form to sending looks automated. */
export const MIN_FILL_MS = 3_000;
