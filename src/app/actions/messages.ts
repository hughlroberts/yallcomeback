"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dispatchEmail, dispatchSms } from "@/lib/messaging";
import { ensureHostAccess } from "@/lib/scope";

async function hostNotifyEmails(hostId: string, contactEmail: string | null) {
  const emails = new Set<string>();
  if (contactEmail?.includes("@")) {
    emails.add(contactEmail.trim().toLowerCase());
  }
  const users = await prisma.user.findMany({
    where: {
      hostId,
      role: { in: ["HOST", "ADMIN"] },
      emailNotifications: true,
    },
    select: { email: true },
  });
  for (const u of users) {
    if (u.email?.includes("@")) emails.add(u.email.trim().toLowerCase());
  }
  return [...emails];
}

async function guestWantsEmail(
  guestEmail: string,
  guestUserId: string | null,
): Promise<boolean> {
  if (guestUserId) {
    const u = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { emailNotifications: true },
    });
    if (u) return u.emailNotifications;
  }
  const byEmail = await prisma.user.findUnique({
    where: { email: guestEmail.trim().toLowerCase() },
    select: { emailNotifications: true },
  });
  if (byEmail) return byEmail.emailNotifications;
  // Unregistered guest who left an email — always try email
  return true;
}

async function guestWantsSms(
  guestUserId: string | null,
  guestEmail: string,
): Promise<boolean> {
  if (guestUserId) {
    const u = await prisma.user.findUnique({
      where: { id: guestUserId },
      select: { smsNotifications: true },
    });
    if (u) return u.smsNotifications;
  }
  const byEmail = await prisma.user.findUnique({
    where: { email: guestEmail.trim().toLowerCase() },
    select: { smsNotifications: true },
  });
  if (byEmail) return byEmail.smsNotifications;
  // Unregistered: only if phone present and SMS enabled at platform — still opt-in false by default
  return false;
}

function mergeExternalStatus(
  existing: string | null | undefined,
  next: string,
): string {
  if (!existing) return next;
  if (existing.includes(next)) return existing;
  return `${existing},${next}`;
}

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

  // Email host(s) about the new guest message
  const hostEmails = await hostNotifyEmails(
    property.hostId,
    property.host.contactEmail,
  );
  const emailSubject =
    subject || `New message · ${property.title}`;
  const emailBody = `${guestName} (${guestEmail}) wrote about ${property.title}:\n\n${body}`;

  let externalStatus: string | null = null;
  let externalId: string | null = null;
  for (const to of hostEmails) {
    const result = await dispatchEmail({
      to,
      subject: emailSubject,
      body: emailBody,
      conversationId: conversation.id,
      replyPath: `/admin/messages/${conversation.id}`,
    });
    if (result.attempted) {
      externalStatus = mergeExternalStatus(
        externalStatus,
        `email:${result.status}`,
      );
      if (result.externalId) externalId = result.externalId;
    }
  }

  if (externalStatus) {
    const firstMsg = await prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    if (firstMsg) {
      await prisma.message.update({
        where: { id: firstMsg.id },
        data: { externalStatus, externalId },
      });
    }
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

  let externalStatus: string | null = null;
  let externalId: string | null = null;

  if (senderRole === "HOST") {
    // Host → guest: email the customer's address on the conversation
    const wantEmail = await guestWantsEmail(
      conversation.guestEmail,
      conversation.guestUserId,
    );
    if (wantEmail) {
      const email = await dispatchEmail({
        to: conversation.guestEmail,
        subject: `Message from ${conversation.host.name}`,
        body: `${conversation.host.name} wrote:\n\n${body}`,
        conversationId,
        replyPath: `/messages/${conversationId}`,
      });
      if (email.attempted) {
        externalStatus = mergeExternalStatus(
          externalStatus,
          `email:${email.status}`,
        );
        if (email.externalId) externalId = email.externalId;
      }
    }

    // SMS only when platform ops has enabled it and guest opted in (ops product)
    const wantSms = await guestWantsSms(
      conversation.guestUserId,
      conversation.guestEmail,
    );
    if (wantSms && conversation.guestPhone) {
      const sms = await dispatchSms({
        to: conversation.guestPhone,
        body: `${conversation.host.name}: ${body.slice(0, 140)}`,
        conversationId,
      });
      if (sms.attempted) {
        externalStatus = mergeExternalStatus(
          externalStatus,
          `sms:${sms.status}`,
        );
        if (sms.externalId) externalId = sms.externalId;
      }
    }
  } else {
    // Guest → host: email host contact + host users
    const hostEmails = await hostNotifyEmails(
      conversation.hostId,
      conversation.host.contactEmail,
    );
    const title = conversation.property?.title || "your stay";
    for (const to of hostEmails) {
      const email = await dispatchEmail({
        to,
        subject: `Guest reply · ${title}`,
        body: `${conversation.guestName} wrote:\n\n${body}`,
        conversationId,
        replyPath: `/admin/messages/${conversationId}`,
      });
      if (email.attempted) {
        externalStatus = mergeExternalStatus(
          externalStatus,
          `email:${email.status}`,
        );
        if (email.externalId) externalId = email.externalId;
      }
    }
  }

  if (externalStatus) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        externalStatus,
        externalId,
      },
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
