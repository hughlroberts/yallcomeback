import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildUsersCsv, usersCsvFilename } from "@/lib/users-csv";

export const dynamic = "force-dynamic";

/** Platform ops: download every user as CSV (email, host/guest). */
export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { email: true, role: true, hostId: true },
  });

  return new NextResponse(buildUsersCsv(users), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${usersCsvFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
