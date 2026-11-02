/**
 * Transactional booking emails, sent with the shared platform email helper
 * (dispatchPlatformEmail → Resend/SMTP, same keys as signup mail).
 *
 * - At booking time: guest gets "request received" / "booking confirmed"
 *   with the manage/cancel link; every host on the brand (owner contact email
 *   + co-host users) gets a new-request email.
 * - On cancel (guest, host, or system): guest and every host get an email.
 *
 * - When a host marks a manual deposit paid: guest gets the same
 *   "booking confirmed" email the card (webhook) path sends.
 *
 * Each send is claimed once per booking (bookingEmailsSentAt /
 * confirmationEmailSentAt / cancellationEmailsSentAt) so webhook retries and
 * double clicks do not double-send. Email failures are logged and never break
 * the booking or cancel.
 */
import { prisma } from "@/lib/db";
import { bookingAccessToken } from "@/lib/booking-access";
import { replyAddressFor } from "@/lib/inbound/reply-address";
import { dispatchPlatformEmail, messagingSiteOrigin } from "@/lib/messaging";
import { formatDateRangeUS, formatMoney } from "@/lib/utils";
import {
  dedupeEmails,
  hostEmailRecipients,
  maskEmail,
} from "@/lib/host-recipients";
import {
  guestCancelWindow,
  REFUND_PROCESS_TEXT,
} from "@/lib/guest-cancel-window";

export type CancelledBy = "GUEST" | "HOST" | "SYSTEM";

export type BookingEmailData = {
  id: string;
  status: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guests: number;
  pets: number;
  nights: number;
  checkIn: Date;
  checkOut: Date;
  createdAt: Date;
  totalAmount: number;
  depositAmount: number;
  guestNotes: string | null;
  cancelReason?: string | null;
  property: {
    title: string;
    hostId: string;
    checkInTime: string;
    cancellationPolicy: string;
    longTermCancellationPolicy: string;
    host: { name: string };
  };
  payments: {
    method: string;
    status: string;
    amount: number;
    notes: string | null;
    refundedAmount: number | null;
  }[];
};

export type OutgoingEmail = { to: string; subject: string; text: string };

export function manageBookingUrl(bookingId: string): string {
  return `${messagingSiteOrigin()}/book/confirmation/${bookingId}?t=${bookingAccessToken(bookingId)}`;
}

export function cancelBookingUrl(bookingId: string): string {
  return `${manageBookingUrl(bookingId)}&cancel=1`;
}

export function adminBookingUrl(bookingId: string): string {
  return `${messagingSiteOrigin()}/admin/bookings/${bookingId}`;
}

/** Every host on the brand (see host-recipients.ts). */
export async function bookingHostRecipients(hostId: string): Promise<string[]> {
  return hostEmailRecipients(hostId);
}

export { dedupeEmails };

const bookingSelect = {
  id: true,
  status: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  guests: true,
  pets: true,
  nights: true,
  checkIn: true,
  checkOut: true,
  createdAt: true,
  totalAmount: true,
  depositAmount: true,
  guestNotes: true,
  cancelReason: true,
  property: {
    select: {
      title: true,
      hostId: true,
      checkInTime: true,
      cancellationPolicy: true,
      longTermCancellationPolicy: true,
      host: { select: { name: true } },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      method: true,
      status: true,
      amount: true,
      notes: true,
      refundedAmount: true,
    },
  },
};

function shortRef(id: string) {
  return id.slice(0, 8);
}

function paymentState(b: BookingEmailData): {
  label: string;
  paid: boolean;
  request: boolean;
} {
  const p = b.payments[0];
  const paid = b.payments.some((x) => x.status === "PAID");
  const request =
    p?.method === "MANUAL" && Boolean(p.notes?.startsWith("Request to book"));
  if (paid)
    return {
      label: `Deposit ${formatMoney(b.depositAmount)} paid`,
      paid,
      request,
    };
  if (request)
    return { label: "Request to book (nothing charged yet)", paid, request };
  if (p?.method === "BITCOIN")
    return {
      label: `Bitcoin deposit ${formatMoney(b.depositAmount)} pending`,
      paid,
      request,
    };
  if (p?.method === "STRIPE")
    return {
      label: `Card deposit ${formatMoney(b.depositAmount)} pending`,
      paid,
      request,
    };
  return {
    label: `Deposit ${formatMoney(b.depositAmount)} to be arranged with the host`,
    paid,
    request,
  };
}

function detailLines(b: BookingEmailData): string[] {
  const party =
    `${b.guests} guest${b.guests === 1 ? "" : "s"}` +
    (b.pets > 0 ? `, ${b.pets} pet${b.pets === 1 ? "" : "s"}` : "");
  return [
    `Stay: ${b.property.title}`,
    `Dates: ${formatDateRangeUS(b.checkIn, b.checkOut)} (${b.nights} night${b.nights === 1 ? "" : "s"})`,
    `Guests: ${party}`,
    `Total: ${formatMoney(b.totalAmount)} · Deposit: ${formatMoney(b.depositAmount)}`,
    `Payment: ${paymentState(b).label}`,
    `Reference: ${shortRef(b.id)}`,
  ];
}

function cancelRuleLine(b: BookingEmailData, now: Date): string {
  const w = guestCancelWindow({
    nights: b.nights,
    checkIn: b.checkIn,
    createdAt: b.createdAt,
    checkInTime: b.property.checkInTime,
    cancellationPolicy: b.property.cancellationPolicy,
    longTermCancellationPolicy: b.property.longTermCancellationPolicy,
    now,
  });
  if (!w.canCancelOnline) {
    return `Cancellation policy: ${w.policyName}. The online cancel window has passed, so contact the host to cancel.`;
  }
  const until = w.deadline.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const free =
    w.freeCancelUntil && now < w.freeCancelUntil
      ? ` 24-hour free cancellation: cancel by ${w.freeCancelUntil.toLocaleString(
          "en-US",
          {
            timeZone: "America/Chicago",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          },
        )} (Central) for a full refund of anything you paid.`
      : "";
  return `Cancellation policy: ${w.policyName}. You can cancel online until ${until} (Central). After that, contact the host to cancel.${free}`;
}

/** Guest + host emails right after a booking or request is made. */
export function composeBookingCreatedEmails(
  b: BookingEmailData,
  hosts: string[],
  now: Date = new Date(),
): OutgoingEmail[] {
  const pay = paymentState(b);
  const confirmed = b.status === "CONFIRMED";
  const title = b.property.title;
  const guestSubject = confirmed
    ? `Booking confirmed: ${title}`
    : pay.request
      ? `Request received: ${title}`
      : `Booking received: ${title}`;
  const intro = confirmed
    ? `Your stay at ${title} is confirmed. Your deposit is paid.`
    : pay.request
      ? `Your request to book ${title} is in. Nothing was charged. ${b.property.host.name} will review it and arrange the deposit with you after they approve.`
      : `We've reserved ${title} for your dates. The host will confirm your deposit.`;
  const guestText = [
    `Hi ${b.guestName},`,
    "",
    intro,
    "",
    ...detailLines(b),
    "",
    cancelRuleLine(b, now),
    REFUND_PROCESS_TEXT,
    "",
    `View or manage your booking: ${manageBookingUrl(b.id)}`,
    `Cancel this ${confirmed ? "booking" : "request"}: ${cancelBookingUrl(b.id)}`,
    "",
    "Keep this email. The links above are private to you.",
  ].join("\n");

  const hostSubject = confirmed
    ? `New booking: ${title}, ${formatDateRangeUS(b.checkIn, b.checkOut)}`
    : `New booking request: ${title}, ${formatDateRangeUS(b.checkIn, b.checkOut)}`;
  const hostText = [
    confirmed
      ? `${b.guestName} booked ${title} and paid the deposit.`
      : `${b.guestName} sent a booking request for ${title}.`,
    "",
    ...detailLines(b),
    `Guest email: ${b.guestEmail}`,
    ...(b.guestPhone ? [`Guest phone: ${b.guestPhone}`] : []),
    ...(b.guestNotes ? ["", `Guest note: ${b.guestNotes}`] : []),
    "",
    `Open the booking: ${adminBookingUrl(b.id)}`,
  ].join("\n");

  return [
    { to: b.guestEmail, subject: guestSubject, text: guestText },
    ...hosts.map((to) => ({ to, subject: hostSubject, text: hostText })),
  ];
}

/** Guest + host emails after any cancel. */
export function composeCancellationEmails(
  b: BookingEmailData,
  hosts: string[],
  by: CancelledBy,
  opts: { refundedAmount?: number | null } = {},
): OutgoingEmail[] {
  const title = b.property.title;
  const dates = formatDateRangeUS(b.checkIn, b.checkOut);
  const paid = b.payments.some((p) => p.status === "PAID");
  const refunded =
    opts.refundedAmount ??
    b.payments.reduce((s, p) => s + (p.refundedAmount ?? 0), 0);
  const who =
    by === "GUEST"
      ? `${b.guestName} (the guest)`
      : by === "HOST"
        ? `the host (${b.property.host.name})`
        : "Yall Come Back automatically";
  const reason = b.cancelReason ? `Reason: ${b.cancelReason}` : null;

  let guestMoney: string;
  let hostMoney: string;
  if (refunded > 0) {
    guestMoney = `A refund of ${formatMoney(refunded)} was issued to your original payment method. It can take 5-10 business days to appear.`;
    hostMoney = `${formatMoney(refunded)} was refunded to the guest.`;
  } else if (paid) {
    guestMoney = `You paid a deposit. The host or Yall Come Back will process any refund your cancellation policy allows. Refunds are not automatic.`;
    hostMoney = `The guest paid a ${formatMoney(b.depositAmount)} deposit. Review the cancellation policy and process any refund it allows. This booking is flagged "Refund review" in your admin.`;
  } else {
    guestMoney = "No payment was taken, so there is nothing to refund.";
    hostMoney = "No payment had been taken.";
  }

  const guestText = [
    `Hi ${b.guestName},`,
    "",
    `Your ${b.status === "CONFIRMED" || paid ? "booking" : "booking request"} at ${title} for ${dates} was cancelled by ${by === "GUEST" ? "you" : who}.`,
    ...(reason ? [reason] : []),
    "",
    guestMoney,
    "",
    `Reference: ${shortRef(b.id)}`,
    `Booking details: ${manageBookingUrl(b.id)}`,
  ].join("\n");

  const hostText = [
    `The booking at ${title} for ${dates} was cancelled by ${who}.`,
    ...(reason ? [reason] : []),
    "",
    `Guest: ${b.guestName} <${b.guestEmail}>`,
    `Reference: ${shortRef(b.id)}`,
    "The dates are open on your calendar again.",
    hostMoney,
    "",
    `Open the booking: ${adminBookingUrl(b.id)}`,
  ].join("\n");

  const subject = `Cancelled: ${title}, ${dates}`;
  return [
    { to: b.guestEmail, subject, text: guestText },
    ...hosts.map((to) => ({ to, subject, text: hostText })),
  ];
}

async function sendAll(
  emails: OutgoingEmail[],
  tag: string,
  bookingId: string,
  guestEmail: string,
) {
  const results: string[] = [];
  const guest = guestEmail.trim().toLowerCase();
  for (const e of emails) {
    try {
      // Reply-by-email (when configured): replies land in the booking's
      // message thread instead of bouncing off a no-reply address.
      const role = e.to.trim().toLowerCase() === guest ? "GUEST" : "HOST";
      const r = await dispatchPlatformEmail({
        ...e,
        replyTo: replyAddressFor("b", bookingId, role),
      });
      results.push(`${maskEmail(e.to)}=${r.status}`);
      if (r.status !== "sent") {
        console.warn(
          `[booking-email:${tag}]`,
          bookingId,
          maskEmail(e.to),
          r.status,
          r.detail,
        );
      }
    } catch (err) {
      results.push(`${maskEmail(e.to)}=error`);
      console.error(`[booking-email:${tag}] failed`, bookingId, err);
    }
  }
  // One line per booking email batch so Railway logs show who was emailed.
  console.info(`[booking-email:${tag}]`, bookingId, results.join(" "));
}

/** Claim-once then send the booking-time emails. Never throws. */
export async function sendBookingCreatedEmails(
  bookingId: string,
): Promise<void> {
  try {
    const claimed = await prisma.booking.updateMany({
      where: { id: bookingId, bookingEmailsSentAt: null },
      data: { bookingEmailsSentAt: new Date() },
    });
    if (claimed.count === 0) return;
    const b = (await prisma.booking.findUnique({
      where: { id: bookingId },
      select: bookingSelect,
    })) as BookingEmailData | null;
    if (!b || b.status === "CANCELLED") return;
    const hosts = await bookingHostRecipients(b.property.hostId);
    let emails = composeBookingCreatedEmails(b, hosts);
    // A confirmed booking's guest email is the "booking confirmed" email.
    // Claim it too, so the mark-paid path never sends a second one.
    if (b.status === "CONFIRMED" && !(await claimConfirmationEmail(bookingId))) {
      emails = emails.slice(1);
    }
    await sendAll(emails, "created", bookingId, b.guestEmail);
  } catch (err) {
    console.error("[booking-email:created] failed", bookingId, err);
  }
}

/** Claim the guest "booking confirmed" email for a confirmed booking. */
async function claimConfirmationEmail(bookingId: string): Promise<boolean> {
  const claimed = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: "CONFIRMED",
      confirmationEmailSentAt: null,
    },
    data: { confirmationEmailSentAt: new Date() },
  });
  return claimed.count > 0;
}

/**
 * Host or admin marked the deposit paid: send the guest the same
 * "booking confirmed" email the card path sends. Claim-once, so a repeat
 * click or an earlier card confirmation never sends a duplicate. If the
 * booking-time emails never went out (for example an unpaid card checkout
 * the host settled by hand), hosts get the "new booking" email as well.
 * Never throws.
 */
export async function sendBookingConfirmedEmails(
  bookingId: string,
): Promise<void> {
  try {
    if (!(await claimConfirmationEmail(bookingId))) return;
    const createdClaim = await prisma.booking.updateMany({
      where: { id: bookingId, bookingEmailsSentAt: null },
      data: { bookingEmailsSentAt: new Date() },
    });
    const b = (await prisma.booking.findUnique({
      where: { id: bookingId },
      select: bookingSelect,
    })) as BookingEmailData | null;
    if (!b || b.status !== "CONFIRMED") return;
    const hosts =
      createdClaim.count > 0
        ? await bookingHostRecipients(b.property.hostId)
        : [];
    await sendAll(
      composeBookingCreatedEmails(b, hosts),
      "confirmed",
      bookingId,
      b.guestEmail,
    );
  } catch (err) {
    console.error("[booking-email:confirmed] failed", bookingId, err);
  }
}

/** Claim-once then send cancellation emails. Never throws. */
export async function sendCancellationEmails(
  bookingId: string,
  by: CancelledBy,
  opts: { refundedAmount?: number | null } = {},
): Promise<void> {
  try {
    const claimed = await prisma.booking.updateMany({
      where: { id: bookingId, cancellationEmailsSentAt: null },
      data: { cancellationEmailsSentAt: new Date() },
    });
    if (claimed.count === 0) return;
    const b = (await prisma.booking.findUnique({
      where: { id: bookingId },
      select: bookingSelect,
    })) as BookingEmailData | null;
    if (!b) return;
    const hosts = await bookingHostRecipients(b.property.hostId);
    await sendAll(
      composeCancellationEmails(b, hosts, by, opts),
      "cancelled",
      bookingId,
      b.guestEmail,
    );
  } catch (err) {
    console.error("[booking-email:cancelled] failed", bookingId, err);
  }
}
