/**
 * When a client-side route change should jump to the top of the page.
 *
 * Next.js only scrolls when the new page's top edge is out of view at commit
 * time. On iPhone that check can pass while the page is still settling
 * (hero images, fonts, the sticky header, the shorter document clamping the
 * old scroll offset), which leaves the new page open partway down. We reset
 * explicitly on every pathname change, except:
 * - back/forward (the browser and Next restore the old position), and
 * - hash links (#reserve etc. should land on their target).
 */
export function shouldResetScroll(opts: {
  prevPath: string | null;
  nextPath: string;
  hash: string;
  wasBackForward: boolean;
}): boolean {
  if (opts.prevPath === null) return false; // first render: leave as loaded
  if (opts.prevPath === opts.nextPath) return false; // query-only or same page
  if (opts.wasBackForward) return false;
  if (opts.hash && opts.hash !== "#") return false;
  return true;
}
