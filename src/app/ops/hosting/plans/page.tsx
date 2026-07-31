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
    orderBy: { sortOrder: "asc" },
  });

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

      <Card>
        <h2 className="font-semibold">Add plan</h2>
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
              Active
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

      <div className="space-y-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
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
                  Active
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={plan.isDefault}
                  />
                  Default
                </label>
                <p className="text-xs text-stone-500">
                  {plan._count.hosts} host{plan._count.hosts === 1 ? "" : "s"} ·{" "}
                  {pricingModelLabel(plan.pricingModel)} ·{" "}
                  {formatPlanPrice(plan, formatMoney)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit">Save</Button>
              </div>
            </form>
            {plan._count.hosts === 0 ? (
              <form action={deleteHostingPlan} className="mt-3 border-t border-stone-100 pt-3">
                <input type="hidden" name="id" value={plan.id} />
                <Button type="submit" variant="danger">
                  Delete plan
                </Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
