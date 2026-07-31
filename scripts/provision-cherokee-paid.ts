/**
 * Provision Cherokee Landing as a paid platform hosting customer on this DB.
 * Safe to re-run (upserts). Does not delete other hosts/users.
 *
 *   DATABASE_URL=... npx tsx scripts/provision-cherokee-paid.ts
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.hostingPlan.upsert({
    where: { slug: "listing" },
    create: {
      name: "Listing hosting",
      slug: "listing",
      description:
        "Flat $40 per published listing / month for website hosting on Yall Come Back. Not a booking commission.",
      monthlyPrice: 40,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: true,
      sortOrder: 1,
    },
    update: {
      monthlyPrice: 40,
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.hostingPlan.upsert({
    where: { slug: "complimentary" },
    create: {
      name: "Complimentary",
      slug: "complimentary",
      description: "Free hosting for own brand or partners.",
      monthlyPrice: 0,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 2,
    },
    update: {},
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const host = await prisma.host.upsert({
    where: { slug: "cherokee-landing" },
    create: {
      name: "Cherokee Landing",
      slug: "cherokee-landing",
      tagline: "Family lakeside stays on Cedar Creek Lake",
      description:
        "Cherokee Landing is a family-owned resort on Cedar Creek Lake in East Texas. Direct booking on your brand — powered by Yall Come Back.",
      contactEmail: "hughroberts@me.com",
      billingEmail: "hughroberts@me.com",
      websiteUrl: "https://cherokeelanding.net",
      sitePresence: "BOTH",
      logoUrl: "/seed/host/hugh.jpg",
      primaryColor: "#3A4A86",
      listOnMarketplace: true,
      active: true,
      hostingMode: "PLATFORM",
      approvalStatus: "APPROVED",
      subscriptionStatus: "ACTIVE",
      planId: plan.id,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      reviewedAt: now,
      defaultDisclaimer: `By booking at Cherokee Landing you acknowledge:

• Lake, dock, boat ramp, and outdoor areas involve inherent risks. Use at your own risk; supervise children at all times.
• You are responsible for damage beyond normal wear, lost keys, and excessive cleaning.
• Quiet hours after 10pm. No parties or large gatherings without prior written approval.
• Exterior security cameras may be present on common property.

Questions? Message us from your listing or booking.`,
    },
    update: {
      websiteUrl: "https://cherokeelanding.net",
      sitePresence: "BOTH",
      hostingMode: "PLATFORM",
      approvalStatus: "APPROVED",
      subscriptionStatus: "ACTIVE",
      planId: plan.id,
      active: true,
      listOnMarketplace: true,
      billingEmail: "hughroberts@me.com",
      contactEmail: "hughroberts@me.com",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      reviewedAt: now,
    },
  });

  // Host-scoped user for dogfooding host admin (platform admin still works for everything)
  const hostPassword = await hash("ChangeMe-Cherokee2026!", 10);
  await prisma.user.upsert({
    where: { email: "host@cherokeelanding.net" },
    create: {
      email: "host@cherokeelanding.net",
      name: "Cherokee Landing Host",
      passwordHash: hostPassword,
      role: "HOST",
      hostId: host.id,
    },
    update: {
      role: "HOST",
      hostId: host.id,
      passwordHash: hostPassword,
    },
  });

  // Ensure platform admin exists (no password change here)
  const admin = await prisma.user.findUnique({
    where: { email: "hughroberts@me.com" },
  });
  if (admin && !admin.hostId) {
    // Keep ADMIN as platform-wide; hostId null is correct for multi-host ops
  }

  async function ensureProperty(data: {
    slug: string;
    title: string;
    tagline: string;
    description: string;
    city: string;
    baseNightlyRate: number;
    bedrooms: number;
    bathrooms: number;
    beds: number;
    maxGuests: number;
    featured?: boolean;
    images: string[];
  }) {
    const existing = await prisma.property.findFirst({
      where: { hostId: host.id, slug: data.slug },
    });
    if (existing) {
      await prisma.property.update({
        where: { id: existing.id },
        data: {
          published: true,
          listOnMarketplace: true,
          title: data.title,
          tagline: data.tagline,
        },
      });
      return existing;
    }

    return prisma.property.create({
      data: {
        hostId: host.id,
        title: data.title,
        slug: data.slug,
        tagline: data.tagline,
        description: data.description,
        address: "Cherokee Landing Resort",
        city: data.city,
        region: "Texas",
        postalCode: "75148",
        country: "United States",
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        beds: data.beds,
        maxGuests: data.maxGuests,
        baseNightlyRate: data.baseNightlyRate,
        defaultMinNights: 2,
        cleaningFee: 100,
        petFee: 25,
        petFeeUnit: "PER_STAY",
        petsAllowed: true,
        maxPets: 2,
        depositPercent: 30,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        published: true,
        featured: data.featured ?? false,
        listOnMarketplace: true,
        images: {
          create: data.images.map((url, i) => ({
            url,
            alt: data.title,
            sortOrder: i,
            isCover: i === 0,
          })),
        },
      },
    });
  }

  // Business inventory only. Personal dock home lives under host slug
  // `hugh-roberts` (not Cherokee Landing).
  const props = await Promise.all([
    ensureProperty({
      slug: "eagles-nest-suite",
      title: "Upper Eagles Nest @ Cedar Creek",
      tagline: "Peaceful upstairs suite with lake views and deck access",
      description:
        "Comfortable suite at Cherokee Landing with lake access and resort amenities nearby.",
      city: "Malakoff",
      baseNightlyRate: 165,
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      maxGuests: 4,
      featured: true,
      images: [
        "/seed/eagles-nest/01.jpg",
        "/seed/eagles-nest/02.jpg",
      ],
    }),
    ensureProperty({
      slug: "back-eagles-cabin",
      title: "Back Eagles Nest Lake House",
      tagline: "Lakeside cabin with covered patio and open living",
      description:
        "Family cabin at Cherokee Landing — porch time, lake days, and easy resort access.",
      city: "Malakoff",
      baseNightlyRate: 195,
      bedrooms: 2,
      bathrooms: 1,
      beds: 3,
      maxGuests: 6,
      images: [
        "/seed/back-eagles/01.jpg",
        "/seed/back-eagles/02.jpg",
      ],
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: {
          id: host.id,
          slug: host.slug,
          plan: plan.slug,
          monthlyPrice: plan.monthlyPrice,
          websiteUrl: host.websiteUrl,
          hostingMode: "PLATFORM",
          subscriptionStatus: "ACTIVE",
        },
        properties: props.map((p) => p.slug),
        hostLogin: {
          email: "host@cherokeelanding.net",
          tempPassword: "ChangeMe-Cherokee2026!",
        },
        next: [
          "Set Railway env HOST_DOMAIN_MAP=cherokeelanding.net:cherokee-landing,www.cherokeelanding.net:cherokee-landing",
          "Railway → Custom Domain → add cherokeelanding.net + www",
          "Doteasy DNS → CNAME/ALIAS as Railway shows",
          "Platform admin: hughroberts@me.com still manages everything",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
