import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  availableTaxYears,
  getGuestStayRows,
  guestStayCsv,
} from "@/lib/tax-records";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const y = Number(req.nextUrl.searchParams.get("year"));
  const year = availableTaxYears().includes(y) ? y : new Date().getFullYear();
  const rows = await getGuestStayRows(
    session.user.id,
    session.user.email || null,
    year,
  );
  const file = guestStayCsv(year, rows);
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
