import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { markDepositPaid, cancelBooking } from "@/app/actions/bookings";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { SleepingArrangementsDisplay } from "@/components/sleeping-arrangements-display";
import { requireHostAdmin } from "@/lib/auth";
import { bookingScopeWhere } from "@/lib/scope";
import { parseTaxBreakdown } from "@/lib/tax";

export const dynamic = "force-dynamic";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/bookings");

  const { id } = await params;
  const booking = await prisma.booking.findFirst({
    where: { id, ...bookingScopeWhere(access) },
    include: { property: true, payments: true },
  });
  if (!booking) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{booking.guestName}</h1>
        <p className="text-stone-500">{booking.property.title}</p>
      </div>

      <Card>
        <h2 className="font-semibold">Property room setup</h2>
        <div className="mt-3">
          <SleepingArrangementsDisplay
            rawJson={booking.property.sleepingArrangements}
            bedrooms={booking.property.bedrooms}
            beds={booking.property.beds}
            compact
          />
        </div>
      </Card>

      <Card className="space-y-2 text-sm">
        <p>
          <span className="text-stone-500">Status:</span>{" "}
          {booking.status.replaceAll("_", " ")}
        </p>
        <p>
          <span className="text-stone-500">Channel:</span>{" "}
          {booking.sourceChannel}
        </p>
        <p>
          <span className="text-stone-500">Dates:</span>{" "}
          {booking.checkIn.toISOString().slice(0, 10)} →{" "}
          {booking.checkOut.toISOString().slice(0, 10)} ({booking.nights} nights)
        </p>
        <p>
          <span className="text-stone-500">Guests:</span> {booking.guests}
        </p>
        <p>
          <span className="text-stone-500">Email:</span> {booking.guestEmail}
        </p>
        {booking.guestPhone && (
          <p>
            <span className="text-stone-500">Phone:</span> {booking.guestPhone}
          </p>
        )}
        <p>
          <span className="text-stone-500">Stay total:</span>{" "}
          {formatMoney(booking.totalAmount)}
        </p>
        {booking.taxAmount > 0 ? (
          <div className="text-stone-600">
            <p>
              <span className="text-stone-500">Tax:</span>{" "}
              {formatMoney(booking.taxAmount)}
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-stone-500">
              {parseTaxBreakdown(booking.taxBreakdown).map((t) => (
                <li key={`${t.name}-${t.amount}`}>
                  {t.name} ({t.ratePercent}%): {formatMoney(t.amount)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p>
          <span className="text-stone-500">Deposit:</span>{" "}
          {formatMoney(booking.depositAmount)}
        </p>
        {booking.guestNotes && (
          <p>
            <span className="text-stone-500">Guest notes:</span>{" "}
            {booking.guestNotes}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Payments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {booking.payments.map((p) => (
            <li
              key={p.id}
              className="space-y-1 border-b border-stone-100 py-2"
            >
              <div className="flex justify-between gap-2">
                <span>
                  {p.method} · {p.status}
                  {p.notes ? ` · ${p.notes}` : ""}
                </span>
                <span className="shrink-0">{formatMoney(p.amount)} USD</span>
              </div>
              {p.method === "BITCOIN" ? (
                <div className="text-xs text-stone-500">
                  {p.bitcoinAmountBtc != null
                    ? `Expected ~${p.bitcoinAmountBtc} BTC`
                    : "BTC amount TBD"}
                  {p.bitcoinAddress
                    ? ` · to ${p.bitcoinAddress.slice(0, 12)}…`
                    : ""}
                  {p.bitcoinTxId ? (
                    <>
                      {" "}
                      · tx{" "}
                      <span className="font-mono break-all">
                        {p.bitcoinTxId}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {booking.status === "PENDING_PAYMENT" && (
        <Card>
          <h2 className="font-semibold">Mark deposit paid</h2>
          <p className="mt-1 text-sm text-stone-500">
            Confirm when you received cash, bank transfer, card, or Bitcoin.
            This locks the booking as confirmed.
          </p>
          <form action={markDepositPaid} className="mt-4 space-y-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <div>
              <Label htmlFor="paymentMethod">Payment method</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                defaultValue={
                  booking.payments.some((p) => p.method === "BITCOIN")
                    ? "BITCOIN"
                    : "MANUAL"
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="MANUAL">Manual (cash / transfer)</option>
                <option value="BITCOIN">Bitcoin</option>
                <option value="STRIPE">Card (Stripe)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="bitcoinTxId">
                Bitcoin transaction ID (if Bitcoin)
              </Label>
              <Input
                id="bitcoinTxId"
                name="bitcoinTxId"
                placeholder="txid…"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="notes">Payment notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Cash received · or BTC confirmed on-chain"
              />
            </div>
            <Button type="submit">Confirm deposit & booking</Button>
          </form>
        </Card>
      )}

      {booking.status !== "CANCELLED" && (
        <form action={cancelBooking}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <Button type="submit" variant="danger">
            Cancel booking (frees calendar)
          </Button>
        </form>
      )}
    </div>
  );
}
