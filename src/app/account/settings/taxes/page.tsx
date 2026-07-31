import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TAX_LIABILITY_WARNING } from "@/lib/tax";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxes" };

export default async function AccountTaxesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      host: {
        include: {
          taxLines: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const isHost = user.role === "HOST" || user.role === "ADMIN";
  const host = user.host;

  return (
    <AccountSettingsShell active="taxes" isHost={isHost} title="Taxes">
      <div
        role="alert"
        className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 sm:p-5"
      >
        <p className="text-sm font-bold text-amber-950">
          Warning - we are not liable for tax
        </p>
        <p className="mt-2 text-sm text-amber-950/90">
          Yall Come Back does not collect, remit, or file taxes for you. You must
          determine rates correctly and file yourself.
        </p>
        <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-amber-950/80">
          {TAX_LIABILITY_WARNING}
        </pre>
      </div>

      {isHost && host ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-base font-semibold text-stone-900">
            Host-level taxes
          </h2>
          <p className="text-sm text-stone-600">
            Tax rules apply to{" "}
            <strong className="font-medium text-stone-800">{host.name}</strong>{" "}
            as a whole - every listing under this host brand, not each property
            separately.
          </p>
          {host.taxLines.length > 0 ? (
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {host.taxLines.map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-stone-900">{t.name}</span>
                  <span className="text-stone-500">{t.ratePercent}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">
              No tax lines are active on this host yet. See the help article for
              how host-level taxes work on Yall Come Back.
            </p>
          )}
          <Link
            href="/help/taxes"
            className="inline-flex rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet-hover"
          >
            Read: Taxes for hosts →
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3 text-sm text-stone-600">
          <p>
            Tax is set by each <strong>host brand</strong> (not per guest
            account). When a host charges tax, it can show on the booking quote
            for their stays.
          </p>
          <Link
            href="/help/taxes"
            className="inline-flex font-semibold text-bonnet underline-offset-2 hover:underline"
          >
            Taxes for hosts (help center) →
          </Link>
        </div>
      )}
    </AccountSettingsShell>
  );
}
