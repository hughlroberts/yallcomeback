import Link from "next/link";

export type AccountSection =
  | "overview"
  | "personal"
  | "login"
  | "privacy"
  | "taxes"
  | "payments"
  | "language";

const NAV: {
  id: AccountSection;
  label: string;
  href: string;
  icon: string;
}[] = [
  {
    id: "personal",
    label: "Personal information",
    href: "/account/settings/personal",
    icon: "👤",
  },
  {
    id: "login",
    label: "Login & security",
    href: "/account/settings/login",
    icon: "🛡️",
  },
  {
    id: "privacy",
    label: "Privacy",
    href: "/account/settings/privacy",
    icon: "🔒",
  },
  {
    id: "taxes",
    label: "Taxes",
    href: "/account/settings/taxes",
    icon: "📄",
  },
  {
    id: "payments",
    label: "Payments",
    href: "/account/settings/payments",
    icon: "💳",
  },
  {
    id: "language",
    label: "Languages & currency",
    href: "/account/settings/language",
    icon: "🌐",
  },
];

function navClass(selected: boolean) {
  return [
    "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition",
    selected
      ? "bg-petal text-bonnet"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

export function AccountSettingsNav({
  active,
  isHost,
}: {
  active: AccountSection;
  isHost?: boolean;
}) {
  return (
    <nav className="w-full shrink-0 sm:w-56 lg:w-64">
      <p className="px-3 text-lg font-semibold tracking-tight text-slate-900">
        Account settings
      </p>
      <ul className="mt-4 space-y-0.5">
        <li>
          <Link
            href="/account/settings"
            className={navClass(active === "overview")}
          >
            <span className="text-base leading-none" aria-hidden>
              ☰
            </span>
            <span>Overview</span>
          </Link>
        </li>
        {NAV.map((item) => {
          const selected = item.id === active;
          return (
            <li key={item.id}>
              <Link href={item.href} className={navClass(selected)}>
                <span className="text-base leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="mt-2 border-t border-slate-100 pt-2">
          <Link href="/account/bookings" className={navClass(false)}>
            <span className="text-base leading-none" aria-hidden>
              ✈️
            </span>
            <span>Trips</span>
          </Link>
        </li>
        <li>
          <Link href="/saved" className={navClass(false)}>
            <span className="text-base leading-none" aria-hidden>
              ❤️
            </span>
            <span>Wishlists</span>
          </Link>
        </li>
        {isHost ? (
          <li className="mt-2 border-t border-slate-100 pt-2">
            <Link href="/admin" className={navClass(false)}>
              <span className="text-base leading-none" aria-hidden>
                🏠
              </span>
              <span>Listings & bookings</span>
            </Link>
          </li>
        ) : (
          <li className="mt-2 border-t border-slate-100 pt-2">
            <Link href="/for-hosts" className={navClass(false)}>
              <span className="text-base leading-none" aria-hidden>
                🏠
              </span>
              <span>List a stay</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
