import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildPropertyIcal } from "@/lib/ical";

export async function GET(
  _req: Request,
  context: { params: Promise<{ propertyId: string; secret: string }> }
) {
  const { propertyId, secret } = await context.params;
  const cleanSecret = secret.replace(/\.ics$/i, "");

  const connection = await prisma.icalConnection.findFirst({
    where: {
      propertyId,
      exportSecret: cleanSecret,
    },
    include: { property: true },
  });

  if (!connection) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = await buildPropertyIcal(
    connection.propertyId,
    connection.property.title
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${connection.property.slug}.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
