import { BrandLogo } from "@/components/brand-logo";
import { SiteHeaderNav } from "@/components/site-header-nav";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function SiteHeader() {
  const session = await auth();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

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

  const isHostOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "HOST";

  return (
    <header className="sticky top-0 z-[200] border-b border-hairline/80 bg-buttermilk/95 backdrop-blur-md">
      <div className="mx-auto flex h-[3.75rem] w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandLogo />
        <SiteHeaderNav
          isSignedIn={Boolean(session?.user)}
          isHostOrAdmin={isHostOrAdmin}
          isPlatformAdmin={session?.user?.role === "ADMIN"}
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          avatarUrl={avatarUrl}
          signOutAction={signOutAction}
        />
      </div>
    </header>
  );
}
