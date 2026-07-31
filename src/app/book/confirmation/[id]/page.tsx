import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateRangeUS, formatMoney } from "@/lib/utils";
import { MessageHostButton } from "@/components/message-host-form";
import { BrandSeal } from "@/components/brand-logo";
import {
  bitcoinPaymentUri,
  formatBtc,
  getBitcoinLabel,
  getBitcoinNetworkLabel,
} from "@/lib/bitcoin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking confirmation" };

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pendingStripe?: string; inbox?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const inboxId = sp.inbox?.trim() || null;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: { include: { host: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!booking) notFound();

  const payment = booking.payments[0];
  const isBitcoin =
    payment?.method === "BITCOIN" && payment.status === "PENDING";
  const isStripePending = sp.pendingStripe === "1" || payment?.method === "STRIPE";

  const btcUri =
    isBitcoin && payment?.bitcoinAddress
      ? bitcoinPaymentUri({
          address: payment.bitcoinAddress,
          amountBtc: payment.bitcoinAmountBtc,
          label: getBitcoinLabel(),
          message: `Deposit ${booking.id.slice(0, 8)} · ${booking.property.title}`,
        })
      : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="text-center">
        <BrandSeal size={88} className="mx-auto h-[5.5rem] w-[5.5rem]" />
        <h1 className="mt-6 text-2xl font-semibold text-stone-900">
          {isBitcoin
            ? "Send your Bitcoin deposit"
            : "You're back. The light's on."}
        </h1>
        <p className="mt-2 text-stone-500">
          {isBitcoin
            ? `We've reserved ${booking.property.title}. Send the deposit in Bitcoin to confirm.`
            : `We've reserved ${booking.property.title} for your dates. A host will confirm your deposit shortly.`}
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-5 text-left text-sm">
        <p>
          <span className="text-stone-500">Reference:</span>{" "}
          <span className="font-mono">{booking.id.slice(0, 8)}</span>
        </p>
        <p className="mt-2">
          <span className="text-stone-500">Dates:</span>{" "}
          {formatDateRangeUS(booking.checkIn, booking.checkOut)}
        </p>
        <p className="mt-2">
          <span className="text-stone-500">Deposit (USD):</span>{" "}
          {formatMoney(booking.depositAmount)} (
          {booking.status.replace("_", " ")})
        </p>
        <p className="mt-2">
          <span className="text-stone-500">Email:</span> {booking.guestEmail}
        </p>
      </div>

      {isBitcoin && payment?.bitcoinAddress ? (
        <div className="mt-6 rounded-2xl border-2 border-orange-300 bg-orange-50 p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-900">
            Pay with Bitcoin · {getBitcoinNetworkLabel()}
          </p>
          <p className="mt-2 text-sm text-orange-950">
            Send exactly the USD deposit equivalent
            {payment.bitcoinAmountBtc != null ? (
              <>
                {" "}
 - about{" "}
                <strong className="font-mono">
                  {formatBtc(payment.bitcoinAmountBtc)}
                </strong>
              </>
            ) : null}{" "}
 - for <strong>{formatMoney(booking.depositAmount)} USD</strong>.
            {payment.bitcoinRateUsd != null ? (
              <span className="mt-1 block text-xs text-orange-900/80">
                Rate used: {formatMoney(payment.bitcoinRateUsd)} USD per BTC
                (spot at booking). Small rate drift is OK; host confirms
                receipt.
              </span>
            ) : (
              <span className="mt-1 block text-xs text-orange-900/80">
                Spot rate unavailable at booking - send the current USD
                equivalent of {formatMoney(booking.depositAmount)}.
              </span>
            )}
          </p>

          <div className="mt-4">
            <p className="text-xs font-medium text-orange-900">
              Send to this address
            </p>
            <p className="mt-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-stone-900 shadow-sm">
              {payment.bitcoinAddress}
            </p>
          </div>

          {payment.bitcoinAmountBtc != null ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-orange-900">Amount</p>
              <p className="mt-1 font-mono text-lg font-semibold text-stone-900">
                {formatBtc(payment.bitcoinAmountBtc)}
              </p>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-orange-900/80">
            Put reference{" "}
            <span className="font-mono font-semibold">
              {booking.id.slice(0, 8)}
            </span>{" "}
            in your wallet memo if available. After you send, the host will
            confirm the deposit and lock in your stay.
          </p>

          {btcUri ? (
            <a
              href={btcUri}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Open in Bitcoin wallet
            </a>
          ) : null}
        </div>
      ) : null}

      {isStripePending && !isBitcoin ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
          Card checkout will open here when Stripe is live. Your hold is saved;
          the host can still confirm a manual deposit.
        </p>
      ) : null}

      {inboxId ? (
        <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-center text-sm text-bonnet">
          <p className="font-medium">Your host sent a message</p>
          <p className="mt-1 text-bonnet/80">
            Check-in tips and stay details are in your inbox.
          </p>
          <Link
            href={`/messages/${inboxId}`}
            className="mt-3 inline-flex rounded-[var(--radius-control)] bg-bonnet px-4 py-2 text-sm font-semibold text-white hover:bg-bonnet"
          >
            Open inbox message
          </Link>
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-blue-100 bg-petal/70 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
          Optional
        </p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">
          Message the host?
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Questions about arrival, parking, or your stay? You can message now
          or skip - never required.
        </p>
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <MessageHostButton
            propertyId={booking.propertyId}
            propertyTitle={booking.property.title}
            bookingId={booking.id}
            label="Message host"
            defaultName={booking.guestName}
            defaultEmail={booking.guestEmail}
            defaultPhone={booking.guestPhone || ""}
            defaultSubject={`Booking ${booking.id.slice(0, 8)} · ${formatDateRangeUS(booking.checkIn, booking.checkOut)}`}
            hideContactFields
          />
          <Link
            href={
              booking.property.host
                ? `/marketplace/properties/${booking.property.slug}?host=${booking.property.host.slug}`
                : `/marketplace/properties/${booking.property.slug}`
            }
            className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-stone-600 hover:bg-white hover:text-stone-900"
          >
            Skip · back to listing
          </Link>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-block text-sm font-medium text-bonnet hover:text-bonnet"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
