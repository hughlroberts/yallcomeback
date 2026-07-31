/**
 * Sample bookings for admin / earnings / guest UI demos.
 * Safe to re-run: deletes prior SAMPLE-tagged bookings first.
 *
 *   npx tsx prisma/seed-sample-bookings.ts
 */
import { PrismaClient, type BookingStatus, type PaymentMethod, type PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_NOTE = "SAMPLE demo booking - safe to delete";

function ymd(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function money(
  nightly: number,
  nights: number,
  cleaning: number,
  petFee: number,
  depositPercent: number,
) {
  const nightlySubtotal = Math.round(nightly * nights * 100) / 100;
  const totalAmount =
    Math.round((nightlySubtotal + cleaning + petFee) * 100) / 100;
  const depositAmount =
    Math.round(totalAmount * (depositPercent / 100) * 100) / 100;
  return { nightlySubtotal, totalAmount, depositAmount, cleaningFee: cleaning, petFee };
}

type Sample = {
  propertySlug: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  pets?: number;
  status: BookingStatus;
  sourceChannel: string;
  guestNotes?: string;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt?: Date;
    notes?: string;
  };
  /** When true, paid amount = full stay total (better for earnings charts). */
  payFullStay?: boolean;
  /** Link to a guest user email if present */
  userEmail?: string;
};

const SAMPLES: Sample[] = [
  {
    propertySlug: "lakefront-private-dock",
    guestName: "Sarah Mitchell",
    guestEmail: "sarah.mitchell@example.com",
    guestPhone: "(214) 555-0142",
    checkIn: ymd(2026, 8, 7),
    checkOut: ymd(2026, 8, 10),
    guests: 6,
    pets: 1,
    status: "CONFIRMED",
    sourceChannel: "marketplace",
    guestNotes: "Arriving after 5pm - celebrating an anniversary. One medium dog.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 7, 10),
      notes: "Deposit received via bank transfer",
    },
  },
  {
    propertySlug: "upper-eagles-nest",
    guestName: "James & Kelly Ortiz",
    guestEmail: "ortiz.family@example.com",
    guestPhone: "(972) 555-0198",
    checkIn: ymd(2026, 7, 24),
    checkOut: ymd(2026, 7, 27),
    guests: 4,
    status: "CONFIRMED",
    sourceChannel: "host_site",
    guestNotes: "Need crib if available - will message host.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 7, 12),
    },
  },
  {
    propertySlug: "lower-eagles-nest",
    guestName: "Marcus Chen",
    guestEmail: "marcus.chen@example.com",
    guestPhone: "(469) 555-0110",
    checkIn: ymd(2026, 9, 4),
    checkOut: ymd(2026, 9, 8),
    guests: 3,
    status: "PENDING_PAYMENT",
    sourceChannel: "marketplace",
    guestNotes: "Fishing trip - boat ramp access?",
    payment: {
      method: "MANUAL",
      status: "PENDING",
      notes: "Awaiting deposit",
    },
  },
  {
    propertySlug: "back-eagles-nest",
    guestName: "Emily Brooks",
    guestEmail: "emily.brooks@example.com",
    checkIn: ymd(2026, 6, 12),
    checkOut: ymd(2026, 6, 15),
    guests: 2,
    status: "COMPLETED",
    sourceChannel: "host_site",
    guestNotes: "Quiet weekend away.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 5, 20),
      notes: "Stay completed - deposit applied to total",
    },
  },
  {
    propertySlug: "motel-kitchenette-a",
    guestName: "Tom Rivera",
    guestEmail: "tom.rivera@example.com",
    guestPhone: "(903) 555-0166",
    checkIn: ymd(2026, 8, 15),
    checkOut: ymd(2026, 8, 17),
    guests: 2,
    status: "PENDING_PAYMENT",
    sourceChannel: "marketplace",
    payment: {
      method: "BITCOIN",
      status: "PENDING",
      notes: "Bitcoin deposit option selected (demo)",
    },
  },
  {
    propertySlug: "motel-two-beds-a",
    guestName: "Priya Nair",
    guestEmail: "priya.nair@example.com",
    checkIn: ymd(2026, 10, 2),
    checkOut: ymd(2026, 10, 5),
    guests: 4,
    status: "CANCELLED",
    sourceChannel: "marketplace",
    guestNotes: "Had to cancel - work travel conflict.",
    payment: {
      method: "MANUAL",
      status: "REFUNDED",
      paidAt: ymd(2026, 7, 1),
      notes: "Deposit refunded after guest cancel",
    },
  },
  {
    propertySlug: "upper-eagles-nest",
    guestName: "Chris Walton",
    guestEmail: "chris.walton@example.com",
    guestPhone: "(817) 555-0133",
    checkIn: ymd(2026, 11, 20),
    checkOut: ymd(2026, 11, 24),
    guests: 5,
    pets: 2,
    status: "CONFIRMED",
    sourceChannel: "direct",
    guestNotes: "Thanksgiving week - two small dogs. Prefer ground-level access if possible.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 7, 15),
    },
  },
  {
    propertySlug: "lakefront-private-dock",
    guestName: "Dana Foster",
    guestEmail: "dana.foster@example.com",
    checkIn: ymd(2026, 5, 2),
    checkOut: ymd(2026, 5, 5),
    guests: 8,
    status: "COMPLETED",
    sourceChannel: "marketplace",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 4, 10),
    },
  },
 // --- Past performance pair: two properties, two months, full stay paid --- 
  {
    propertySlug: "lakefront-private-dock",
    guestName: "Robert Hayes",
    guestEmail: "robert.hayes@example.com",
    guestPhone: "(512) 555-0177",
    checkIn: ymd(2026, 3, 12),
    checkOut: ymd(2026, 3, 16),
    guests: 7,
    pets: 1,
    status: "COMPLETED",
    sourceChannel: "marketplace",
    guestNotes: "Spring break lake week - past stay for performance charts.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 3, 8),
      notes: "Full stay paid (demo) - March performance",
    },
    payFullStay: true,
  },
  {
    propertySlug: "lower-eagles-nest",
    guestName: "Angela Ruiz",
    guestEmail: "angela.ruiz@example.com",
    guestPhone: "(210) 555-0188",
    checkIn: ymd(2026, 5, 18),
    checkOut: ymd(2026, 5, 23),
    guests: 4,
    status: "COMPLETED",
    sourceChannel: "host_site",
    guestNotes: "Memorial Day weekend - past stay for reports.",
    payment: {
      method: "MANUAL",
      status: "PAID",
      paidAt: ymd(2026, 5, 10),
      notes: "Full stay paid (demo) - May performance",
    },
    payFullStay: true,
  },
];

export async function seedSampleBookings() {
  // Remove previous demo set (by admin notes tag)
  const old = await prisma.booking.findMany({
    where: { adminNotes: SAMPLE_NOTE },
    select: { id: true },
  });
  if (old.length) {
    await prisma.calendarBlock.deleteMany({
      where: { bookingId: { in: old.map((b) => b.id) } },
    });
    await prisma.payment.deleteMany({
      where: { bookingId: { in: old.map((b) => b.id) } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: old.map((b) => b.id) } },
    });
    console.log(`Removed ${old.length} previous sample booking(s).`);
  }

  // Optional guest user for “My bookings” if they register later
  let guestUserId: string | undefined;
  const guest = await prisma.user.findUnique({
    where: { email: "guest@example.com" },
  });
  if (guest) guestUserId = guest.id;

  let created = 0;
  for (const s of SAMPLES) {
    const property = await prisma.property.findFirst({
      where: { slug: s.propertySlug },
    });
    if (!property) {
      console.warn(`Skip - property not found: ${s.propertySlug}`);
      continue;
    }

    const nights = Math.round(
      (s.checkOut.getTime() - s.checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const pets = s.pets ?? 0;
    const petFee = pets > 0 ? property.petFee : 0;
    const m = money(
      property.baseNightlyRate,
      nights,
      property.cleaningFee,
      petFee,
      property.depositPercent,
    );

    const paidAmount = s.payFullStay ? m.totalAmount : m.depositAmount;

    const booking = await prisma.booking.create({
      data: {
        propertyId: property.id,
        userId:
          s.userEmail === "guest@example.com" ? guestUserId : undefined,
        guestName: s.guestName,
        guestEmail: s.guestEmail,
        guestPhone: s.guestPhone ?? null,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        guests: s.guests,
        pets,
        nights,
        nightlySubtotal: m.nightlySubtotal,
        cleaningFee: m.cleaningFee,
        petFee: m.petFee,
        taxAmount: 0,
        totalAmount: m.totalAmount,
        depositAmount: m.depositAmount,
        status: s.status,
        sourceChannel: s.sourceChannel,
        guestNotes: s.guestNotes ?? null,
        adminNotes: SAMPLE_NOTE,
        payments: {
          create: {
            amount: paidAmount,
            method: s.payment.method,
            status: s.payment.status,
            paidAt: s.payment.paidAt ?? null,
            notes: s.payment.notes ?? null,
          },
        },
      },
    });

    // Calendar hold for open stays (not cancelled / completed history)
    if (s.status === "CONFIRMED" || s.status === "PENDING_PAYMENT") {
      await prisma.calendarBlock.create({
        data: {
          propertyId: property.id,
          bookingId: booking.id,
          source: "BOOKING",
          startDate: s.checkIn,
          endDate: s.checkOut,
          occupantName: s.guestName,
          notes: `Booking ${booking.id} (${s.status})`,
        },
      });
    }

    created++;
    console.log(
      `  · ${s.status.padEnd(16)} ${s.guestName} → ${property.title} (${nights}n, $${m.totalAmount})`,
    );
  }

  console.log(`\nCreated ${created} sample booking(s).`);
  console.log("View: /admin/bookings  ·  Earnings also uses paid deposits.");
}

const isDirectRun = process.argv[1]?.includes("seed-sample-bookings");
if (isDirectRun) {
  seedSampleBookings()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
