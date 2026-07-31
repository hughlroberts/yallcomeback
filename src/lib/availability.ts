import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { datesOverlap, startOfDay } from "./utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getUnavailableRanges(propertyId: string) {
  const blocks = await prisma.calendarBlock.findMany({
    where: { propertyId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      source: true,
      blockType: true,
      occupantName: true,
      notes: true,
    },
    orderBy: { startDate: "asc" },
  });

  return blocks;
}

/** Public-safe ranges - no notes or occupant names */
export async function getPublicUnavailableRanges(propertyId: string) {
  const blocks = await prisma.calendarBlock.findMany({
    where: { propertyId },
    select: {
      startDate: true,
      endDate: true,
    },
    orderBy: { startDate: "asc" },
  });
  return blocks.map((b) => ({
    startDate: b.startDate.toISOString().slice(0, 10),
    endDate: b.endDate.toISOString().slice(0, 10),
  }));
}

export async function isRangeAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
  /** Pass transaction client so availability is re-checked in the same TX */
  db: DbClient = prisma,
): Promise<boolean> {
  const blocks = await db.calendarBlock.findMany({
    where: {
      propertyId,
      ...(excludeBookingId
        ? { NOT: { bookingId: excludeBookingId } }
        : {}),
    },
  });

  return !blocks.some((b) =>
    datesOverlap(checkIn, checkOut, b.startDate, b.endDate)
  );
}

export function expandBlockedDates(
  ranges: { startDate: string | Date; endDate: string | Date }[]
): Set<string> {
  const blocked = new Set<string>();
  for (const r of ranges) {
    const start = startOfDay(new Date(r.startDate));
    const end = startOfDay(new Date(r.endDate));
    // block nights: start inclusive, end exclusive (checkout free)
    const cur = new Date(start);
    while (cur < end) {
      blocked.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return blocked;
}
