/**
 * Host-configured automated messages for bookings.
 * Delivered into the guest’s in-app conversation (inbox).
 *
 * Default schedule (host-configurable hours; same for all listings):
 * 1. ON_BOOKING — when the guest books (confirmation)
 * 2. WEEK_BEFORE — ~7 days before check-in (invitation / what to expect)
 * 3. DAY_BEFORE — ~1 day before check-in (access instructions)
 *
 * Templates: host defaults apply to every listing. A listing can override
 * by setting its own body (and enable switch).
 */

import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/messaging";
import { formatTime12h } from "@/lib/utils";

export type AutoMessageKind = "ON_BOOKING" | "WEEK_BEFORE" | "DAY_BEFORE";

export type ListingMessageFields = {
  autoMsgOnBookingEnabled: boolean;
  autoMsgOnBookingBody: string | null;
  autoMsgWeekBeforeEnabled: boolean;
  autoMsgWeekBeforeBody: string | null;
  autoMsgDayBeforeEnabled: boolean;
  autoMsgDayBeforeBody: string | null;
};

export type HostMessageDefaults = {
  defaultAutoMsgOnBookingEnabled: boolean;
  defaultAutoMsgOnBookingBody: string | null;
  defaultAutoMsgWeekBeforeEnabled: boolean;
  defaultAutoMsgWeekBeforeBody: string | null;
  defaultAutoMsgDayBeforeEnabled: boolean;
  defaultAutoMsgDayBeforeBody: string | null;
  autoMsgWeekBeforeHours: number;
  autoMsgDayBeforeHours: number;
};

const KIND_META: Record<
  AutoMessageKind,
  {
    listingEnabled: keyof ListingMessageFields;
    listingBody: keyof ListingMessageFields;
    hostEnabled: keyof HostMessageDefaults;
    hostBody: keyof HostMessageDefaults;
    sentKey:
      | "autoMsgOnBookingSentAt"
      | "autoMsgWeekBeforeSentAt"
      | "autoMsgDayBeforeSentAt";
    subject: string;
    label: string;
  }
> = {
  ON_BOOKING: {
    listingEnabled: "autoMsgOnBookingEnabled",
    listingBody: "autoMsgOnBookingBody",
    hostEnabled: "defaultAutoMsgOnBookingEnabled",
    hostBody: "defaultAutoMsgOnBookingBody",
    sentKey: "autoMsgOnBookingSentAt",
    subject: "Booking confirmation",
    label: "On booking",
  },
  WEEK_BEFORE: {
    listingEnabled: "autoMsgWeekBeforeEnabled",
    listingBody: "autoMsgWeekBeforeBody",
    hostEnabled: "defaultAutoMsgWeekBeforeEnabled",
    hostBody: "defaultAutoMsgWeekBeforeBody",
    sentKey: "autoMsgWeekBeforeSentAt",
    subject: "Your stay is coming up",
    label: "1 week before",
  },
  DAY_BEFORE: {
    listingEnabled: "autoMsgDayBeforeEnabled",
    listingBody: "autoMsgDayBeforeBody",
    hostEnabled: "defaultAutoMsgDayBeforeEnabled",
    hostBody: "defaultAutoMsgDayBeforeBody",
    sentKey: "autoMsgDayBeforeSentAt",
    subject: "Access instructions for tomorrow",
    label: "1 day before",
  },
};

export const DEFAULT_WEEK_BEFORE_HOURS = 168;
export const DEFAULT_DAY_BEFORE_HOURS = 24;

export const STARTER_TEMPLATES: Record<AutoMessageKind, string> = {
  ON_BOOKING: `Hi {{guestName}}, thanks for booking {{propertyTitle}}!

We're glad you're staying with us. Check-in is {{checkIn}} at {{checkInTime}} (checkout {{checkOut}}).

We'll send a “what to expect” note about a week before your stay, and access instructions the day before.

— {{hostName}}`,
  WEEK_BEFORE: `Hi {{guestName}}, your stay at {{propertyTitle}} is about a week away!

What to expect:
• Check-in {{checkIn}} after {{checkInTime}}
• Guests on the reservation: {{guests}}
• We'll send door codes and access details the day before arrival

Reply here if you have questions about parking, pets, or arrival times.

— {{hostName}}`,
  DAY_BEFORE: `Hi {{guestName}}, see you tomorrow at {{propertyTitle}}!

Access instructions:
• Check-in after {{checkInTime}} on {{checkIn}}
• [Add door/gate code, parking, Wi‑Fi, and key details here]

Message us if you're running late. Safe travels!

— {{hostName}}`,
};

/** Combine check-in calendar date + property check-in clock (local). */
export function checkInDateTime(checkIn: Date, checkInTime: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec((checkInTime || "16:00").trim());
  const hours = m ? Number(m[1]) : 16;
  const minutes = m ? Number(m[2]) : 0;
  const d = new Date(checkIn);
  d.setHours(
    Number.isFinite(hours) ? hours : 16,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return d;
}

export function interpolateBookingMessage(
  template: string,
  vars: {
    guestName: string;
    propertyTitle: string;
    hostName: string;
    checkIn: Date;
    checkOut: Date;
    checkInTime?: string;
    guests?: number;
  },
): string {
  const checkInStr = vars.checkIn.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const checkOutStr = vars.checkOut.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  // Always 12-hour clock in guest messages (never "15:00")
  const checkInTime12 = vars.checkInTime
    ? formatTime12h(vars.checkInTime)
    : "";

  return template
    .replaceAll("{{guestName}}", vars.guestName)
    .replaceAll("{{propertyTitle}}", vars.propertyTitle)
    .replaceAll("{{hostName}}", vars.hostName)
    .replaceAll("{{checkIn}}", checkInStr)
    .replaceAll("{{checkOut}}", checkOutStr)
    .replaceAll("{{checkInTime}}", checkInTime12)
    .replaceAll(
      "{{guests}}",
      vars.guests != null ? String(vars.guests) : "",
    );
}

/**
 * Resolve template: listing body wins when set; otherwise host default.
 * Listing enable applies when listing body is set; host enable when using host body.
 */
export function resolveAutoMessageTemplate(
  kind: AutoMessageKind,
  listing: ListingMessageFields,
  host: HostMessageDefaults,
): { body: string; source: "listing" | "host" } | null {
  const meta = KIND_META[kind];
  const listingBody = (listing[meta.listingBody] as string | null)?.trim();
  const hostBody = (host[meta.hostBody] as string | null)?.trim();

  if (listingBody) {
    if (!listing[meta.listingEnabled]) return null;
    return { body: listingBody, source: "listing" };
  }
  if (hostBody && host[meta.hostEnabled]) {
    return { body: hostBody, source: "host" };
  }
  return null;
}

/**
 * Ensure a booking has an OPEN conversation, then post a HOST message.
 * Idempotent per kind via booking.autoMsg*SentAt flags.
 */
export async function deliverBookingAutoMessage(
  bookingId: string,
  kind: AutoMessageKind,
): Promise<{ sent: boolean; reason?: string; conversationId?: string }> {
  const meta = KIND_META[kind];

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { include: { host: true } },
      conversations: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!booking) return { sent: false, reason: "booking_missing" };
  if (booking.status === "CANCELLED") {
    return { sent: false, reason: "cancelled" };
  }

  if (booking[meta.sentKey]) {
    return { sent: false, reason: "already_sent" };
  }

  const property = booking.property;
  const host = property.host;
  const resolved = resolveAutoMessageTemplate(kind, property, host);
  if (!resolved) return { sent: false, reason: "disabled_or_empty" };

  const body = interpolateBookingMessage(resolved.body, {
    guestName: booking.guestName,
    propertyTitle: property.title,
    hostName: host.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    checkInTime: property.checkInTime,
    guests: booking.guests,
  });

  let conversationId = booking.conversations[0]?.id;

  if (!conversationId) {
    const created = await prisma.conversation.create({
      data: {
        hostId: property.hostId,
        propertyId: property.id,
        bookingId: booking.id,
        guestUserId: booking.userId,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        subject: `${meta.subject} · ${property.title}`,
        lastMessageAt: new Date(),
      },
    });
    conversationId = created.id;
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderRole: "HOST",
      body,
      channel: "IN_APP",
      externalStatus: "auto",
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { [meta.sentKey]: new Date() },
  });

  await dispatchEmail({
    to: booking.guestEmail,
    subject: `${host.name}: ${meta.subject}`,
    body: `${body}\n\n— View and reply in your Yall Come Back inbox`,
    conversationId,
  });

  return { sent: true, conversationId };
}

/**
 * Cron: send week-before and day-before templates for upcoming confirmed stays.
 * Windows are wide enough for a ~15–30 min cron.
 */
export async function processScheduledBookingMessages(now = new Date()) {
  const results = {
    weekBefore: { candidates: 0, sent: 0, skipped: 0 },
    dayBefore: { candidates: 0, sent: 0, skipped: 0 },
  };

  // Horizon: a bit past 7 days so week-before windows are covered
  const horizon = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000);
  const pastGrace = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      checkIn: { gte: pastGrace, lte: horizon },
      OR: [
        { autoMsgWeekBeforeSentAt: null },
        { autoMsgDayBeforeSentAt: null },
      ],
    },
    include: {
      property: {
        include: {
          host: {
            select: {
              defaultAutoMsgOnBookingEnabled: true,
              defaultAutoMsgOnBookingBody: true,
              defaultAutoMsgWeekBeforeEnabled: true,
              defaultAutoMsgWeekBeforeBody: true,
              defaultAutoMsgDayBeforeEnabled: true,
              defaultAutoMsgDayBeforeBody: true,
              autoMsgWeekBeforeHours: true,
              autoMsgDayBeforeHours: true,
            },
          },
        },
      },
    },
  });

  for (const b of bookings) {
    const host = b.property.host;
    const weekHours = Math.max(
      24,
      host.autoMsgWeekBeforeHours || DEFAULT_WEEK_BEFORE_HOURS,
    );
    const dayHours = Math.max(
      1,
      Math.min(
        weekHours - 1,
        host.autoMsgDayBeforeHours || DEFAULT_DAY_BEFORE_HOURS,
      ),
    );

    const checkInAt = checkInDateTime(b.checkIn, b.property.checkInTime);
    const msUntil = checkInAt.getTime() - now.getTime();
    const hoursUntil = msUntil / (60 * 60 * 1000);

    // Week-before: within ±4h of target hours before check-in, until day window
    if (!b.autoMsgWeekBeforeSentAt) {
      const weekResolved = resolveAutoMessageTemplate(
        "WEEK_BEFORE",
        b.property,
        host,
      );
      if (weekResolved) {
        const upper = weekHours + 4;
        const lower = dayHours + 0.5;
        if (hoursUntil <= upper && hoursUntil > lower) {
          results.weekBefore.candidates += 1;
          const r = await deliverBookingAutoMessage(b.id, "WEEK_BEFORE");
          if (r.sent) results.weekBefore.sent += 1;
          else results.weekBefore.skipped += 1;
        }
      }
    }

    // Day-before: within ~4h after target until check-in (+1h grace)
    if (!b.autoMsgDayBeforeSentAt) {
      const dayResolved = resolveAutoMessageTemplate(
        "DAY_BEFORE",
        b.property,
        host,
      );
      if (dayResolved) {
        const upper = dayHours + 4;
        if (hoursUntil <= upper && hoursUntil > -1) {
          results.dayBefore.candidates += 1;
          const r = await deliverBookingAutoMessage(b.id, "DAY_BEFORE");
          if (r.sent) results.dayBefore.sent += 1;
          else results.dayBefore.skipped += 1;
        }
      }
    }
  }

  return results;
}

export { KIND_META };
