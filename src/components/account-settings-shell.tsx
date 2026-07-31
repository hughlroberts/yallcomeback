import Link from "next/link";
import {
  AccountSettingsNav,
  type AccountSection,
} from "@/components/account-settings-nav";

export function AccountSettingsShell({
  active,
  isHost,
  title,
  description,
  children,
}: {
  active: AccountSection;
  isHost?: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--background)] py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 sm:px-6">
            <p className="text-sm font-semibold text-slate-900">Your account</p>
            <Link
              href="/"
              className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Done
            </Link>
          </div>

          <div className="flex flex-col gap-8 p-5 sm:flex-row sm:gap-10 sm:p-8">
            <AccountSettingsNav active={active} isHost={isHost} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                  {description}
                </p>
              ) : null}
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Row for personal-info style lists */
export function SettingsRow({
  label,
  value,
  hint,
  actionLabel = "Edit",
  actionHref,
}: {
  label: string;
  value: string;
  hint?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-5 first:pt-0 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-900">{label}</p>
        <p className="mt-0.5 text-sm text-stone-600">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-stone-400">{hint}</p>
        ) : null}
      </div>
      {actionHref ? (
        <Link
          href={actionHref}
          className="shrink-0 text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function SavedBanner({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <p className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Saved.
    </p>
  );
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user[0] ?? ""}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone?.trim()) return "Not provided";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `+1 ***-***-${digits.slice(-4)}`;
}
