import { NextRequest, NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import {
  availableTaxYears,
  getHostStayTaxRows,
  getIncomeReceivedRows,
  getOccupancyTaxRows,
  getTaxYearSummary,
  incomeCsv,
  occupancyCsv,
  stayLedgerCsv,
  summaryCsv,
} from "@/lib/tax-records";
import { prisma } from "@/lib/db";

function yearFrom(req: NextRequest): number {
  const y = Number(req.nextUrl.searchParams.get("year"));
  const allowed = availableTaxYears();
  if (allowed.includes(y)) return y;
  return new Date().getFullYear();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ kind: string }> },
) {
  const access = await requireHostAdmin();
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!access.hostId) {
    return NextResponse.json({ error: "Pick a host brand first." }, { status: 400 });
  }

  const { kind } = await ctx.params;
  const year = yearFrom(req);
  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    select: {
      taxLegalName: true,
      taxEntityType: true,
      taxFilingState: true,
      name: true,
    },
  });
  const profile = {
    legalName: host?.taxLegalName || host?.name || "",
    entityType: host?.taxEntityType || "",
    filingState: host?.taxFilingState || "",
  };

  let file: { filename: string; body: string };
  if (kind === "stays") {
    file = stayLedgerCsv(year, await getHostStayTaxRows(access, year));
  } else if (kind === "occupancy") {
    file = occupancyCsv(year, await getOccupancyTaxRows(access, year));
  } else if (kind === "income") {
    file = incomeCsv(year, await getIncomeReceivedRows(access, year));
  } else if (kind === "summary") {
    file = summaryCsv(year, await getTaxYearSummary(access, year), profile);
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
