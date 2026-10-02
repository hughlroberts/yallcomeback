"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  dashboardNestActive,
  isDashboardNestPath,
  type DashboardNestId,
} from "@/lib/dashboard-nest";
import { cn } from "@/lib/utils";

type Item = {
  id: DashboardNestId;
  href: string;
  label: string;
};

export function DashboardNestNav({
  canBrand,
  canEarnings,
  canTeam,
}: {
  canBrand: boolean;
  canEarnings: boolean;
  canTeam: boolean;
}) {
  const pathname = usePathname() || "";
  if (!isDashboardNestPath(pathname)) return null;
  const active = dashboardNestActive(pathname);

  const items: Item[] = [
    { id: "dashboard", href: "/admin", label: "Dashboard" },
    ...(canBrand
      ? ([
          {
            id: "brand",
            href: "/admin/brand",
            label: "Brand & website",
          },
          { id: "payments", href: "/admin/payments", label: "Payments" },
        ] as Item[])
      : []),
    ...(canEarnings
      ? ([
          { id: "earnings", href: "/admin/earnings", label: "Earnings" },
        ] as Item[])
      : []),
    {
      id: "templates",
      href: "/admin/guest-messages",
      label: "Message templates",
    },
    ...(canTeam
      ? ([{ id: "team", href: "/admin/team", label: "Team" }] as Item[])
      : []),
  ];

  return (
    <nav
      aria-label="Dashboard"
      className="mb-6 flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "bg-petal text-bonnet"
                : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
