import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

const SECTIONS: {
  href: string;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    href: "/account/settings/personal",
    title: "Personal information",
    description: "Name, phone, and addresses used for bookings.",
    icon: "👤",
  },
  {
    href: "/account/settings/login",
    title: "Login & security",
    description: "Password and how you sign in.",
    icon: "🛡️",
  },
  {
    href: "/account/settings/privacy",
    title: "Privacy",
    description: "Read receipts and listing search visibility.",
    icon: "🔒",
  },
  {
    href: "/account/settings/taxes",
    title: "Taxes",
    description: "How lodging tax works on Yall Come Back (hosts).",
    icon: "📄",
  },
  {
    href: "/account/settings/payments",
    title: "Payments",
    description: "Stripe, Bitcoin, deposits, and host billing.",
    icon: "💳",
  },
  {
    href: "/account/settings/language",
    title: "Languages & currency",
    description: "Display language and USD preferences.",
    icon: "🌐",
  },
];

export default async function AccountSettingsHubPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/settings");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true },
  });
  if (!user) redirect("/login?callbackUrl=/account/settings");

  const isHost = user.role === "HOST" || user.role === "ADMIN";

  return (
    <AccountSettingsShell
      active="overview"
      isHost={isHost}
      title="Account settings"
      description="Manage your profile, security, privacy, and payment preferences. The same account works for guests and hosts."
    >
      <div className="mb-6 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        <p className="font-medium text-stone-900">
          {user.name || "Your account"}
        </p>
        <p className="mt-0.5 text-stone-500">{user.email}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex h-full items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-50"
            >
              <span className="text-xl leading-none" aria-hidden>
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-stone-900">
                  {s.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-stone-500">
                  {s.description}
                </span>
              </span>
              <span className="shrink-0 text-stone-400" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-stone-100 pt-6">
        <Link
          href="/account/bookings"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Trips
        </Link>
        <Link
          href="/messages"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Messages
        </Link>
        <Link
          href="/saved"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Wishlists
        </Link>
      </div>
    </AccountSettingsShell>
  );
}
