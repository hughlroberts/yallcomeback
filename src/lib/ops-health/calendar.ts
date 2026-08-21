import { prisma } from "@/lib/db";
import { datesOverlap, startOfDay } from "@/lib/utils";
import {
  ICAL_STALE_HOURS,
  STALE_PENDING_HOURS,
  type HealthFinding,
} from "./types";

function dayKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

function findingId(...parts: string[]): string {
  return parts.filter(Boolean).join(":");
}

export async function runCalendarChecks(opts?: {
  hostId?: string;
}): Promise<HealthFinding[]> {
  const findings: HealthFinding[] = [];
  const hostFilter = opts?.hostId ? { hostId: opts.hostId } : {};

  const lookback = new Date();
  lookback.setDate(lookback.getDate() - 7);

  const properties = await prisma.property.findMany({
    where: hostFilter,
    select: {
      id: true,
      title: true,
      slug: true,
      hostId: true,
      host: { select: { id: true, name: true, slug: true } },
    },
  });
  const propById = new Map(properties.map((p) => [p.id, p]));
  const propertyIds = properties.map((p) => p.id);
  if (propertyIds.length === 0) return findings;

  const blocks = await prisma.calendarBlock.findMany({
    where: {
      propertyId: { in: propertyIds },
      endDate: { gte: lookback },
    },
    select: {
      id: true,
      propertyId: true,
      startDate: true,
      endDate: true,
      source: true,
      bookingId: true,
      blockType: true,
      occupantName: true,
      booking: {
        select: {
          id: true,
          status: true,
          checkIn: true,
          checkOut: true,
          guestName: true,
        },
      },
    },
    orderBy: [{ propertyId: "asc" }, { startDate: "asc" }],
  });

  // Group by property for overlap scan
  const byProp = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const list = byProp.get(b.propertyId) || [];
    list.push(b);
    byProp.set(b.propertyId, list);
  }

  for (const [propertyId, list] of byProp) {
    const prop = propById.get(propertyId);
    if (!prop) continue;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (!datesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
          continue;
        }

        const bothBooking =
          a.source === "BOOKING" && b.source === "BOOKING";
        const channelVsBooking =
          (a.source === "BOOKING" && b.source !== "BOOKING") ||
          (b.source === "BOOKING" && a.source !== "BOOKING");

        if (bothBooking || (a.source !== "BOOKING" && b.source !== "BOOKING")) {
          findings.push({
            id: findingId("overlap", a.id, b.id),
            checkId: "overlap_blocks",
            severity: "critical",
            title: "Overlapping calendar blocks",
            detail: `${a.source} ${dayKey(a.startDate)}→${dayKey(a.endDate)} overlaps ${b.source} ${dayKey(b.startDate)}→${dayKey(b.endDate)}. Guests could be double-held or blocked twice.`,
            hostId: prop.host.id,
            hostName: prop.host.name,
            propertyId: prop.id,
            propertyTitle: prop.title,
            href: `/admin/properties/${prop.id}`,
            meta: {
              blockA: a.id,
              blockB: b.id,
              rangeA: `${dayKey(a.startDate)} → ${dayKey(a.endDate)}`,
              rangeB: `${dayKey(b.startDate)} → ${dayKey(b.endDate)}`,
            },
          });
        } else if (channelVsBooking) {
          findings.push({
            id: findingId("channel", a.id, b.id),
            checkId: "channel_overlap",
            severity: "warning",
            title: "External/manual block overlaps a booking",
            detail: `A ${a.source === "BOOKING" ? b.source : a.source} block overlaps a live booking hold. Check for an outside-channel double book.`,
            hostId: prop.host.id,
            hostName: prop.host.name,
            propertyId: prop.id,
            propertyTitle: prop.title,
            bookingId:
              a.source === "BOOKING"
                ? a.bookingId || undefined
                : b.bookingId || undefined,
            href: `/admin/properties/${prop.id}`,
            meta: {
              rangeA: `${dayKey(a.startDate)} → ${dayKey(a.endDate)}`,
              rangeB: `${dayKey(b.startDate)} → ${dayKey(b.endDate)}`,
            },
          });
        }
      }
    }
  }

  // Active bookings without a calendar block
  const activeBookings = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      propertyId: { in: propertyIds },
      checkOut: { gte: lookback },
    },
    select: {
      id: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
      propertyId: true,
      calendarBlock: { select: { id: true } },
      property: {
        select: {
          id: true,
          title: true,
          host: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const booking of activeBookings) {
    if (booking.calendarBlock) continue;
    findings.push({
      id: findingId("noblock", booking.id),
      checkId: "active_booking_no_block",
      severity: "critical",
      title: "Active booking has no calendar block",
      detail: `${booking.status} for ${booking.guestName} (${dayKey(booking.checkIn)}→${dayKey(booking.checkOut)}) is not holding nights. Another guest could book the same dates.`,
      hostId: booking.property.host.id,
      hostName: booking.property.host.name,
      propertyId: booking.property.id,
      propertyTitle: booking.property.title,
      bookingId: booking.id,
      href: `/admin/bookings/${booking.id}`,
    });
  }

  // BOOKING blocks orphaned / cancelled / date mismatch
  for (const b of blocks) {
    if (b.source !== "BOOKING") continue;
    const prop = propById.get(b.propertyId);
    if (!prop) continue;

    if (!b.bookingId || !b.booking) {
      findings.push({
        id: findingId("orphan-block", b.id),
        checkId: "booking_block_orphaned",
        severity: "critical",
        title: "Booking block with no booking row",
        detail: `Block ${dayKey(b.startDate)}→${dayKey(b.endDate)} is source BOOKING but has no linked booking. Nights are blocked without a guest record.`,
        hostId: prop.host.id,
        hostName: prop.host.name,
        propertyId: prop.id,
        propertyTitle: prop.title,
        href: `/admin/properties/${prop.id}`,
      });
      continue;
    }

    if (b.booking.status === "CANCELLED") {
      findings.push({
        id: findingId("cancel-block", b.id),
        checkId: "booking_block_orphaned",
        severity: "critical",
        title: "Cancelled booking still blocking nights",
        detail: `Booking ${b.booking.id} is CANCELLED but its calendar block remains (${dayKey(b.startDate)}→${dayKey(b.endDate)}).`,
        hostId: prop.host.id,
        hostName: prop.host.name,
        propertyId: prop.id,
        propertyTitle: prop.title,
        bookingId: b.booking.id,
        href: `/admin/bookings/${b.booking.id}`,
      });
      continue;
    }

    if (
      dayKey(b.startDate) !== dayKey(b.booking.checkIn) ||
      dayKey(b.endDate) !== dayKey(b.booking.checkOut)
    ) {
      findings.push({
        id: findingId("mismatch", b.id),
        checkId: "booking_dates_mismatch",
        severity: "warning",
        title: "Booking dates do not match calendar block",
        detail: `Booking ${dayKey(b.booking.checkIn)}→${dayKey(b.booking.checkOut)} vs block ${dayKey(b.startDate)}→${dayKey(b.endDate)}.`,
        hostId: prop.host.id,
        hostName: prop.host.name,
        propertyId: prop.id,
        propertyTitle: prop.title,
        bookingId: b.booking.id,
        href: `/admin/bookings/${b.booking.id}`,
      });
    }
  }

  // Stale pending holds
  const staleBefore = new Date(
    Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000,
  );
  const stalePending = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: staleBefore },
      propertyId: { in: propertyIds },
      checkOut: { gte: lookback },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      createdAt: true,
      property: {
        select: {
          id: true,
          title: true,
          host: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const booking of stalePending) {
    const ageH = Math.round(
      (Date.now() - booking.createdAt.getTime()) / (60 * 60 * 1000),
    );
    findings.push({
      id: findingId("stale", booking.id),
      checkId: "stale_pending_hold",
      severity: "warning",
      title: `Pending payment hold older than ${STALE_PENDING_HOURS}h`,
      detail: `${booking.guestName} request is ${ageH}h old and still holds ${dayKey(booking.checkIn)}→${dayKey(booking.checkOut)}.`,
      hostId: booking.property.host.id,
      hostName: booking.property.host.name,
      propertyId: booking.property.id,
      propertyTitle: booking.property.title,
      bookingId: booking.id,
      href: `/admin/bookings/${booking.id}`,
    });
  }

  // iCal sync health
  const icalStaleBefore = new Date(
    Date.now() - ICAL_STALE_HOURS * 60 * 60 * 1000,
  );
  const connections = await prisma.icalConnection.findMany({
    where: {
      enabled: true,
      propertyId: { in: propertyIds },
    },
    select: {
      id: true,
      name: true,
      lastSyncedAt: true,
      lastSyncError: true,
      property: {
        select: {
          id: true,
          title: true,
          host: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const c of connections) {
    if (c.lastSyncError) {
      findings.push({
        id: findingId("ical-err", c.id),
        checkId: "ical_sync_error",
        severity: "warning",
        title: "Calendar import sync error",
        detail: `${c.name}: ${c.lastSyncError.slice(0, 200)}`,
        hostId: c.property.host.id,
        hostName: c.property.host.name,
        propertyId: c.property.id,
        propertyTitle: c.property.title,
        href: `/admin/properties/${c.property.id}`,
      });
    } else if (!c.lastSyncedAt || c.lastSyncedAt < icalStaleBefore) {
      findings.push({
        id: findingId("ical-stale", c.id),
        checkId: "ical_sync_error",
        severity: "warning",
        title: `Calendar import not synced in ${ICAL_STALE_HOURS}h`,
        detail: `${c.name} last synced: ${c.lastSyncedAt ? c.lastSyncedAt.toISOString() : "never"}.`,
        hostId: c.property.host.id,
        hostName: c.property.host.name,
        propertyId: c.property.id,
        propertyTitle: c.property.title,
        href: `/admin/properties/${c.property.id}`,
      });
    }
  }

  return findings;
}
