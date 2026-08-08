import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import {
  canViewEarnings,
  resolveHostAccessInfo,
} from "@/lib/host-access";

export default async function EarningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/earnings");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canViewEarnings(info)) {
    redirect("/admin?error=limited");
  }

  return children;
}
