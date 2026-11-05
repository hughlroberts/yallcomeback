import Link from "next/link";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDateUS, formatMoney, nightsBetween } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import { markCalendarBlockInvoicePaid } from "@/app/actions/properties";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  blockIsPaid,
  blockTypeLabel,
  directBookingBlockWhere,
  directPaymentLabel,
} from "@/lib/admin-bookings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Direct booking · Admin" };

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-stone-100 py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-stone-500">{label}</dt>
      <dd className="min-w-0 break-words text-stone-900">{children}</dd>
    </div>
  );
}

/** Details for a manual / offline booking logged from the calendar. */
export default async function AdminDirectBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/bookings");
  const { id } = await params;

  const block = await prisma.calendarBlock.findFirst({
    where: {
      id,
      ...directBookingBlockWhere(),
      property: propertyScopeWhere(access),
    },
    include: { property: { select: { id: true, title: true } } },
  });
  if (!block) notFound();

  const paid = blockIsPaid(block);
  const nights = nightsBetween(block.startDate, block.endDate);
  const checkIn = block.startDate.toISOString().slice(0, 10);
  const checkOut = block.endDate.toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl space-y-5">
      <p>
        <Link
          href="/admin/bookings"
          className={`text-sm font-medium text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
        >
          ← Bookings
        </Link>
      </p>
      <div>
        <h1 className="break-words text-2xl font-semibold">
          {block.occupantName?.trim() || blockTypeLabel(block.blockType)}
        </h1>
        <p className="break-words text-stone-500">
          {block.property.title} · {blockTypeLabel(block.blockType)}
        </p>
      </div>

      <Card className="text-sm">
        <dl>
          <Row label="Guest">{block.occupantName?.trim() || "Not set"}</Row>
          <Row label="Contact">
            {block.guestEmail || block.guestPhone ? (
              <span className="flex flex-col gap-1">
                {block.guestEmail ? (
                  <a
                    href={`mailto:${block.guestEmail}`}
                    className={`text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
                  >
                    {block.guestEmail}
                  </a>
                ) : null}
                {block.guestPhone ? (
                  <a
                    href={`tel:${block.guestPhone.replace(/[^\d+]/g, "")}`}
                    className={`text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
                  >
                    {block.guestPhone}
                  </a>
                ) : null}
              </span>
            ) : (
              "Not set"
            )}
          </Row>
          <Row label="Dates">
            {formatDateUS(checkIn)} → {formatDateUS(checkOut)} ({nights} night
            {nights === 1 ? "" : "s"})
          </Row>
          <Row label="Party size">
            {block.guestCount
              ? `${block.guestCount} guest${block.guestCount === 1 ? "" : "s"}`
              : "Not set"}
          </Row>
          <Row label="Payment method">
            {directPaymentLabel(block.paymentMethod)}
          </Row>
          <Row label="Amount">
            {block.invoiceAmount != null
              ? formatMoney(block.invoiceAmount)
              : "Not set"}
          </Row>
          <Row label="Paid">
            {paid ? (
              <span className="font-semibold text-emerald-700">
                Paid
                {block.invoicePaidAt
                  ? ` · ${formatDateUS(block.invoicePaidAt)}`
                  : ""}
              </span>
            ) : (
              <span className="font-semibold text-amber-800">
                Not paid
                {block.invoiceStatus === "OPEN" ? " · invoice sent" : ""}
              </span>
            )}
          </Row>
          <Row label="Notes">
            {block.notes ? (
              <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{block.notes}</span>
            ) : (
              "None"
            )}
          </Row>
        </dl>
        {block.stripeHostedInvoiceUrl ? (
          <a
            href={block.stripeHostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 inline-block text-xs font-medium text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
          >
            Open Stripe invoice →
          </a>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-3">
        {!paid ? (
          <form action={markCalendarBlockInvoicePaid}>
            <input type="hidden" name="id" value={block.id} />
            <input type="hidden" name="propertyId" value={block.property.id} />
            <SubmitButton variant="secondary">Mark paid</SubmitButton>
          </form>
        ) : null}
        <Link
          href={`/admin/properties/${block.property.id}?tab=blocks`}
          className={`inline-flex min-h-11 items-center text-sm font-medium text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
        >
          Edit in Blocks tab →
        </Link>
      </div>
    </div>
  );
}
