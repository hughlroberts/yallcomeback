import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "HOST")
  ) {
    redirect("/login?callbackUrl=/admin");
  }

  const isPlatform = session.user.role === "ADMIN";
  const links = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/properties", label: "Properties" },
    { href: "/admin/magnets", label: "Fridge magnets" },
    { href: "/admin/bookings", label: "Bookings" },
    { href: "/admin/earnings", label: "Earnings" },
    { href: "/admin/messages", label: "Messages" },
    { href: "/admin/guest-messages", label: "Message templates" },
  ];

  return (
    <div className="flex min-h-[calc(100vh-3.75rem)] flex-col bg-[var(--background)]">
      <div className="shrink-0 border-b border-slate-200/80 bg-white">
        <AdminNav
          label={isPlatform ? "Admin" : "Listings & bookings"}
          links={links}
        />
      </div>
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
