import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingImportAgent } from "@/components/listing-import-agent";
import { ListingWizardTypeStep } from "@/components/listing-wizard-type-step";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create listing" };

export default async function NewListingWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ importUrl?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties/new");

  const sp = await searchParams;

  const hosts = access.isPlatform
    ? await prisma.host.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const defaultImportUrl =
    sp.importUrl?.trim() ||
    "https://www.airbnb.com/rooms/600541790815158094";

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm text-ink-muted">
          <Link href="/admin/properties" className="text-bonnet hover:underline">
            ← Properties
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Create a listing
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Import from Airbnb/VRBO in one step, or start a blank wizard.
        </p>
      </div>

      <ListingImportAgent
        hostId={access.hostId || undefined}
        hosts={hosts}
        defaultUrl={defaultImportUrl}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[var(--background)] px-3 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Or start from scratch
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
        <ListingWizardTypeStep
          hostId={access.hostId || undefined}
          hosts={hosts}
        />
      </div>
    </div>
  );
}
