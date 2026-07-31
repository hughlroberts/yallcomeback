import { redirect } from "next/navigation";
import { AdminHostGuestMessages } from "@/components/admin-host-guest-messages";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message templates · Admin" };

export default async function AdminGuestMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    applied?: string;
    hostId?: string;
  }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "HOST")
  ) {
    redirect("/login?callbackUrl=/admin/guest-messages");
  }

  const sp = await searchParams;
  let hostId = session.user.hostId ?? null;

  if (session.user.role === "ADMIN") {
    if (sp.hostId) {
      hostId = sp.hostId;
    } else if (!hostId) {
      const first = await prisma.host.findFirst({
        orderBy: { name: "asc" },
        select: { id: true },
      });
      hostId = first?.id ?? null;
    }
  }

  if (!hostId) {
    return (
      <div className="max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-semibold">No host account found</p>
        <p className="mt-1">
          Guest message defaults are set per host brand. Create or approve a host
          first.
        </p>
      </div>
    );
  }

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { _count: { select: { properties: true } } },
  });
  if (!host) redirect("/admin");

  return (
    <AdminHostGuestMessages
      host={{
        id: host.id,
        name: host.name,
        defaultAutoMsgOnBookingEnabled: host.defaultAutoMsgOnBookingEnabled,
        defaultAutoMsgOnBookingBody: host.defaultAutoMsgOnBookingBody,
        defaultAutoMsgWeekBeforeEnabled: host.defaultAutoMsgWeekBeforeEnabled,
        defaultAutoMsgWeekBeforeBody: host.defaultAutoMsgWeekBeforeBody,
        defaultAutoMsgDayBeforeEnabled: host.defaultAutoMsgDayBeforeEnabled,
        defaultAutoMsgDayBeforeBody: host.defaultAutoMsgDayBeforeBody,
        autoMsgWeekBeforeHours: host.autoMsgWeekBeforeHours,
        autoMsgDayBeforeHours: host.autoMsgDayBeforeHours,
      }}
      listingCount={host._count.properties}
      saved={sp.saved}
      error={sp.error}
      applied={sp.applied}
    />
  );
}
