import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncIcalConnection } from "@/lib/ical";

/**
 * Call periodically (e.g. every 15–30 min) via system cron or external ping:
 * curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-ical
 *
 * Fail closed: CRON_SECRET must be set and Authorization must match.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron is not configured (CRON_SECRET missing)" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.icalConnection.findMany({
    where: {
      enabled: true,
      importUrl: { not: null },
    },
  });

  const results = [];
  for (const c of connections) {
    const result = await syncIcalConnection(c.id);
    results.push({ id: c.id, name: c.name, ...result });
  }

  return NextResponse.json({ synced: results.length, results });
}
