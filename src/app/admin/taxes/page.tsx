import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { saveTaxProfile } from "@/app/actions/tax";
import {
  availableTaxYears,
  getTaxYearSummary,
  TAX_EXPORT_DISCLAIMER,
} from "@/lib/tax-records";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxes · Admin" };

const ENTITY_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "individual", label: "Individual / sole proprietor" },
  { value: "llc", label: "LLC" },
  { value: "partnership", label: "Partnership" },
  { value: "s_corp", label: "S corporation" },
  { value: "c_corp", label: "C corporation" },
  { value: "other", label: "Other" },
];

export default async function AdminTaxesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; saved?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/taxes");
  if (!access.hostId) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">Taxes</h1>
        <p className="mt-2 text-sm text-stone-600">
          Pick a host brand first, then export tax worksheets for that brand.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const years = availableTaxYears();
  const year = years.includes(Number(sp.year))
    ? Number(sp.year)
    : new Date().getFullYear();

  const [host, summary] = await Promise.all([
    prisma.host.findUnique({ where: { id: access.hostId } }),
    getTaxYearSummary(access, year),
  ]);
  if (!host) redirect("/admin");

  const exports = [
    {
      kind: "summary",
      title: "Year summary",
      body: "Totals for the year: stays, lodging, tax collected, and money received.",
    },
    {
      kind: "stays",
      title: "Stay ledger (state / occupancy)",
      body: "Every confirmed stay with check-in in this year. Use this for lodging tax by city and stay dates.",
    },
    {
      kind: "occupancy",
      title: "Occupancy tax collected",
      body: "Tax lines collected on those stays, with listing city and region.",
    },
    {
      kind: "income",
      title: "Income received (federal / cash)",
      body: "Deposits and payments marked paid in this calendar year. Use this for cash-basis federal income records.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Tax records</h1>
        <p className="mt-1 text-sm text-stone-600">
          Bulk worksheets for {host.name}. Yall Come Back does not file federal
          or state tax for you. Download CSVs for your CPA or your own filing.
        </p>
      </div>

      <div
        role="alert"
        className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        {TAX_EXPORT_DISCLAIMER}
      </div>

      {sp.saved === "profile" ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Tax profile saved. It prints on the year summary export.
        </p>
      ) : null}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-stone-900">Who files</h2>
        <p className="text-sm text-stone-600">
          Optional. Shown on exports only — not on guest pages. We do not store
          Social Security numbers or full EINs.
        </p>
        <form action={saveTaxProfile} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="hostId" value={host.id} />
          <div className="sm:col-span-2">
            <Label htmlFor="taxLegalName">Legal name</Label>
            <Input
              id="taxLegalName"
              name="taxLegalName"
              defaultValue={host.taxLegalName || host.name}
            />
          </div>
          <div>
            <Label htmlFor="taxEntityType">Entity</Label>
            <Select
              id="taxEntityType"
              name="taxEntityType"
              defaultValue={host.taxEntityType || ""}
            >
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="taxFilingState">Filing state (US)</Label>
            <Input
              id="taxFilingState"
              name="taxFilingState"
              maxLength={2}
              placeholder="TX"
              defaultValue={host.taxFilingState || ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary">
              Save tax profile
            </Button>
          </div>
        </form>
      </Card>

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900">Year packet</h2>
            <p className="mt-1 text-sm text-stone-600">
              Stay figures use check-in date. Income received uses the date the
              payment was marked paid.
            </p>
          </div>
          <form method="get" className="flex items-center gap-2">
            <Label htmlFor="year">Year</Label>
            <Select id="year" name="year" defaultValue={String(year)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              View
            </Button>
          </form>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Stays (check-in year)", String(summary.stayCount)],
            ["Nights", String(summary.nights)],
            ["Lodging", formatMoney(summary.lodging)],
            ["Tax collected", formatMoney(summary.taxCollected)],
            ["Stay totals", formatMoney(summary.stayTotal)],
            ["Income received (paid year)", formatMoney(summary.incomeReceived)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-stone-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {summary.occupancyByLine.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-stone-800">
              Occupancy / lodging tax by line
            </p>
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {summary.occupancyByLine.map((l) => (
                <li key={l.name} className="flex justify-between py-1.5">
                  <span className="text-stone-700">{l.name}</span>
                  <span className="font-medium">{formatMoney(l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            No occupancy tax snapshot on stays this year. Set host tax lines if
            you collect lodging tax.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {exports.map((e) => (
            <a
              key={e.kind}
              href={`/admin/taxes/export/${e.kind}?year=${year}`}
              className="rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-bonnet hover:bg-petal/40"
            >
              <p className="font-semibold text-stone-900">{e.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                {e.body}
              </p>
              <p className="mt-3 text-sm font-medium text-bonnet">
                Download CSV →
              </p>
            </a>
          ))}
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-stone-400">
        Card payments on your connected account may also produce a Form 1099-K
        from the card processor. Cash, bank, in-person card, and Bitcoin do
        not.{" "}
        <Link href="/help/taxes" className="text-bonnet underline">
          Taxes help
        </Link>
        .
      </p>
    </div>
  );
}
