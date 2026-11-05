/**
 * Public marketplace text search. City / region / title / host / place name
 * only — never street address or postal code.
 *
 * Matching is case-insensitive substring (Prisma `mode: "insensitive"`), so
 * a partial like `cedar` hits the same stays as `Cedar Creek Lake`.
 */
export function marketplaceTextSearchOr(q: string) {
  const contains = { contains: q, mode: "insensitive" as const };
  return [
    { title: contains },
    { city: contains },
    { region: contains },
    { country: contains },
    { description: contains },
    { host: { name: contains } },
    { location: { name: contains } },
  ];
}

export const MARKETPLACE_PAGE_SIZE = 24;
export const MARKETPLACE_CANDIDATE_CAP = 200;
