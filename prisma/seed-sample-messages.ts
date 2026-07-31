/**
 * Demo guest ↔ host conversations for the Messages UI.
 * Safe to re-run: clears existing conversations first when wipe=true.
 */
import type { PrismaClient } from "@prisma/client";

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

export async function seedSampleMessages(
  prisma: PrismaClient,
  opts?: { wipe?: boolean },
) {
  if (opts?.wipe !== false) {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
  }

  const host = await prisma.host.findFirst({
    where: { slug: "cherokee-landing" },
    include: {
      users: { where: { role: "HOST" }, take: 1 },
      properties: {
        where: { published: true },
        orderBy: { title: "asc" },
        take: 4,
      },
    },
  });
  if (!host) {
    console.warn("[seed-sample-messages] Cherokee Landing host not found");
    return;
  }

  const hostUserId = host.users[0]?.id ?? null;
  const lakefront =
    host.properties.find((p) => p.slug.includes("lakefront")) ||
    host.properties[0];
  const upper =
    host.properties.find((p) => p.slug.includes("upper")) ||
    host.properties[1] ||
    lakefront;
  const lower =
    host.properties.find((p) => p.slug.includes("lower")) ||
    host.properties[2] ||
    lakefront;

  const bookingSarah = await prisma.booking.findFirst({
    where: {
      guestEmail: "sarah.mitchell@example.com",
      propertyId: lakefront?.id,
    },
    orderBy: { createdAt: "desc" },
  });
  const bookingOrtiz = await prisma.booking.findFirst({
    where: { guestEmail: "ortiz.family@example.com" },
    orderBy: { createdAt: "desc" },
  });
  const bookingDana = await prisma.booking.findFirst({
    where: { guestEmail: "dana.foster@example.com" },
    orderBy: { createdAt: "desc" },
  });

  // 1) Active thread on lakefront (Sarah) — multi-message back and forth
  if (lakefront) {
    const t1 = await prisma.conversation.create({
      data: {
        hostId: host.id,
        propertyId: lakefront.id,
        bookingId: bookingSarah?.id,
        guestName: "Sarah Mitchell",
        guestEmail: "sarah.mitchell@example.com",
        guestPhone: "903-555-0142",
        subject: "Dock access & early check-in?",
        status: "OPEN",
        lastMessageAt: hoursAgo(2),
        createdAt: daysAgo(3),
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: t1.id,
          senderRole: "GUEST",
          body: "Hi! We’re excited for our stay at the lakefront house. Is early check-in possible on Saturday, and can we leave a boat at the dock overnight?",
          channel: "IN_APP",
          createdAt: daysAgo(3),
        },
        {
          conversationId: t1.id,
          senderRole: "HOST",
          senderUserId: hostUserId,
          body: "Welcome, Sarah! Early check-in around 2pm usually works if the cleaners are done. You’re welcome to leave a boat at the private dock overnight — just use the cleats on the left side.",
          channel: "IN_APP",
          createdAt: daysAgo(2.8),
        },
        {
          conversationId: t1.id,
          senderRole: "GUEST",
          body: "Perfect, thank you. Also bringing one small dog — anything we should know about the yard?",
          channel: "IN_APP",
          createdAt: daysAgo(2),
        },
        {
          conversationId: t1.id,
          senderRole: "HOST",
          senderUserId: hostUserId,
          body: "Dogs are welcome with the pet fee on your booking. The yard is fenced on three sides; please keep her leashed near the dock. Looking forward to hosting you!",
          channel: "IN_APP",
          createdAt: hoursAgo(2),
          externalStatus: "auto",
        },
      ],
    });
  }

  // 2) Ortiz family — short pre-arrival access thread
  if (upper) {
    const t2 = await prisma.conversation.create({
      data: {
        hostId: host.id,
        propertyId: upper.id,
        bookingId: bookingOrtiz?.id,
        guestName: "James & Kelly Ortiz",
        guestEmail: "ortiz.family@example.com",
        guestPhone: "214-555-0199",
        subject: "Access instructions for Upper Eagles Nest",
        status: "OPEN",
        lastMessageAt: hoursAgo(20),
        createdAt: daysAgo(1),
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: t2.id,
          senderRole: "HOST",
          senderUserId: hostUserId,
          body: "Hi James & Kelly — your stay at Upper Eagles Nest is almost here!\n\nCheck-in after 4:00 PM. Gate code: 4821#. Keys are in the lockbox by the side door (code same as gate).\n\nWi‑Fi: CherokeeGuest / lakeview2026\n\nText us if you need anything.",
          channel: "IN_APP",
          createdAt: hoursAgo(22),
          externalStatus: "auto",
        },
        {
          conversationId: t2.id,
          senderRole: "GUEST",
          body: "Got it, thanks! Is there a grocery store you recommend nearby?",
          channel: "IN_APP",
          createdAt: hoursAgo(20),
        },
      ],
    });
  }

  // 3) Dana — completed stay, thank-you thread (still open for demo inbox)
  if (lakefront) {
    const t3 = await prisma.conversation.create({
      data: {
        hostId: host.id,
        propertyId: lakefront.id,
        bookingId: bookingDana?.id,
        guestName: "Dana Foster",
        guestEmail: "dana.foster@example.com",
        subject: "Thank you for a great stay",
        status: "OPEN",
        lastMessageAt: daysAgo(5),
        createdAt: daysAgo(12),
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: t3.id,
          senderRole: "GUEST",
          body: "We had an amazing week — the dock sunsets were unreal. Thanks for the pontoon tip!",
          channel: "IN_APP",
          createdAt: daysAgo(6),
        },
        {
          conversationId: t3.id,
          senderRole: "HOST",
          senderUserId: hostUserId,
          body: "So glad you enjoyed it, Dana. You’re welcome back anytime — ask us about the shoulder-season rates if you’re planning fall.",
          channel: "IN_APP",
          createdAt: daysAgo(5),
        },
      ],
    });
  }

  // 4) Inquiry without booking — general question
  if (lower) {
    const t4 = await prisma.conversation.create({
      data: {
        hostId: host.id,
        propertyId: lower.id,
        guestName: "Alex Rivera",
        guestEmail: "alex.rivera@example.com",
        guestPhone: "512-555-0177",
        subject: "Availability for Labor Day weekend?",
        status: "OPEN",
        lastMessageAt: hoursAgo(5),
        createdAt: hoursAgo(30),
      },
    });
    await prisma.message.createMany({
      data: [
        {
          conversationId: t4.id,
          senderRole: "GUEST",
          body: "Hi — do you have Lower Eagles Nest open Fri–Mon for Labor Day? Party of 6, no pets.",
          channel: "IN_APP",
          createdAt: hoursAgo(30),
        },
        {
          conversationId: t4.id,
          senderRole: "HOST",
          senderUserId: hostUserId,
          body: "Hi Alex — that weekend is popular. I’ve got Fri–Mon open right now at the standard rate plus holiday min nights. Want me to hold dates while you book on the site?",
          channel: "IN_APP",
          createdAt: hoursAgo(5),
        },
      ],
    });
  }

  // 5) Booking confirmation auto-style message (Chris Walton)
  const bookingChris = await prisma.booking.findFirst({
    where: { guestEmail: "chris.walton@example.com" },
    orderBy: { createdAt: "desc" },
  });
  if (upper && bookingChris) {
    const t5 = await prisma.conversation.create({
      data: {
        hostId: host.id,
        propertyId: upper.id,
        bookingId: bookingChris.id,
        guestName: bookingChris.guestName,
        guestEmail: bookingChris.guestEmail,
        subject: "Booking confirmation · Upper Eagles Nest",
        status: "OPEN",
        lastMessageAt: hoursAgo(48),
        createdAt: hoursAgo(50),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: t5.id,
        senderRole: "HOST",
        senderUserId: hostUserId,
        body: `Hi ${bookingChris.guestName}, thanks for booking Upper Eagles Nest @ Cedar Creek!

We're glad you're staying with us. Check-in details and access instructions will arrive closer to your dates.

— Cherokee Landing`,
        channel: "IN_APP",
        createdAt: hoursAgo(50),
        externalStatus: "auto",
      },
    });
    await prisma.booking.update({
      where: { id: bookingChris.id },
      data: { autoMsgOnBookingSentAt: hoursAgo(50) },
    });
  }

  const count = await prisma.conversation.count({
    where: { hostId: host.id },
  });
  console.log(
    `[seed-sample-messages] ${count} demo conversations for ${host.name}`,
  );
}
