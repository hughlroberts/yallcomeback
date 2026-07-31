/**
 * Keep personal lakefront under Hugh Roberts; Cherokee Landing is business only.
 * Safe to re-run.
 *
 *   DATABASE_URL=... npx tsx scripts/separate-personal-from-cherokee.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cherokee = await prisma.host.findUnique({
    where: { slug: "cherokee-landing" },
  });
  const personal = await prisma.host.findUnique({
    where: { slug: "hugh-roberts" },
  });

  if (!cherokee) throw new Error("cherokee-landing host missing");
  if (!personal) throw new Error("hugh-roberts host missing");

  // Personal brand: marketplace-facing independent host
  await prisma.host.update({
    where: { id: personal.id },
    data: {
      name: "Hugh Roberts",
      tagline: "Private lake stays on Cedar Creek",
      description:
        "Independent host on Cedar Creek Lake. Direct booking — not part of Cherokee Landing resort inventory.",
      sitePresence: "STAYLOCAL",
      hostingMode: "PLATFORM",
      listOnMarketplace: true,
      active: true,
      approvalStatus: "APPROVED",
      subscriptionStatus: "ACTIVE",
      contactEmail: "hughroberts@me.com",
      billingEmail: "hughroberts@me.com",
    },
  });

  // Business brand: Cherokee only (no personal dock home)
  await prisma.host.update({
    where: { id: cherokee.id },
    data: {
      name: "Cherokee Landing",
      tagline: "Family lakeside stays on Cedar Creek Lake",
      sitePresence: "BOTH",
      hostingMode: "PLATFORM",
      listOnMarketplace: true,
      active: true,
      approvalStatus: "APPROVED",
      subscriptionStatus: "ACTIVE",
    },
  });

  // Move any lakefront slug still on Cherokee → personal
  const misplaced = await prisma.property.findMany({
    where: {
      hostId: cherokee.id,
      OR: [
        { slug: { contains: "lakefront" } },
        { title: { contains: "Private Dock" } },
        { title: { contains: "Deep & Sandy" } },
        { title: { contains: "Deep and Sandy" } },
      ],
    },
  });

  for (const prop of misplaced) {
    // Avoid slug clash under personal host
    const clash = await prisma.property.findFirst({
      where: { hostId: personal.id, slug: prop.slug, NOT: { id: prop.id } },
    });
    const slug = clash ? `${prop.slug}-personal` : prop.slug;
    await prisma.property.update({
      where: { id: prop.id },
      data: {
        hostId: personal.id,
        slug,
        listOnMarketplace: true,
        published: true,
      },
    });
    console.log("moved", prop.slug, "→ hugh-roberts as", slug);
  }

  // Prefer the imported Airbnb draft as the live personal listing
  const personalLakefronts = await prisma.property.findMany({
    where: {
      hostId: personal.id,
      OR: [
        { slug: { contains: "lakefront" } },
        { title: { contains: "Private Dock" } },
      ],
    },
    include: { images: true },
    orderBy: { createdAt: "desc" },
  });

  // Keep the one with most images / longest title as published; archive seed stub
  if (personalLakefronts.length > 1) {
    const ranked = [...personalLakefronts].sort((a, b) => {
      const score = (p: (typeof personalLakefronts)[0]) =>
        p.images.length * 10 +
        (p.description?.length ?? 0) +
        (p.published ? 5 : 0);
      return score(b) - score(a);
    });
    const keep = ranked[0]!;
    for (const p of ranked.slice(1)) {
      await prisma.property.update({
        where: { id: p.id },
        data: {
          published: false,
          listOnMarketplace: false,
          slug: p.slug.endsWith("-archive") ? p.slug : `${p.slug}-archive`,
        },
      });
      console.log("archived duplicate", p.slug, "kept", keep.slug);
    }
    await prisma.property.update({
      where: { id: keep.id },
      data: {
        published: true,
        listOnMarketplace: true,
        hostId: personal.id,
      },
    });
  } else if (personalLakefronts[0]) {
    await prisma.property.update({
      where: { id: personalLakefronts[0].id },
      data: { published: true, listOnMarketplace: true, hostId: personal.id },
    });
  }

  // Ensure Cherokee business listings stay on Cherokee and stay live
  await prisma.property.updateMany({
    where: {
      hostId: cherokee.id,
      slug: { in: ["eagles-nest-suite", "back-eagles-cabin"] },
    },
    data: { published: true, listOnMarketplace: true },
  });

  const summary = await prisma.property.findMany({
    select: {
      title: true,
      slug: true,
      published: true,
      listOnMarketplace: true,
      host: { select: { slug: true } },
    },
    orderBy: { title: "asc" },
  });

  console.log(JSON.stringify({ ok: true, properties: summary }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
