"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  parseRefundAmount,
  refundBookingDeposit,
  refundableRemaining,
} from "@/lib/booking-refunds";

function back(bookingId: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/admin/bookings/${encodeURIComponent(bookingId)}?${q}`);
}

/**
 * Platform admin only: refund a guest's card deposit through Stripe.
 * Blank amount = full refund of what is still refundable.
 */
export async function adminRefundBookingDeposit(formData: FormData) {
  // Server-side gate: re-reads role=ADMIN from the database.
  const admin = await requirePlatformAdmin();
  if (!admin?.user?.id) {
    throw new Error("Only platform admins can refund card deposits.");
  }

  const bookingId = String(formData.get("bookingId") || "").trim();
  if (!bookingId) throw new Error("Missing booking id");
  const rawAmount = String(formData.get("amount") || "");
  const reason =
    String(formData.get("reason") || "")
      .trim()
      .slice(0, 450) || null;
  const cancel = formData.get("cancelBooking") === "on";

  const payment = await prisma.payment.findFirst({
    where: { bookingId, method: "STRIPE", status: "PAID" },
    orderBy: { createdAt: "asc" },
  });
  if (!payment) {
    back(bookingId, { refundError: "No paid card deposit on this booking." });
  }
  const parsed = parseRefundAmount(rawAmount, refundableRemaining(payment));
  if (!parsed.ok) back(bookingId, { refundError: parsed.error });

  const label = admin.user.email || `admin:${admin.user.id}`;
  let message: string;
  let ok = false;
  try {
    const result = await refundBookingDeposit({
      bookingId,
      amountUsd: parsed.full ? null : parsed.amount,
      actor: { userId: admin.user.id, label },
      reason,
      cancelBooking: cancel,
    });
    ok = result.ok;
    if (result.ok && cancel) {
      const { sendCancellationEmails } = await import("@/lib/booking-emails");
      await sendCancellationEmails(bookingId, "HOST", {
        refundedAmount: result.amount,
      });
    }
    message = result.ok
      ? `Refunded $${result.amount.toFixed(2)} (${result.refundId}).`
      : result.error;
  } catch (e) {
    console.error("[refund] admin refund failed", bookingId, e);
    message =
      e instanceof Error && e.message
        ? `Stripe refused the refund: ${e.message}`
        : "Stripe refused the refund.";
  }

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  back(bookingId, ok ? { refunded: message } : { refundError: message });
}
