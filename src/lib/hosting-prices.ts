/**
 * Published hosted prices. Keep website, help, agent briefs, and HostingPlan
 * seed/upsert in sync with these numbers.
 *
 * Open-source MIT software is the only free product ($0 platform fee when you
 * run it yourself). Marketplace listing on yallcomeback.app and branded
 * websites are paid.
 */
export const MARKETPLACE_LISTING_USD = 12;
export const BRANDED_WEBSITE_USD = 25;

export const MARKETPLACE_PLAN_DESCRIPTION =
  `$${MARKETPLACE_LISTING_USD} per published listing / month. List on Find a Place. No custom brand website. Not a booking commission.`;

export const BRANDED_PLAN_DESCRIPTION =
  `$${BRANDED_WEBSITE_USD} / month for the whole website — any number of listings. Brand site on your domain; marketplace listing included. Not a booking commission.`;
