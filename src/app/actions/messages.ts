"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureHostAccess } from "@/lib/scope";
import { incomingIp } from "@/lib/rate-limit";
import { parseTrip, submitInquiry } from "@/lib/inquiries/submit";
import {
  deliverGuestMessageToHosts,
  deliverHostMessageToGuest,
} from "@/lib/conversation-delivery";
import {
  HONEYPOT_FIELD,
  STAMP_FIELD,
  TURNSTILE_FIELD,
  checkFormStamp,
  honeypotTripped,
  verifyTurnstile,
} from "@/lib/inquiries/human-checks";

export type GuestInquiryState = {
  ok?: boolean;
  error?: string;
  /** Email the host will reply to (shown on the success screen) */
  sentTo?: string;
};

/**
 * Pre-booking question from the listing page / host site (signed in or not).
 * - Listing / booking: pass propertyId (optional bookingId)
 * - Host website contact: pass hostId only (no listing required)
 * Web-only bot checks: honeypot, minimum fill time, optional Turnstile.
 * Shared checks (content, rate limits, dedupe, instant host email with flood bundling) live in
 * submitInquiry, which the /api/v1 agent endpoint also uses.
 */
export async function startGuestConversation(
  _prev: GuestInquiryState | undefined,
  formData: FormData,
): Promise<GuestInquiryState> {
  const ip = await incomingIp();
  const guestEmail = String(formData.get("guestEmail") || "").trim();

  // Bots that fill the hidden field get a quiet "sent" and nothing is saved.
  if (honeypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true, sentTo: guestEmail };
  }
  const stamp = checkFormStamp(String(formData.get(STAMP_FIELD) || ""));
  if (!stamp.ok) {
    return {
      error:
        stamp.reason === "too_fast"
          ? "That was quick! Take a second to check your message, then send again."
          : "This form expired. Close it, open it again, and resend.",
    };
  }
  const turnstile = await verifyTurnstile(formData.get(TURNSTILE_FIELD), ip);
  if (!turnstile.ok) {
    return {
      error:
        "Please complete the quick check above the Send button and try again.",
    };
  }

  const session = await auth();
  const result = await submitInquiry(
    {
      propertyId: String(formData.get("propertyId") || "").trim() || null,
      hostId: String(formData.get("hostId") || "").trim() || null,
      bookingId: String(formData.get("bookingId") || "").trim() || null,
      guestName: String(formData.get("guestName") || ""),
      guestEmail,
      guestPhone: String(formData.get("guestPhone") || ""),
      subject: String(formData.get("subject") || ""),
      body: String(formData.get("body") || ""),
      trip: parseTrip({
        checkIn: formData.get("tripCheckIn"),
        checkOut: formData.get("tripCheckOut"),
        guests: formData.get("tripGuests"),
      }),
    },
    { source: "WEB", ip, sessionUserId: session?.user?.id ?? null },
  );
  if (!result.ok) {
    if (result.status === 429) {
      const min = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));
      const wait =
        min >= 90
          ? `${Math.ceil(min / 60)} hours`
          : `${min} minute${min === 1 ? "" : "s"}`;
      return { error: `${result.error} Try again in about ${wait}.` };
    }
    return { error: result.error };
  }

  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath(`/messages/${result.conversationId}`);
  // Signed-in guests land in their thread; others see a success screen
  // (Messages needs a login).
  if (session?.user?.id) {
    redirect(`/messages/${result.conversationId}?sent=1`);
  }
  return { ok: true, sentTo: guestEmail.toLowerCase() };
}

export async function replyToConversation(formData: FormData) {
  const conversationId = String(formData.get("conversationId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!conversationId || !body) throw new Error("Message required");

  const session = await auth();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { host: true, property: true },
  });
  if (!conversation) throw new Error("Conversation not found");

  let senderRole = "GUEST";
  if (session?.user) {
    if (session.user.role === "ADMIN") {
      senderRole = "HOST";
    } else if (
      session.user.role === "HOST" &&
      session.user.hostId === conversation.hostId
    ) {
      senderRole = "HOST";
    } else if (session.user.email === conversation.guestEmail) {
      senderRole = "GUEST";
    } else if (session.user.id === conversation.guestUserId) {
      senderRole = "GUEST";
    } else {
      throw new Error("Not allowed");
    }
  } else {
    throw new Error("Sign in to reply");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderRole,
      senderUserId: session.user.id,
      body,
      channel: "IN_APP",
      // Guest messages go through the host email queue (instant, bundled
      // only during a flood).
      hostNotifyPending: senderRole === "GUEST",
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  if (senderRole === "HOST") {
    await deliverHostMessageToGuest(conversation, message.id, body);
  } else {
    await deliverGuestMessageToHosts(conversation.hostId);
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  revalidatePath(`/admin/messages/${conversationId}`);
  revalidatePath("/admin/messages");
}

export async function hostReplyToConversation(formData: FormData) {
  await ensureHostAccess();
  await replyToConversation(formData);
}

/** Host-only private notes on a booking (not visible to guests). */
export async function updateBookingHostNotes(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in required");

  const bookingId = String(formData.get("bookingId") || "");
  const conversationId = String(formData.get("conversationId") || "");
  const adminNotes = String(formData.get("adminNotes") || "").trim() || null;
  if (!bookingId) throw new Error("Booking required");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { hostId: true } } },
  });
  if (!booking) throw new Error("Booking not found");

  const isPlatform = session.user.role === "ADMIN";
  const isHost =
    session.user.role === "HOST" &&
    session.user.hostId === booking.property.hostId;
  if (!isPlatform && !isHost) throw new Error("Not allowed");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { adminNotes },
  });

  if (conversationId) {
    revalidatePath(`/messages/${conversationId}`);
    revalidatePath(`/admin/messages/${conversationId}`);
  }
  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath("/admin/bookings");
}
