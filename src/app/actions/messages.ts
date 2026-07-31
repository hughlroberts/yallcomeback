"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispatchEmail, dispatchSms } from "@/lib/messaging";
import { ensureHostAccess } from "@/lib/scope";

export async function startGuestConversation(formData: FormData) {
  const propertyId = String(formData.get("propertyId") || "");
  const bookingId = String(formData.get("bookingId") || "") || null;
  const guestName = String(formData.get("guestName") || "").trim();
  const guestEmail = String(formData.get("guestEmail") || "").trim();
  const guestPhone = String(formData.get("guestPhone") || "").trim() || null;
  const subject = String(formData.get("subject") || "").trim() || null;
  const body = String(formData.get("body") || "").trim();

  if (!propertyId || !guestName || !guestEmail || !body) {
    throw new Error("Name, email, and message are required");
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { host: true },
  });
  if (!property || !property.published) throw new Error("Property not found");

  const session = await auth();

  const conversation = await prisma.conversation.create({
    data: {
      hostId: property.hostId,
      propertyId: property.id,
      bookingId,
      guestUserId: session?.user?.id,
      guestName,
      guestEmail,
      guestPhone,
      subject: subject || `Question about ${property.title}`,
      lastMessageAt: new Date(),
      messages: {
        create: {
          senderRole: "GUEST",
          senderUserId: session?.user?.id,
          body,
          channel: "IN_APP",
        },
      },
    },
  });

  // Optional hosted-portal hooks (no-op when not configured)
  if (property.host.contactEmail) {
    await dispatchEmail({
      to: property.host.contactEmail,
      subject: subject || `New message · ${property.title}`,
      body: `${guestName} (${guestEmail}):\n\n${body}`,
      conversationId: conversation.id,
    });
  }

  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath(`/messages/${conversation.id}`);
  redirect(`/messages/${conversation.id}?sent=1`);
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
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Hosted portal: notify the other party via SMS/email hooks when configured
  if (senderRole === "HOST") {
    if (conversation.guestPhone) {
      const sms = await dispatchSms({
        to: conversation.guestPhone,
        body: `Message from ${conversation.host.name}: ${body.slice(0, 140)}`,
        conversationId,
      });
      if (sms.attempted) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            externalStatus: sms.status,
            externalId: sms.externalId,
          },
        });
      }
    }
    await dispatchEmail({
      to: conversation.guestEmail,
      subject: `Reply from ${conversation.host.name}`,
      body,
      conversationId,
    });
  } else if (conversation.host.contactEmail) {
    await dispatchEmail({
      to: conversation.host.contactEmail,
      subject: `Guest reply · ${conversation.property?.title || "stay"}`,
      body: `${conversation.guestName}: ${body}`,
      conversationId,
    });
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
