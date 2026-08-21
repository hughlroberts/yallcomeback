import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import {
  deleteHostingPlan,
  upsertHostingPlan,
} from "@/app/actions/hosting";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import {
  formatPlanPrice,
  isComplimentaryPlan,
  pricingModelLabel,
} from "@/lib/hosting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hosting plans · Ops" };

export default async function OpsHostingPlansPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/hosting/plans");

  const plans = await prisma.hostingPlan.findMany({
    include: { _count: { select: { hosts: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });

  const publishedPlans = plans.filter((p) => !isComplimentaryPlan(p));
  const internalPlans = plans.filter((p) => isComplimentaryPlan(p));
  const publishedActive = publishedPlans.filter((p) => p.isActive).length;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/ops/hosting"
          className="text-sm font-medium text-bonnet hover:underline"
        >
          ← Hosting
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Hosting plans & pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Default is{" "}
          <strong className="font-medium text-stone-700">
            per property / month
          </strong>{" "}
          so hosts with more listings pay more hosting (still not a booking
          commission). Flat monthly is available for special cases.{" "}
          <strong className="font-medium text-stone-700">Complimentary</strong>{" "}
          plans stay internal — assign them yourself in Ops; they are never
          offered on For hosts / signup.
        </p>
      </div>

      <section aria-labelledby="add-plan-heading">
        <Card className="border-dashed border-stone-300 bg-stone-50/50">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
              Create new
            </span>
          </div>
          <h2
            id="add-plan-heading"
            className="text-lg font-semibold text-stone-900"
          >
            Add plan
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Paid plans ($&gt;0) appear under Published. A $0 / complimentary plan
            appears under Internal only — Active means you can assign it, not
            that it is sold publicly.
          </p>
          <form
            action={upsertHostingPlan}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Standard" />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="standard" />
            </div>
            <div>
              <Label htmlFor="pricingModel">Pricing model</Label>
              <select
                id="pricingModel"
                name="pricingModel"
                defaultValue="PER_PROPERTY"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="PER_PROPERTY">Per property / month</option>
                <option value="FLAT">Flat / month (whole host)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="monthlyPrice">Price</Label>
              <Input
                id="monthlyPrice"
                name="monthlyPrice"
                type="number"
                step="0.01"
                defaultValue={12}
                required
              />
              <p className="mt-1 text-xs text-stone-500">
                Use 0 for an internal complimentary plan (platform-assigned
                only).
              </p>
            </div>
            <div>
              <Label htmlFor="minProperties">Min billable properties</Label>
              <Input
                id="minProperties"
                name="minProperties"
                type="number"
                min={1}
                defaultValue={1}
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Billed monthly per published listing"
              />
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                defaultValue={0}
              />
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked />
                Active (paid = offered publicly; $0 = assignable in Ops)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isDefault" />
                Default for new paid signups (ignored for $0 plans)
              </label>
            </div>
            <div>
              <Button type="submit">Create plan</Button>
            </div>
          </form>
        </Card>
      </section>

      <section aria-labelledby="published-plans-heading" className="space-y-4">
        <div className="border-t border-stone-200 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bonnet">
                Public catalog
              </p>
              <h2
                id="published-plans-heading"
                className="mt-1 text-xl font-semibold text-stone-900"
              >
                Published plans
              </h2>
              <p className="mt-1 max-w-xl text-sm text-stone-500">
                Paid plans hosts can choose on For hosts / signup. Uncheck Active
                to retire without deleting.
              </p>
            </div>
            <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {publishedPlans.length} plan
              {publishedPlans.length === 1 ? "" : "s"}
              {publishedActive > 0
                ? ` · ${publishedActive} active`
                : null}
            </p>
          </div>
        </div>

        {publishedPlans.length === 0 ? (
          <Card className="border-dashed border-stone-300 bg-stone-50/80 py-10 text-center">
            <p className="font-medium text-stone-800">No published plans yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Create a paid plan (price &gt; 0) above to offer hosting publicly.
            </p>
          </Card>
        ) : (
          publishedPlans.map((plan) => (
            <PlanEditorCard key={plan.id} plan={plan} kind="published" />
          ))
        )}
      </section>

      <section aria-labelledby="internal-plans-heading" className="space-y-4">
        <div className="border-t border-stone-200 pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Platform only
              </p>
              <h2
                id="internal-plans-heading"
                className="mt-1 text-xl font-semibold text-stone-900"
              >
                Internal / complimentary
              </h2>
              <p className="mt-1 max-w-xl text-sm text-stone-500">
                $0 plans for your own brands or partners. Active means you can
                assign them in Ops — they are <strong>not</strong> published to
                the public signup flow.
              </p>
            </div>
            <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {internalPlans.length} plan
              {internalPlans.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {internalPlans.length === 0 ? (
          <Card className="border-dashed border-stone-300 bg-stone-50/80 py-8 text-center text-sm text-stone-500">
            No complimentary plans. Create one with price 0 if you need an
            internal tier.
          </Card>
        ) : (
          internalPlans.map((plan) => (
            <PlanEditorCard key={plan.id} plan={plan} kind="internal" />
          ))
        )}
      </section>
    </div>
  );
}

type PlanRow = Awaited<
  ReturnType<
    typeof prisma.hostingPlan.findMany<{
      include: { _count: { select: { hosts: true } } };
    }>
  >
>[number];

function PlanEditorCard({
  plan,
  kind,
}: {
  plan: PlanRow;
  kind: "published" | "internal";
}) {
  const complimentary = kind === "internal";

  return (
    <Card
      className={
        complimentary
          ? plan.isActive
            ? "border-stone-300 bg-stone-50/40"
            : "border-stone-200 bg-stone-50/60 opacity-90"
          : plan.isActive
            ? "border-bonnet/20 ring-1 ring-bonnet/10"
            : "border-stone-200 bg-stone-50/60 opacity-90"
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-3">
        <h3 className="text-base font-semibold text-stone-900">{plan.name}</h3>
        {complimentary ? (
          plan.isActive ? (
            <span className="rounded-full bg-stone-200/90 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700 ring-1 ring-inset ring-stone-300">
              Internal · Active
            </span>
          ) : (
            <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
              Internal · Inactive
            </span>
          )
        ) : plan.isActive ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
            Published · Active
          </span>
        ) : (
          <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
            Inactive
          </span>
        )}
        {!complimentary && plan.isDefault ? (
          <span className="rounded-full bg-petal px-2.5 py-0.5 text-[11px] font-semibold text-bonnet ring-1 ring-inset ring-petal">
            Default signup
          </span>
        ) : null}
        <span className="ml-auto text-xs text-stone-500">
          {plan._count.hosts} host{plan._count.hosts === 1 ? "" : "s"} ·{" "}
          {pricingModelLabel(plan.pricingModel)} ·{" "}
          {formatPlanPrice(plan, formatMoney)}
        </span>
      </div>
      <form action={upsertHostingPlan} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={plan.id} />
        <div>
          <Label>Name</Label>
          <Input name="name" defaultValue={plan.name} required />
        </div>
        <div>
          <Label>Slug</Label>
          <Input name="slug" defaultValue={plan.slug} />
        </div>
        <div>
          <Label>Pricing model</Label>
          <select
            name="pricingModel"
            defaultValue={plan.pricingModel}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            <option value="PER_PROPERTY">Per property / month</option>
            <option value="FLAT">Flat / month (whole host)</option>
          </select>
        </div>
        <div>
          <Label>Price</Label>
          <Input
            name="monthlyPrice"
            type="number"
            step="0.01"
            defaultValue={plan.monthlyPrice}
          />
        </div>
        <div>
          <Label>Min billable properties</Label>
          <Input
            name="minProperties"
            type="number"
            min={1}
            defaultValue={plan.minProperties}
          />
        </div>
        <div>
          <Label>Currency</Label>
          <Input name="currency" defaultValue={plan.currency} />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea
            name="description"
            rows={2}
            defaultValue={plan.description || ""}
          />
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={plan.sortOrder}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={plan.isActive}
            />
            {complimentary
              ? "Active (assignable in Ops only)"
              : "Active (published to hosts)"}
          </label>
          {!complimentary ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={plan.isDefault}
              />
              Default for new signups
            </label>
          ) : (
            <input type="hidden" name="isDefault" value="" />
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit">
            {complimentary ? "Save internal plan" : "Save published plan"}
          </Button>
        </div>
      </form>
      {plan._count.hosts === 0 ? (
        <form
          action={deleteHostingPlan}
          className="mt-3 border-t border-stone-100 pt-3"
        >
          <input type="hidden" name="id" value={plan.id} />
          <Button type="submit" variant="danger">
            Delete plan
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
