import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button, Card } from "@/components/ui";
import { buyConnectedProduct } from "@/app/actions/stripe-connect";
import { isStripeConfigured } from "@/lib/stripe";
import {
  listProductsOnConnectedAccount,
  retrieveConnectStatus,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

/**
 * Guest storefront for one host's connected-account products.
 *
 * Uses the host brand slug in the URL (not the Stripe acct_ id). Do not put
 * connected-account ids in public URLs — treat this slug as the stable
 * identifier going forward.
 */
export default async function HostPayPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await prisma.host.findUnique({ where: { slug: hostSlug } });
  if (!host || !host.active) notFound();

  const stripeOn = isStripeConfigured();
  let ready = false;
  let products: {
    id: string;
    name: string;
    description: string | null;
    unitAmount: number | null;
    currency: string;
    priceId: string | null;
  }[] = [];

  if (stripeOn && host.acceptOnlineCard && host.stripeAccountId) {
    try {
      const status = await retrieveConnectStatus(host.stripeAccountId);
      ready = status.readyToProcessPayments;
      if (ready) {
        const list = await listProductsOnConnectedAccount(host.stripeAccountId);
        products = list.data.map((p) => {
          const price = p.default_price;
          const expanded =
            price && typeof price === "object" ? price : null;
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            unitAmount:
              expanded && "unit_amount" in expanded
                ? (expanded.unit_amount as number | null)
                : null,
            currency:
              expanded && "currency" in expanded
                ? String(expanded.currency)
                : "usd",
            priceId:
              typeof price === "string"
                ? price
                : expanded && "id" in expanded
                  ? String(expanded.id)
                  : null,
          };
        });
      }
    } catch {
      ready = false;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
        Book extras
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
        {host.name}
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Pay {host.name} directly. Card checkout opens on Stripe. Stay deposits
        are still requested from the listing reserve card.
      </p>

      {!ready ? (
        <Card className="mt-8 p-6 text-sm text-stone-600">
          This host is not collecting card payments on extras yet. Use the
          listing to request a stay, or pay the host another way.
        </Card>
      ) : products.length === 0 ? (
        <Card className="mt-8 p-6 text-sm text-stone-600">
          No extras for sale right now.
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col p-5">
                <h2 className="font-semibold text-stone-900">{p.name}</h2>
                {p.description ? (
                  <p className="mt-1 flex-1 text-sm text-stone-600">
                    {p.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                <p className="mt-4 text-lg font-medium text-stone-900">
                  {p.unitAmount != null
                    ? `$${(p.unitAmount / 100).toFixed(2)}`
                    : "—"}
                </p>
                {p.unitAmount != null ? (
                  <form action={buyConnectedProduct} className="mt-4">
                    <input type="hidden" name="hostSlug" value={host.slug} />
                    <input type="hidden" name="priceId" value={p.priceId || ""} />
                    <input type="hidden" name="productName" value={p.name} />
                    <input
                      type="hidden"
                      name="amountCents"
                      value={String(p.unitAmount)}
                    />
                    <Button type="submit" className="w-full">
                      Buy
                    </Button>
                  </form>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
