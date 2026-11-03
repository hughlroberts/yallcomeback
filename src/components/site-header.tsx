import { BrandLogo } from "@/components/brand-logo";
import { HeaderHeightVar } from "@/components/header-height-var";
import { SiteHeaderNav } from "@/components/site-header-nav";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import {
  isListingSetupPath,
  LISTING_SETUP_EXIT_HREF,
  LISTING_SETUP_EXIT_LABEL,
} from "@/lib/listing-setup-path";

export async function SiteHeader() {
  const session = await auth();

  let avatarUrl: string | null = null;
  if (session?.user?.hostId) {
    try {
      const host = await prisma.host.findUnique({
        where: { id: session.user.hostId },
        select: { logoUrl: true },
      });
      avatarUrl = host?.logoUrl ?? null;
    } catch {
      avatarUrl = null;
    }
  }

  // Listing setup: the logo exits setup (same as Save & exit). Its name was
  // "Yall Come Back, home", which reads like a second Back link next to the
  // step Back link.
  let inListingSetup = false;
  try {
    inListingSetup = isListingSetupPath((await headers()).get("x-pathname"));
  } catch {
    inListingSetup = false;
  }

  const isHostOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "HOST";

  return (
    <header className="sticky top-0 z-[200] overflow-visible border-b border-hairline/80 bg-buttermilk/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <HeaderHeightVar />
      {/* min-height (not fixed h) + py so a taller cannon never gets cut top/bottom */}
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-2 overflow-visible px-3 py-2 sm:min-h-[4.75rem] sm:gap-4 sm:px-6 sm:py-2.5 md:min-h-[5.5rem] md:py-3">
        {inListingSetup ? (
          <BrandLogo
            href={LISTING_SETUP_EXIT_HREF}
            label={LISTING_SETUP_EXIT_LABEL}
          />
        ) : (
          <BrandLogo />
        )}
        <SiteHeaderNav
          isSignedIn={Boolean(session?.user)}
          isHostOrAdmin={isHostOrAdmin}
          staffLink={
            session?.user?.role === "ADMIN"
              ? { href: "/ops", label: "Platform admin" }
              : null
          }
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          avatarUrl={avatarUrl}
        />
      </div>
    </header>
  );
}
