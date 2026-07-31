import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { auth } from "@/lib/auth";
import { isBitcoinEnabled, getBitcoinAddress } from "@/lib/bitcoin";
import { isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

/**
 * Payments in account settings are gateways only - not in-app card forms.
 * Stripe, Bitcoin, and host billing open external or admin destinations.
 */
export default async function AccountPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { host: true },
  });
  if (!user) redirect("/login");

  const isHost = user.role === "HOST" || user.role === "ADMIN";
  const isPlatform = user.role === "ADMIN";
  const stripeOn = isStripeConfigured();
  const bitcoinOn = isBitcoinEnabled();
  const btcAddr = getBitcoinAddress();

  return (
    <AccountSettingsShell active="payments" isHost={isHost} title="Payments">
      <p className="text-sm leading-relaxed text-stone-600">
        Manage how you pay deposits or how you receive payouts. Yall Come Back opens
        the provider or setup page - we don&apos;t store full card numbers here.
      </p>

      <div className="mt-8 space-y-3">
        <PaymentLink
          title="Stripe"
          description={
            stripeOn
              ? "Card payments and hosted invoices when enabled for this site."
              : "Stripe is not live yet. When keys are configured, use the Stripe Dashboard for customers and payouts."
          }
          href="https://dashboard.stripe.com/"
          external
          badge={stripeOn ? "Configured" : "Setup later"}
        />

        <PaymentLink
          title="Bitcoin"
          description={
            bitcoinOn && btcAddr
              ? `Deposits can be paid in BTC to the site address (${btcAddr.slice(0, 10)}…). Guests pay at checkout; hosts confirm the tx id on the booking.`
              : "Enable Bitcoin deposits with BITCOIN_ENABLED and BITCOIN_ADDRESS in your environment (or ask the platform operator)."
          }
          href={
            isPlatform
              ? "/ops/settings"
              : bitcoinOn
                ? "/account/bookings"
                : "/open-source#setup"
          }
          badge={bitcoinOn ? "Available" : "Not enabled"}
        />

        {isHost && !isPlatform ? (
          <PaymentLink
            title="Hosting invoices"
            description="Monthly website hosting fees (per listing) are billed by Yall Come Back. Contact the platform if you need a copy of an invoice."
            href="/contact"
            badge="Host"
          />
        ) : null}

        <PaymentLink
          title="My booking deposits"
          description="See pending and paid deposits for your stays (USD, card, Bitcoin, or manual)."
          href="/account/bookings"
        />

        {isPlatform ? (
          <>
            <PaymentLink
              title="Ops · website hosting"
              description="Approve hosts, invoices, and the $25/listing hosting fee (platform admin only)."
              href="/ops/hosting"
              badge="Admin"
            />
            <PaymentLink
              title="Ops · platform payment settings"
              description="Stripe keys, Bitcoin address, and go-live placeholders."
              href="/ops/settings"
              badge="Admin"
            />
          </>
        ) : null}

        <PaymentLink
          title="Other / manual"
          description="Cash, bank transfer, or arrangements with the host. Hosts mark deposits paid under Bookings."
          href="/account/bookings"
        />
      </div>

      <p className="mt-8 text-xs leading-relaxed text-stone-400">
        Currency is USD. Bitcoin amounts are converted from the USD deposit at
        booking time. Yall Come Back is not a bank or money transmitter for your
        private Bitcoin wallet.
      </p>
    </AccountSettingsShell>
  );
}

function PaymentLink({
  title,
  description,
  href,
  external,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
}) {
  const className =
    "flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-4 transition hover:border-stone-300 hover:bg-stone-50";

  const body = (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-stone-900">{title}</p>
          {badge ? (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-stone-500">
          {description}
        </p>
      </div>
      <span className="shrink-0 text-stone-400" aria-hidden>
        →
      </span>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
