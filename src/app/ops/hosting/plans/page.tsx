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
import { formatPlanPrice, pricingModelLabel } from "@/lib/hosting";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hosting plans · Ops" };

export default async function OpsHostingPlansPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/hosting/plans");

  const plans = await prisma.hostingPlan.findMany({
    include: { _count: { select: { hosts: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
  });
  const activeCount = plans.filter((p) => p.isActive).length;

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
          Default is <strong className="font-medium text-stone-700">per property / month</strong>{" "}
          so hosts with more listings pay more hosting (still not a booking
          commission). Flat monthly is available for special cases.
        </p>
      </div>

      <section aria-labelledby="add-plan-heading">
        <Card className="border-dashed border-stone-300 bg-stone-50/50">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
              Create new
            </span>
          </div>
          <h2 id="add-plan-heading" className="text-lg font-semibold text-stone-900">
            Add plan
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Draft a new pricing tier. It appears under Published plans after you
            create it (Active = offered to hosts).
          </p>
          <form action={upsertHostingPlan} className="mt-4 grid gap-3 sm:grid-cols-2">
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
                Per property when using per-property model
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
              <Input id="sortOrder" name="sortOrder" type="number" defaultValue={0} />
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked />
                Active (shown to hosts)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isDefault" />
                Default for new signups
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
                Live catalog
              </p>
              <h2
                id="published-plans-heading"
                className="mt-1 text-xl font-semibold text-stone-900"
              >
                Published plans
              </h2>
              <p className="mt-1 max-w-xl text-sm text-stone-500">
                Plans hosts can be assigned today. Edit and save to update
                pricing; uncheck Active to retire a plan without deleting it.
              </p>
            </div>
            <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {plans.length} plan{plans.length === 1 ? "" : "s"}
              {activeCount > 0 ? ` · ${activeCount} active` : null}
            </p>
          </div>
        </div>

        {plans.length === 0 ? (
          <Card className="border-dashed border-stone-300 bg-stone-50/80 py-10 text-center">
            <p className="font-medium text-stone-800">No plans yet</p>
            <p className="mt-1 text-sm text-stone-500">
              Create one above to offer monthly hosting to new hosts.
            </p>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.isActive
                  ? "border-bonnet/20 ring-1 ring-bonnet/10"
                  : "border-stone-200 bg-stone-50/60 opacity-90"
              }
            >
              <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-3">
                <h3 className="text-base font-semibold text-stone-900">
                  {plan.name}
                </h3>
                {plan.isActive ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
                    Published · Active
                  </span>
                ) : (
                  <span className="rounded-full bg-stone-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                    Inactive
                  </span>
                )}
                {plan.isDefault ? (
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
                    Active (published to hosts)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isDefault"
                      defaultChecked={plan.isDefault}
                    />
                    Default for new signups
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit">Save published plan</Button>
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
          ))
        )}
      </section>
    </div>
  );
}
