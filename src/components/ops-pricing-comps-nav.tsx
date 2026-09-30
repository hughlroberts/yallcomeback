"use client";

import { NavLink } from "@/components/nav-link";

/**
 * Sub-nav under Ops → Pricing comps. Intelligence is nested here, not a
 * top-level Ops tab, until Hugh publishes it elsewhere.
 */
export function OpsPricingCompsNav() {
  return (
    <nav
      className="flex flex-wrap items-center gap-0.5"
      aria-label="Pricing comps sections"
    >
      <NavLink href="/ops/pricing-comps" exact variant="solid">
        Market comps
      </NavLink>
      <NavLink href="/ops/pricing-comps/intelligence" variant="solid">
        Intelligence
      </NavLink>
    </nav>
  );
}
