import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata = { title: "Payment received" };

export default async function PaySuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { hostSlug } = await params;
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card className="p-8 text-center">
        <h1 className="text-2xl font-semibold text-stone-900">Thank you</h1>
        <p className="mt-3 text-sm text-stone-600">
          Card checkout finished. The host will see the payment on their Stripe
          account. Keep the confirmation email from Stripe.
        </p>
        {sp.session_id ? (
          <p className="mt-2 font-mono text-xs text-stone-400">
            {sp.session_id}
          </p>
        ) : null}
        <Link
          href={`/h/${hostSlug}`}
          className="mt-6 inline-block text-sm font-semibold text-bonnet hover:underline"
        >
          Back to the host site
        </Link>
      </Card>
    </div>
  );
}
