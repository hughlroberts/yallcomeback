import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  FileText,
  Settings,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/admin/earnings/performance",
    label: "Performance",
    icon: BarChart3,
  },
  {
    href: "/admin/earnings/upcoming",
    label: "Upcoming",
    icon: CalendarDays,
  },
  {
    href: "/admin/earnings/paid",
    label: "Paid",
    icon: Wallet,
  },
  {
    href: "/admin/earnings/reports",
    label: "Reports",
    icon: FileText,
  },
] as const;

export type EarningsNavId = (typeof NAV)[number]["href"];

/**
 * Airbnb-style Earnings layout: left sidebar + main panel.
 */
export function EarningsShell({
  active,
  children,
}: {
  active: "performance" | "upcoming" | "paid" | "reports";
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -my-8 min-h-[calc(100vh-8rem)] border-t border-slate-200/80 bg-[var(--background)] sm:-mx-6">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[1400px] flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 border-b border-slate-200/80 bg-[var(--background)] lg:w-[240px] lg:border-b-0 lg:border-r lg:border-slate-200/80">
          <div className="px-5 pb-4 pt-8">
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
              Earnings
            </h1>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible lg:px-3">
            {NAV.map((item) => {
              const id = item.href.split("/").pop() as typeof active;
              const isActive = id === active;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium transition",
                    isActive
                      ? "bg-petal text-bonnet"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[18px] shrink-0",
                      isActive ? "text-bonnet" : "text-slate-500",
                    )}
                    strokeWidth={1.75}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mx-3 hidden border-t border-slate-200/80 pt-3 lg:block">
            <Link
              href="/help/taxes"
              className="flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900"
            >
              <Settings
                className="size-[18px] text-slate-500"
                strokeWidth={1.75}
              />
              Tax help
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 bg-white lg:min-h-[calc(100vh-8rem)]">
          <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
