"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  Building2,
  Globe,
  Heart,
  LogOut,
  Menu,
  MessageCircle,
  Plane,
  Search,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type UserMenuProps = {
  isSignedIn: boolean;
  isHostOrAdmin: boolean;
  isPlatformAdmin: boolean;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  signOutAction: () => Promise<void>;
};

function initials(name?: string | null, email?: string | null) {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function AvatarCircle({
  name,
  email,
  avatarUrl,
  sizeClass,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  sizeClass: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-200",
        sizeClass,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-semibold text-stone-600">
          {initials(name, email)}
        </span>
      )}
    </span>
  );
}

function MenuRow({
  href,
  icon: Icon,
  label,
  badge,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  badge?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 text-[15px] text-stone-800 transition hover:bg-stone-50"
    >
      <Icon className="size-[18px] shrink-0 text-stone-700" strokeWidth={1.75} />
      <span className="flex-1 font-medium">{label}</span>
      {badge != null && badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-1.5 text-[11px] font-semibold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * One account menu for everyone. Hosts see the same items as guests, plus
 * ordinary links to listings tools - no "travel mode" vs "host mode".
 */
export function UserMenu({
  isSignedIn,
  isHostOrAdmin,
  isPlatformAdmin,
  userName,
  userEmail,
  avatarUrl,
  signOutAction,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // pointerdown outside closes; leave links alone so navigation always works
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  // Logged out: travel or host — no messages surface
  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/for-hosts"
          className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-bonnet hover:bg-petal sm:inline"
        >
          List a stay
        </Link>
        <Link
          href="/for-hosts"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-bonnet hover:bg-petal sm:hidden"
        >
          List
        </Link>
        <Link
          href="/login"
          className="rounded-[var(--radius-control)] bg-bonnet px-4 py-2 text-sm font-medium text-white hover:bg-bonnet-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 shadow-sm transition",
          "hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet",
          open && "shadow-md ring-1 ring-slate-200",
        )}
      >
        <AvatarCircle
          name={userName}
          email={userEmail}
          avatarUrl={avatarUrl}
          sizeClass="size-9"
        />
        <span className="relative flex size-8 items-center justify-center rounded-full">
          <Menu className="size-4 text-stone-800" strokeWidth={2} />
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-[210] mt-2 w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 shadow-xl shadow-stone-900/10"
        >
          {(userName || userEmail) && (
            <div className="border-b border-stone-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-stone-900">
                {userName || "Your account"}
              </p>
              {userEmail ? (
                <p className="truncate text-xs text-stone-500">{userEmail}</p>
              ) : null}
            </div>
          )}

          <div className="py-1">
            <MenuRow
              href="/marketplace"
              icon={Search}
              label="Stays"
              onNavigate={close}
            />
            <MenuRow
              href="/account/bookings"
              icon={Plane}
              label="Trips"
              onNavigate={close}
            />
            <MenuRow
              href="/saved"
              icon={Heart}
              label="Wishlists"
              onNavigate={close}
            />
            {/* Messages only after sign-in, in the account menu — not top nav */}
            <MenuRow
              href="/messages"
              icon={MessageCircle}
              label="Messages"
              onNavigate={close}
            />
          </div>

          <div className="border-t border-stone-100 py-1">
            {isHostOrAdmin ? (
              <>
                <MenuRow
                  href="/admin"
                  icon={Building2}
                  label="Listings & bookings"
                  onNavigate={close}
                />
                {isPlatformAdmin ? (
                  <MenuRow
                    href="/ops"
                    icon={Settings}
                    label="Ops portal"
                    onNavigate={close}
                  />
                ) : null}
              </>
            ) : (
              <MenuRow
                href="/for-hosts"
                icon={Building2}
                label="List a stay"
                onNavigate={close}
              />
            )}
            <MenuRow
              href="/account/settings/personal"
              icon={User}
              label="Profile"
              onNavigate={close}
            />
            <MenuRow
              href="/account/settings"
              icon={Settings}
              label="Account settings"
              onNavigate={close}
            />
            <MenuRow
              href="/account/settings/language"
              icon={Globe}
              label="Languages & currency"
              onNavigate={close}
            />
          </div>

          <div className="border-t border-stone-100 py-1">
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] font-medium text-stone-800 transition hover:bg-stone-50"
              >
                <LogOut
                  className="size-[18px] text-stone-700"
                  strokeWidth={1.75}
                />
                Log out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
