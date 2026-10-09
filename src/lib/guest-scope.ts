/**
 * Guest records (bookings, tax worksheets, inbox) are owned by userId.
 * Matching on guestEmail is allowed only after the address is confirmed,
 * so signing up with someone else's email cannot list their stays.
 */

export function guestEmailClaimOk(
  email: string | null | undefined,
  emailVerifiedAt: Date | null | undefined,
): email is string {
  return Boolean(email && emailVerifiedAt);
}

export function guestOwnBookingOr(opts: {
  userId: string;
  email?: string | null;
  emailVerifiedAt?: Date | null;
}): Array<{ userId: string } | { guestEmail: string }> {
  const or: Array<{ userId: string } | { guestEmail: string }> = [
    { userId: opts.userId },
  ];
  if (guestEmailClaimOk(opts.email, opts.emailVerifiedAt)) {
    or.push({ guestEmail: opts.email });
  }
  return or;
}

export function guestOwnConversationOr(opts: {
  userId: string;
  email?: string | null;
  emailVerifiedAt?: Date | null;
}): Array<{ guestUserId: string } | { guestEmail: string }> {
  const or: Array<{ guestUserId: string } | { guestEmail: string }> = [
    { guestUserId: opts.userId },
  ];
  if (guestEmailClaimOk(opts.email, opts.emailVerifiedAt)) {
    or.push({ guestEmail: opts.email });
  }
  return or;
}
