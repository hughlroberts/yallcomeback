import { prisma } from "./db";
import { startOfDay } from "./utils";

function formatIcalDate(date: Date): string {
  const d = startOfDay(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Export local bookings + manual blocks for a property (not ICAL_IMPORT to avoid loops) */
export async function buildPropertyIcal(
  propertyId: string,
  propertyTitle: string
): Promise<string> {
  const blocks = await prisma.calendarBlock.findMany({
    where: {
      propertyId,
      source: { in: ["MANUAL", "BOOKING"] },
    },
    orderBy: { startDate: "asc" },
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yall Come Back//Vacation Rentals//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(propertyTitle)}`,
  ];

  for (const block of blocks) {
    const summary =
      block.source === "BOOKING"
        ? "Booked"
        : block.occupantName
          ? `Reserved - ${block.occupantName}`
          : block.blockType
            ? `Blocked - ${block.blockType}`
            : "Blocked";

    lines.push(
      "BEGIN:VEVENT",
      `UID:${block.id}@yallcomeback.com`,
      `DTSTAMP:${formatIcalDate(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${formatIcalDate(block.startDate)}`,
      `DTEND;VALUE=DATE:${formatIcalDate(block.endDate)}`,
      `SUMMARY:${escapeText(summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

type ParsedEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary?: string;
};

export function parseIcalEvents(ics: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const blocks = ics.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const part = blocks[i].split("END:VEVENT")[0];
    const get = (key: string) => {
      const re = new RegExp(`^${key}[^:]*:(.+)$`, "mi");
      const m = part.match(re);
      return m?.[1]?.trim();
    };
    const uid = get("UID") || `import-${i}-${Date.now()}`;
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");
    if (!dtstart) continue;

    const parseDate = (raw: string) => {
      const clean = raw.replace(/[^0-9T]/g, "").slice(0, 8);
      const y = Number(clean.slice(0, 4));
      const m = Number(clean.slice(4, 6)) - 1;
      const d = Number(clean.slice(6, 8));
      return new Date(Date.UTC(y, m, d));
    };

    const start = parseDate(dtstart);
    const end = dtend ? parseDate(dtend) : new Date(start.getTime() + 86400000);
    events.push({
      uid,
      start,
      end,
      summary: get("SUMMARY"),
    });
  }
  return events;
}

export async function syncIcalConnection(connectionId: string) {
  const connection = await prisma.icalConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection?.importUrl || !connection.enabled) {
    return { ok: false as const, error: "No import URL or disabled" };
  }

  try {
    const res = await fetch(connection.importUrl, {
      headers: { "User-Agent": "Yall Come Back-iCal-Sync/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ics = await res.text();
    const events = parseIcalEvents(ics);
    const uids = events.map((e) => e.uid);

    await prisma.calendarBlock.deleteMany({
      where: {
        connectionId: connection.id,
        source: "ICAL_IMPORT",
        ...(uids.length ? { externalUid: { notIn: uids } } : {}),
      },
    });

    for (const event of events) {
      const existing = await prisma.calendarBlock.findFirst({
        where: {
          connectionId: connection.id,
          externalUid: event.uid,
        },
      });

      if (existing) {
        await prisma.calendarBlock.update({
          where: { id: existing.id },
          data: {
            startDate: event.start,
            endDate: event.end,
            notes: event.summary
              ? `Imported: ${event.summary}`
              : "Imported from calendar",
          },
        });
      } else {
        await prisma.calendarBlock.create({
          data: {
            propertyId: connection.propertyId,
            connectionId: connection.id,
            source: "ICAL_IMPORT",
            externalUid: event.uid,
            startDate: event.start,
            endDate: event.end,
            notes: event.summary
              ? `Imported: ${event.summary}`
              : "Imported from calendar",
            blockType: "OTHER",
          },
        });
      }
    }

    await prisma.icalConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });

    return { ok: true as const, count: events.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await prisma.icalConnection.update({
      where: { id: connection.id },
      data: { lastSyncError: message },
    });
    return { ok: false as const, error: message };
  }
}
