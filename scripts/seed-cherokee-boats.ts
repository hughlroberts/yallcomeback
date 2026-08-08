/**
 * Load cherokeelanding.net/boat-rental content into the Services page blocks.
 * Run: DATABASE_URL=... npx tsx scripts/seed-cherokee-boats.ts
 *
 * Content sourced from http://cherokeelanding.net/boat-rental/ (public fleet page).
 * Layout: existing heading/text/card/list/button blocks — no format change.
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

function id() {
  return `b_${randomBytes(4).toString("hex")}`;
}

/** Fleet content — mirrors cherokeelanding.net/boat-rental/ */
function boatRentalsBlocks() {
  return [
    // Page title comes from siteServicesTitle — no extra heading block
    {
      id: id(),
      type: "text",
      content:
        "Be your own captain and see Cedar Creek Lake at your own pace. Whether fishing or a sunset cruise you, and your family, are sure to have a good time. Please call the office at 903-489-1179 with a credit card to make your reservation.",
    },
    {
      id: id(),
      type: "text",
      content:
        "All PRICES LISTED are for Saturdays. Please call for other pricing including Holidays, Friday, Sunday, weekday and long term. Add an additional 2 hours on Friday, Saturday, Sundays, and Holidays are $50. Add an additional 2 hours on weekdays are $25. PRICES ARE SUBJECT TO CHANGE.\n\nAnyone driving must be present with drivers license to sign paperwork.\n\nAnyone born after September 1993, must have an approved TPWD boaters education certificate.",
    },
    {
      id: id(),
      type: "card",
      content:
        "26.5 ft Lowe Tritoon with a 2012 Yamaha 115 HP 4 Stroke Motor (Our Largest Boat)",
      secondary:
        "Seating for up to 12 or 1600 lbs, equipped with a bimini top, depth finder and radio. This boat can pull a tube but it will limit the number of people on board.",
      price:
        "Sat $475 (4 hours) · Holidays from $525 · $1,000 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
      imageUrl: "/brand/hosts/cherokee-boats/lowe-tritoon.png",
    },
    {
      id: id(),
      type: "card",
      content: "24ft 2006 Voyager Pontoon with 2015 Yamaha 50 HP 4 Stroke Motor",
      secondary:
        "Seating for up to 9 or 1000 lbs, equipped with a bimini top, depth finder and radio. This boat cannot pull a tube.",
      price:
        "Sat $325 (4 hours) · Holidays from $400 · $700 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
      imageUrl: "/brand/hosts/cherokee-boats/voyager-pontoon.png",
    },
    {
      id: id(),
      type: "card",
      content: "26ft 2012 JC Tritoon with 2012 150 HP Honda Motor",
      secondary:
        "Seating for up to 12 or 1600 lbs, equipped with a bimini top, depth finder and radio. This boat can pull a tube.",
      price:
        "Sat $700 (4 hours) · Holidays from $800 · $1,200 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
    },
    {
      id: id(),
      type: "card",
      content: "26ft Leisure Kraft Pontoon with 2021 Yamaha 115HP 4 Stroke Motor",
      secondary:
        "Seating for up to 10 or 1200 lbs, equipped with a bimini top, depth finder and radio. This boat can pull a tube but it will limit the number of people on board.",
      price:
        "Sat $550 (4 hours) · Holidays from $650 · $1,200 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
    },
    {
      id: id(),
      type: "card",
      content: "24ft LeisureKraft Pontoon with 2018 Yamaha 90 HP 4 Stroke Motor",
      secondary:
        "Seating for up to 10 or 1100 lbs, equipped with a bimini top, fish finder and radio. This boat can pull a tube but it will limit the number of people on board.",
      price:
        "Sat $475 (4 hours) · Holidays from $525 · $800 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
      imageUrl: "/brand/hosts/cherokee-boats/leisurekraft-24.png",
    },
    {
      id: id(),
      type: "card",
      content:
        "23ft 2008 Crestliner Tritoon with 2020 Yamaha 150 HP 4 Stroke Motor",
      secondary:
        "Seating for up to 9 or 1300 lbs, equipped with a bimini top, fish finder and radio. This boat can pull a tube but it will limit the number of people on board.",
      price:
        "Sat $750 (4 hours) · Holidays from $800 · $1,500 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
    },
    {
      id: id(),
      type: "card",
      content: "25ft Lowe Jamaica Pontoon with 2020 Yamaha 90 HP 4 Stroke Motor",
      secondary:
        "Seating for up to 10 or 1100 lbs, equipped with a bimini top, fish finder and radio. This boat can pull a tube but it will limit the number of people on board.",
      price:
        "Sat $475 (4 hours) · Holidays from $525 · $900 (24 hours) · Extra 2 hrs Fri–Sun/Holiday $50 · Weekday extra 2 hrs $25",
      imageUrl: "/brand/hosts/cherokee-boats/lowe-jamaica.png",
    },
    {
      id: id(),
      type: "heading",
      content: "Rules and regulations",
    },
    {
      id: id(),
      type: "list",
      content: [
        "Gas not included",
        "Cleaning fee of up to $25 may apply",
        "Call for availability or longer-term rental pricing",
        "Credit card deposit required for any damages that might occur",
        "Holidays are priced slightly higher",
        "Cancellation: must cancel 7 days in advance or you will be charged the full price of the rental. You may re-book for another date if available",
        "We maintain the right to cancel because of any extreme weather (high winds, thunder or lightning)",
        "Tubes, skies, and wakeboards cannot be pulled behind the Voyager",
      ].join("\n"),
    },
    {
      id: id(),
      type: "button",
      content: "Message us to book",
      secondary: "/about#contact",
    },
  ];
}

async function main() {
  const prisma = new PrismaClient();
  const host = await prisma.host.findFirst({
    where: {
      OR: [{ slug: "cherokee-landing" }, { name: { contains: "Cherokee" } }],
    },
  });
  if (!host) {
    console.error("Cherokee host not found");
    process.exit(1);
  }

  const blocks = boatRentalsBlocks();
  const updated = await prisma.host.update({
    where: { id: host.id },
    data: {
      sitePageServices: true,
      siteServicesTitle: "Boat rentals & lake extras",
      siteServicesBlocks: JSON.stringify(blocks),
    },
    select: {
      id: true,
      slug: true,
      siteServicesTitle: true,
      sitePageServices: true,
    },
  });

  console.log("Updated host services:", updated);
  console.log("Blocks:", blocks.length);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
