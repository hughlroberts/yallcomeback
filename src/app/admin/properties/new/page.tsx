import { redirect } from "next/navigation";
import { ListingWizardTypeStep } from "@/components/listing-wizard-type-step";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create listing" };

export default async function NewListingWizardPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties/new");

  const hosts = access.isPlatform
    ? await prisma.host.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  return (
    <ListingWizardTypeStep
      hostId={access.hostId || undefined}
      hosts={hosts}
    />
  );
}
