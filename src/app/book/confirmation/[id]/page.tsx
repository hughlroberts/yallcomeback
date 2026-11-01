import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { formatDateRangeUS, formatMoney } from "@/lib/utils";
import { MessageHostButton } from "@/components/message-host-form";
import { BrandSeal } from "@/components/brand-logo";
import {
  bitcoinPaymentUri,
  formatBtc,
  getBitcoinLabel,
  getBitcoinNetworkLabel,
} from "@/lib/bitcoin";
import {
  bookingAccessToken,
  verifyBookingAccessToken,
} from "@/lib/booking-access";
import {
  guestCancelWindow,
  REFUND_PROCESS_TEXT,
} from "@/lib/guest-cancel-window";
import { GuestCancelPanel } from "@/components/guest-cancel-panel";

import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Booking confirmation",
  description: "Your stay booking confirmation on Yall Come Back.",
  path: "/book/confirmation",
  noIndex: true,
});

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    pendingStripe?: string;
    inbox?: string;
    t?: string;
    cancel?: string;
    cancelled?: string;
    cancelError?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const inboxId = sp.inbox?.trim() || null;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: {
        select: {
          title: true,
          slug: true,
          hostId: true,
          checkInTime: true,
          cancellationPolicy: true,
          longTermCancellationPolicy: true,
          host: { select: { slug: true } },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!booking) notFound();

  // P0-3: do not expose guest PII to anyone who knows the booking id
  const session = await auth();
  const tokenOk = verifyBookingAccessToken(id, sp.t);
  const email = session?.user?.email?.toLowerCase();
  const viewer = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { emailVerifiedAt: true },
      })
    : null;
  const isGuest =
    Boolean(session?.user?.id && booking.userId === session.user.id) ||
    Boolean(
      email &&
      email === booking.guestEmail.toLowerCase() &&
      viewer?.emailVerifiedAt,
    );
  const isHost =
    session?.user?.role === "ADMIN" ||
    (session?.user?.role === "HOST" &&
      session.user.hostId === booking.property.hostId);

  if (!tokenOk && !isGuest && !isHost) {
    if (!session?.user) {
      redirect(
        `/login?callbackUrl=${encodeURIComponent(`/book/confirmation/${id}`)}`,
      );
    }
    notFound();
  }

  const payment = booking.payments[0];
  const isCancelled = booking.status === "CANCELLED";
  const isBitcoin =
    !isCancelled &&
    payment?.method === "BITCOIN" &&
    payment.status === "PENDING";
  const isStripePending =
    !isCancelled &&
    (sp.pendingStripe === "1" || payment?.method === "STRIPE") &&
    payment?.status !== "PAID";
  const depositPaid = booking.payments.some(
    (p) => p.status === "PAID" || p.status === "REFUNDED",
  );
  const refundedTotal = booking.payments.reduce(
    (sum, p) => sum + (p.refundedAmount ?? 0),
    0,
  );
  const canManage = tokenOk || isGuest;
  const manageToken = canManage ? bookingAccessToken(booking.id) : "";
  const cancelWin = guestCancelWindow({
    nights: booking.nights,
    checkIn: booking.checkIn,
    createdAt: booking.createdAt,
    checkInTime: booking.property.checkInTime,
    cancellationPolicy: booking.property.cancellationPolicy,
    longTermCancellationPolicy: booking.property.longTermCancellationPolicy,
  });
  const deadlineLabel = cancelWin.deadline.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const isRequest =
    payment?.method === "MANUAL" &&
    Boolean(payment.notes?.startsWith("Request to book"));

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
          {isCancelled
            ? "This booking is cancelled"
            : isBitcoin
              ? "Send your Bitcoin deposit"
              : "You're back. The light's on."}
        </h1>
        <p className="mt-2 text-stone-500">
          {isCancelled
            ? `Your ${isRequest ? "request" : "booking"} for ${booking.property.title} was cancelled and the dates were released.`
            : isBitcoin
              ? `We've reserved ${booking.property.title}. Send the deposit in Bitcoin to confirm.`
              : isRequest
                ? `Your request for ${booking.property.title} is in. Nothing was charged. The host will review it and arrange the deposit with you after they approve.`
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

      {canManage && isCancelled ? (
        <div
          data-guest-cancelled
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-950"
        >
          <p className="font-semibold">
            Cancelled
            {booking.cancelledAt
              ? ` on ${booking.cancelledAt.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}`
              : ""}
            {booking.cancelledBy === "GUEST"
              ? " by you"
              : booking.cancelledBy === "HOST"
                ? " by the host"
                : booking.cancelledBy === "SYSTEM"
                  ? " automatically"
                  : ""}
            .
          </p>
          <p className="mt-1 text-red-900/90">
            {refundedTotal > 0
              ? `A refund of ${formatMoney(refundedTotal)} was issued to your original payment method.`
              : depositPaid
                ? `You paid a deposit. The host or Yall Come Back will process any refund your ${cancelWin.policyName} policy allows. Refunds are not automatic, and the host has been notified.`
                : "No payment was taken, so there is nothing to refund."}
          </p>
          {sp.cancelled === "1" ? (
            <p className="mt-1 text-red-900/90">
              We emailed you and the host a cancellation notice.
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage &&
      !isCancelled &&
      (booking.status === "PENDING_PAYMENT" ||
        booking.status === "CONFIRMED") ? (
        <div
          id="cancel"
          data-guest-cancel
          className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-left text-sm"
        >
          <p className="font-semibold text-stone-900">Need to cancel?</p>
          <p className="mt-1 text-stone-600">
            Cancellation policy: {cancelWin.policyName}. {cancelWin.ruleText}
          </p>
          {sp.cancelError === "deadline" ? (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900">
              The online cancel window has passed.
            </p>
          ) : null}
          <div className="mt-3">
            {cancelWin.canCancelOnline ? (
              <GuestCancelPanel
                bookingId={booking.id}
                token={manageToken}
                noun={isRequest || !depositPaid ? "request" : "booking"}
                startOpen={sp.cancel === "1"}
                deadlineText={`You can cancel online until ${deadlineLabel} (Central). The dates go back on the calendar right away.`}
                moneyText={
                  depositPaid
                    ? `You paid a deposit. Nothing is refunded automatically: the host or Yall Come Back will process any refund the ${cancelWin.policyName} policy allows${cancelWin.refundTier === "full" ? " (you are in its full-refund window)" : cancelWin.refundTier === "partial" ? " (you are in its partial-refund window)" : ""}.`
                    : "No payment has been taken, so nothing is charged or refunded."
                }
              />
            ) : (
              <p
                data-contact-host-to-cancel
                className="rounded-lg bg-amber-50 p-3 font-medium text-amber-950"
              >
                Contact host to cancel. The online cancel window ended{" "}
                {deadlineLabel} (Central). Use “Message host” below.
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-stone-500">{REFUND_PROCESS_TEXT}</p>
        </div>
      ) : null}

      {isStripePending && !isBitcoin ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">
          Card checkout will open here when card payments are live. Your hold is
          saved; the host can still confirm a manual deposit.
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
          Questions about arrival, parking, or your stay? You can message now or
          skip - never required.
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
