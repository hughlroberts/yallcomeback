/**
 * CSS variable holding the sticky site header's measured height (set by
 * HeaderHeightVar). Sticky elements use it with a fallback of the desktop
 * header's min height plus border: var(--site-header-h, calc(5.5rem + 1px)).
 */
export const SITE_HEADER_HEIGHT_VAR = "--site-header-h";
