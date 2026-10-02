import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingImportAgent } from "@/components/listing-import-agent";
import { ListingWizardTypeStep } from "@/components/listing-wizard-type-step";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canUseListingImportAgent,
  isListingImportAgentEnabled,
} from "@/lib/platform-features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create listing" };

export default async function NewListingWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ importUrl?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties/new");

  const { canCreateListings, resolveHostAccessInfo } = await import(
    "@/lib/host-access"
  );
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canCreateListings(info)) {
    redirect("/admin/properties?error=limited");
  }
  const currentHost = access.hostId
    ? await prisma.host.findUnique({
        where: { id: access.hostId },
        select: {
          active: true,
          hostingMode: true,
          approvalStatus: true,
          subscriptionStatus: true,
        },
      })
    : null;
  if (access.hostId && !access.isPlatform && currentHost) {
    const { canHostAddFutureWork } = await import("@/lib/hosting");
    if (!canHostAddFutureWork(currentHost)) {
      redirect("/admin/properties?error=paused");
    }
  }

  const sp = await searchParams;

  const hosts = access.isPlatform
    ? await prisma.host.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, hostingMode: true },
      })
    : [];

  const showImport =
    isListingImportAgentEnabled() &&
    (access.isPlatform || canUseListingImportAgent(currentHost));
  const importHosts = hosts.filter((h) => h.hostingMode === "PLATFORM");
  const defaultImportUrl = sp.importUrl?.trim() || "";

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
          {showImport
            ? "Import from Airbnb/VRBO in one step, or start a blank wizard."
            : "Start a blank wizard."}
        </p>
      </div>

      {showImport ? (
        <ListingImportAgent
          hostId={access.hostId || undefined}
          hosts={importHosts}
          defaultUrl={defaultImportUrl}
        />
      ) : null}

      {showImport ? (
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
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
        <ListingWizardTypeStep
          hostId={access.hostId || undefined}
          hosts={hosts}
        />
      </div>
    </div>
  );
}
