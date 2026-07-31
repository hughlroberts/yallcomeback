import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";

export default async function AdminHostingPlansPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/hosting/plans");

  if (access.isPlatform) {
    redirect("/ops/hosting/plans");
  }

  redirect("/admin/hosting");
}
