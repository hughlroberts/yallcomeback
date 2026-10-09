/**
 * Public marketplace text search. City / region / title / host / place name
 * only — never street address or postal code.
 */
export function marketplaceTextSearchOr(q: string) {
  return [
    { title: { contains: q } },
    { city: { contains: q } },
    { region: { contains: q } },
    { country: { contains: q } },
    { description: { contains: q } },
    { host: { name: { contains: q } } },
    { location: { name: { contains: q } } },
  ];
}

export const MARKETPLACE_PAGE_SIZE = 24;
export const MARKETPLACE_CANDIDATE_CAP = 200;
