/**
 * Pay-first agent stay checkout.
 * Stripe Checkout is created first. Calendar is written only after the
 * charge webhook. Abandoned sessions expire; they never hold the calendar.
 */
import { prisma } from "@/lib/db";
import { calculateQuote } from "@/lib/pricing";
import { isRangeAvailable, lockPropertyBookings } from "@/lib/availability";
import { isYmd } from "@/lib/search-dates";
import { marketplacePropertyWhere } from "@/lib/host";
import { isStripeConfigured } from "@/lib/stripe";
import { canHostAddFutureWork } from "@/lib/hosting";

export const AGENT_CHECKOUT_TTL_SEC = 30 * 60;

export type AgentCheckoutInput = {
  slug: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  pets?: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  acceptTerms?: boolean;
  paid?: unknown;
};

export type AgentCheckoutResult =
  | {
      ok: true;
      checkoutUrl: string;
      expiresAt: string;
      bookingId: string;
      quote: { nights: number; depositAmount: number; totalAmount: number };
    }
  | { ok: false; status: number; error: string };

export async function createAgentStayCheckout(
  input: AgentCheckoutInput,
): Promise<AgentCheckoutResult> {
  if (input.paid === true || input.paid === "true") {
    return {
      ok: false,
      status: 400,
      error: "Agents cannot mark a stay paid. Card checkout is required.",
    };
  }
  if (!input.acceptTerms) {
    return {
      ok: false,
      status: 400,
      error: "acceptTerms must be true (host cancellation policy and Terms).",
    };
  }

  const slug = (input.slug || "").trim();
  const checkIn = (input.checkIn || "").trim();
  const checkOut = (input.checkOut || "").trim();
  const guestName = (input.guestName || "").trim();
  const guestEmail = (input.guestEmail || "").trim();
  if (!slug || !isYmd(checkIn) || !isYmd(checkOut)) {
    return {
      ok: false,
      status: 400,
      error: "slug, checkIn, and checkOut (YYYY-MM-DD) are required.",
    };
  }
  if (!guestName || !guestEmail || !guestEmail.includes("@")) {
    return {
      ok: false,
      status: 400,
      error: "guestName and guestEmail are required.",
    };
  }

  const guests = Math.max(1, Math.floor(Number(input.guests) || 1));
  const pets = Math.max(0, Math.floor(Number(input.pets) || 0));
  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");
  if (!(checkOutDate > checkInDate)) {
    return {
      ok: false,
      status: 400,
      error: "checkOut must be after checkIn.",
    };
  }

  const property = await prisma.property.findFirst({
    where: { slug, ...marketplacePropertyWhere() },
    include: { seasons: true, host: true },
  });
  if (!property || !property.published || !property.listOnMarketplace) {
    return { ok: false, status: 404, error: "Listing not found or not on marketplace" };
  }
  if (!canHostAddFutureWork(property.host)) {
    return {
      ok: false,
      status: 409,
      error: "This host is not taking new stays right now.",
    };
  }
  if (guests > property.maxGuests) {
    return {
      ok: false,
      status: 400,
      error: `This stay allows up to ${property.maxGuests} guests.`,
    };
  }
  if (pets > 0 && !property.petsAllowed) {
    return { ok: false, status: 400, error: "This stay does not allow pets." };
  }

  if (!isStripeConfigured() || !property.host.stripeAccountId) {
    return {
      ok: false,
      status: 409,
      error: "This listing is not ready to take a card deposit.",
    };
  }

  if (!(await isRangeAvailable(property.id, checkInDate, checkOutDate))) {
    return { ok: false, status: 409, error: "Dates not available" };
  }

  const taxLines = await prisma.hostTaxLine.findMany({
    where: { hostId: property.hostId, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const quote = calculateQuote({
    property,
    seasons: property.seasons,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    pets,
    taxLines,
    taxLiabilityAcknowledged: property.host.taxLiabilityAcknowledged,
  });
  if (quote.error) {
    return { ok: false, status: 400, error: quote.error };
  }

  const disclaimerText = [
    `Cancellation: ${property.cancellationPolicy} / long-term ${property.longTermCancellationPolicy}`,
    property.disclaimer?.trim() || property.host.defaultDisclaimer?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const booking = await prisma.$transaction(async (tx) => {
    await lockPropertyBookings(tx, property.id);
    if (
      !(await isRangeAvailable(
        property.id,
        checkInDate,
        checkOutDate,
        undefined,
        tx,
      ))
    ) {
      throw new Error("Dates not available");
    }
    return tx.booking.create({
      data: {
        propertyId: property.id,
        guestName,
        guestEmail,
        guestPhone: input.guestPhone?.trim() || null,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests,
        pets: quote.pets,
        nights: quote.nights,
        nightlySubtotal: quote.nightlySubtotal,
        cleaningFee: quote.cleaningFee,
        petFee: quote.petFee,
        taxAmount: quote.taxAmount,
        taxBreakdown: quote.taxBreakdownJson,
        totalAmount: quote.totalAmount,
        depositAmount: quote.depositAmount,
        status: "PENDING_PAYMENT",
        sourceChannel: "agent",
        disclaimerAccepted: disclaimerText,
        payments: {
          create: {
            amount: quote.depositAmount,
            method: "STRIPE",
            status: "PENDING",
          },
        },
      },
    });
  });

  const { createDirectChargeCheckout, depositCheckoutName } = await import(
    "@/lib/stripe-connect"
  );
  const { toStripeAmount } = await import("@/lib/stripe");
  const { bookingAccessToken } = await import("@/lib/booking-access");
  const confirmParams = new URLSearchParams();
  confirmParams.set("t", bookingAccessToken(booking.id));

  const expiresAt = Math.floor(Date.now() / 1000) + AGENT_CHECKOUT_TTL_SEC;
  const session = await createDirectChargeCheckout({
    accountId: property.host.stripeAccountId,
    name: depositCheckoutName(property.title),
    amountCents: toStripeAmount(quote.depositAmount),
    successPath: `/book/confirmation/${booking.id}?${confirmParams.toString()}`,
    cancelPath: `/book/${property.slug}`,
    customerEmail: guestEmail,
    expiresAt,
    metadata: {
      kind: "booking_deposit",
      bookingId: booking.id,
      hostId: property.hostId,
      source: "agent",
    },
  });

  if (!session.url) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    });
    return {
      ok: false,
      status: 502,
      error: "Card checkout did not start. Try again.",
    };
  }

  return {
    ok: true,
    checkoutUrl: session.url,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    bookingId: booking.id,
    quote: {
      nights: quote.nights,
      depositAmount: quote.depositAmount,
      totalAmount: quote.totalAmount,
    },
  };
}

/** Cancel unpaid agent stays whose Checkout window has passed. No calendar to free. */
export async function expireAbandonedAgentCheckouts(now = new Date()) {
  const cutoff = new Date(now.getTime() - (AGENT_CHECKOUT_TTL_SEC + 60) * 1000);
  const stale = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      sourceChannel: "agent",
      createdAt: { lt: cutoff },
    },
    select: { id: true },
    take: 50,
  });
  let cancelled = 0;
  for (const row of stale) {
    await prisma.booking.update({
      where: { id: row.id },
      data: { status: "CANCELLED" },
    });
    cancelled += 1;
  }
  return { cancelled };
}
