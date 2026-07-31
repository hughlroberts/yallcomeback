"use server";

import { redirect } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { calculateQuote } from "@/lib/pricing";
import { isRangeAvailable } from "@/lib/availability";
import { revalidatePath } from "next/cache";
import {
  getBitcoinAddress,
  isBitcoinEnabled,
  quoteBtcFromUsd,
} from "@/lib/bitcoin";

export async function createBooking(formData: FormData) {
  const propertyId = String(formData.get("propertyId") || "");
  const checkIn = String(formData.get("checkIn") || "");
  const checkOut = String(formData.get("checkOut") || "");
  const guests = Number(formData.get("guests") || 1);
  const pets = Number(formData.get("pets") || 0);
  const guestNotes = String(formData.get("guestNotes") || "").trim() || null;
  const acceptedDisclaimer = formData.get("acceptDisclaimer") === "on";
  const sourceChannelRaw = String(formData.get("sourceChannel") || "host_site");
  const sourceChannel = ["host_site", "marketplace", "direct"].includes(
    sourceChannelRaw
  )
    ? sourceChannelRaw
    : "host_site";
  const payMethodRaw = String(formData.get("paymentMethod") || "").toLowerCase();

  if (!propertyId || !checkIn || !checkOut) {
    throw new Error("Missing required fields");
  }

  const session = await auth();
  let guestName = String(formData.get("guestName") || "").trim();
  let guestEmail = String(formData.get("guestEmail") || "").trim();
  let guestPhone = String(formData.get("guestPhone") || "").trim() || null;

  // Signed-in guests: use account profile (do not require form contact fields)
  if (session?.user?.id) {
    const profile = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        preferredName: true,
        email: true,
        phone: true,
      },
    });
    if (profile?.email) {
      guestEmail = profile.email;
      guestName =
        profile.preferredName?.trim() ||
        profile.name?.trim() ||
        profile.email;
      guestPhone = profile.phone?.trim() || guestPhone;
    }
  }

  if (!guestName || !guestEmail) {
    throw new Error(
      session?.user
        ? "Your account is missing a name or email. Update Account settings."
        : "Full name and email are required",
    );
  }
  if (!session?.user && !guestPhone) {
    throw new Error("Phone is required when you are not signed in");
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { seasons: true, host: true },
  });
  if (!property || !property.published) throw new Error("Property not found");

  if (sourceChannel === "marketplace") {
    if (!property.listOnMarketplace || !property.host.listOnMarketplace) {
      throw new Error("Property is not available on the marketplace");
    }
  }

  const checkInDate = new Date(checkIn + "T00:00:00");
  const checkOutDate = new Date(checkOut + "T00:00:00");

  if (!(await isRangeAvailable(property.id, checkInDate, checkOutDate))) {
    throw new Error("Dates not available");
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
  if (quote.error) throw new Error(quote.error);

  const hostDisclaimerText =
    property.disclaimer?.trim() ||
    property.host.defaultDisclaimer?.trim() ||
    null;
  // Guest must accept cancellation policy (always shown) and host disclaimer when present
  if (!acceptedDisclaimer) {
    throw new Error(
      "Please accept the cancellation policy and host disclosure to continue",
    );
  }
  const disclaimerText = [
    `Cancellation: ${property.cancellationPolicy} / long-term ${property.longTermCancellationPolicy}`,
    hostDisclaimerText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stripeEnabled = process.env.STRIPE_ENABLED === "true";
  const bitcoinOk = isBitcoinEnabled();

  let method: PaymentMethod = "MANUAL";
  if (payMethodRaw === "bitcoin") {
    if (!bitcoinOk) throw new Error("Bitcoin payments are not enabled");
    method = "BITCOIN";
  } else if (payMethodRaw === "card" || payMethodRaw === "stripe") {
    if (!stripeEnabled) throw new Error("Card payments are not enabled");
    method = "STRIPE";
  } else if (payMethodRaw === "manual") {
    method = "MANUAL";
  } else if (stripeEnabled) {
    method = "STRIPE";
  } else {
    method = "MANUAL";
  }

  const btcAddress = method === "BITCOIN" ? getBitcoinAddress() : null;
  let bitcoinAmountBtc: number | null = null;
  let bitcoinRateUsd: number | null = null;
  if (method === "BITCOIN") {
    const btcQuote = await quoteBtcFromUsd(quote.depositAmount);
    if (btcQuote) {
      bitcoinAmountBtc = btcQuote.btcAmount;
      bitcoinRateUsd = btcQuote.rateUsdPerBtc;
    }
  }

  // Re-check availability inside a transaction to shrink double-book races
  const booking = await prisma.$transaction(async (tx) => {
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
    const created = await tx.booking.create({
      data: {
        propertyId: property.id,
        userId: session?.user?.id,
        guestName,
        guestEmail,
        guestPhone,
        guestNotes,
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
        sourceChannel,
        disclaimerAccepted: disclaimerText,
        payments: {
          create: {
            amount: quote.depositAmount,
            method,
            status: "PENDING",
            bitcoinAddress: btcAddress,
            bitcoinAmountBtc,
            bitcoinRateUsd,
            notes:
              method === "BITCOIN"
                ? `Bitcoin deposit - pay ${quote.depositAmount.toFixed(2)} USD equivalent`
                : null,
          },
        },
      },
    });

    await tx.calendarBlock.create({
      data: {
        propertyId: property.id,
        bookingId: created.id,
        source: "BOOKING",
        startDate: checkInDate,
        endDate: checkOutDate,
        occupantName: guestName,
        notes: `Booking ${created.id} (${created.status})`,
      },
    });

    return created;
  });

  // Host “on booking” template → guest inbox (if enabled on this listing)
  let autoMsgConversationId: string | undefined;
  try {
    const { deliverBookingAutoMessage } = await import(
      "@/lib/booking-messages"
    );
    const delivered = await deliverBookingAutoMessage(booking.id, "ON_BOOKING");
    if (delivered.conversationId) {
      autoMsgConversationId = delivered.conversationId;
    }
  } catch (e) {
    console.error("[booking-messages:on-booking]", e);
  }

  revalidatePath(`/properties/${property.slug}`);
  revalidatePath(`/h/${property.host.slug}/properties/${property.slug}`);
  revalidatePath("/marketplace");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/messages");

  const { bookingAccessToken } = await import("@/lib/booking-access");
  const confirmParams = new URLSearchParams();
  confirmParams.set("t", bookingAccessToken(booking.id));
  if (method === "STRIPE") confirmParams.set("pendingStripe", "1");
  if (autoMsgConversationId) {
    confirmParams.set("inbox", autoMsgConversationId);
  }
  redirect(`/book/confirmation/${booking.id}?${confirmParams.toString()}`);
}

export async function markDepositPaid(formData: FormData) {
  const { ensureHostAccess, bookingScopeWhere } = await import("@/lib/scope");
  const access = await ensureHostAccess();

  const bookingId = String(formData.get("bookingId") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  const bitcoinTxId =
    String(formData.get("bitcoinTxId") || "").trim() || null;
  const methodOverride = String(formData.get("paymentMethod") || "")
    .trim()
    .toUpperCase();

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...bookingScopeWhere(access) },
    include: { payments: true },
  });
  if (!booking) throw new Error("Booking not found");

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    }),
    ...booking.payments
      .filter((p) => p.status === "PENDING")
      .map((p) => {
        const method: PaymentMethod =
          methodOverride === "BITCOIN" || p.method === "BITCOIN"
            ? "BITCOIN"
            : methodOverride === "STRIPE"
              ? "STRIPE"
              : p.method === "STRIPE"
                ? "STRIPE"
                : "MANUAL";
        return prisma.payment.update({
          where: { id: p.id },
          data: {
            status: "PAID",
            method,
            paidAt: new Date(),
            notes,
            ...(method === "BITCOIN" && bitcoinTxId
              ? { bitcoinTxId }
              : {}),
          },
        });
      }),
    prisma.calendarBlock.updateMany({
      where: { bookingId },
      data: {
        notes: `Confirmed booking - ${booking.guestName}`,
      },
    }),
  ]);

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function cancelBooking(formData: FormData) {
  const { ensureHostAccess, bookingScopeWhere } = await import("@/lib/scope");
  const access = await ensureHostAccess();

  const bookingId = String(formData.get("bookingId") || "");
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...bookingScopeWhere(access) },
  });
  if (!booking) throw new Error("Booking not found");

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    }),
    prisma.calendarBlock.deleteMany({
      where: { bookingId },
    }),
  ]);

  revalidatePath("/admin/bookings");
}
