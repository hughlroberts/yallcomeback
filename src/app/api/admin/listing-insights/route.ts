import { NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getListingInsights } from "@/lib/listing-insights";

export const dynamic = "force-dynamic";

/** GET ?ids=a,b,c&days=30 — host-scoped listing Insights JSON */
export async function GET(req: Request) {
  const access = await requireHostAdmin();
  if (!access) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const days = Number(url.searchParams.get("days") || "30");

  if (ids.length === 0) {
    return NextResponse.json({ error: "missing_ids" }, { status: 400 });
  }

  // Scope: platform admin any; host only own properties
  const allowed = await prisma.property.findMany({
    where: {
      id: { in: ids },
      ...(access.isPlatform ? {} : { hostId: access.hostId || "__none__" }),
    },
    select: { id: true },
  });
  const allowedIds = allowed.map((p) => p.id);
  if (allowedIds.length === 0) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data = await getListingInsights(allowedIds, days);
  return NextResponse.json(data);
}
