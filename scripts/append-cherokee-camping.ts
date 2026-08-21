/**
 * Append a Camping section (divider + heading + tent/RV cards) after boat fleet
 * on Cherokee Landing's services page. Keeps existing boat blocks intact.
 *
 *   DATABASE_URL=... npx tsx scripts/append-cherokee-camping.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  newBlockId,
  parseServicesBlocks,
  serializeServicesBlocks,
  type ServicesBlock,
} from "../src/lib/services-blocks";

const prisma = new PrismaClient();

function campingSection(): ServicesBlock[] {
  return [
    {
      id: newBlockId(),
      type: "divider",
      content: "Also on the resort",
    },
    {
      id: newBlockId(),
      type: "heading",
      content: "Camping",
    },
    {
      id: newBlockId(),
      type: "text",
      content:
        "Pitch a tent or pull in your RV on Cedar Creek Lake. Sites are limited — call the office at 903-489-1179 to reserve. Children under 12 are free with a paying adult (max 4 people per site). Prices are subject to change.",
    },
    {
      id: newBlockId(),
      type: "card",
      content: "Tent camping",
      secondary:
        "Grass / tent sites for up to 2 people. Additional guests $5 each per night. Holidays (Memorial Day, July 4th, Labor Day) require a 3-night minimum.",
      price: "$20 / night (up to 2 people) · $5 each additional guest",
      imageUrl: "/brand/hosts/cherokee-camping/tent.jpg",
    },
    {
      id: newBlockId(),
      type: "card",
      content: "RV site — 30 amp",
      secondary:
        "30-amp RV hookup. Rate includes up to 2 people; $5 each additional guest. Park only campers on the lakeside grass — after unhooking, park vehicles across the street. One car + one boat parking per site. No dump station; no gray-water discharge. No carpets on the grass.",
      price: "$30 / night (up to 2 people) · $5 each additional guest",
      imageUrl: "/brand/hosts/cherokee-camping/tent-lake.jpg",
    },
    {
      id: newBlockId(),
      type: "card",
      content: "RV site — 50 amp",
      secondary:
        "50-amp RV hookup for larger rigs. Same guest rules as 30-amp sites. Limited parking — please ask the office if you need an extra vehicle spot.",
      price: "$35 / night (up to 2 people) · $5 each additional guest",
      imageUrl: "/brand/hosts/cherokee-camping/camp-area.jpg",
    },
    {
      id: newBlockId(),
      type: "list",
      content: [
        "Ice $2.50 / bag",
        "Daily use fee $5 / day",
        "Pets $5 / night per pet",
        "Cancel 14 days ahead or the full stay may be charged",
        "Holiday stays: full payment 30 days ahead + 14-day cancel notice",
      ].join("\n"),
    },
  ];
}

function alreadyHasCamping(blocks: ServicesBlock[]): boolean {
  return blocks.some(
    (b) =>
      (b.type === "heading" && /camping/i.test(b.content)) ||
      (b.type === "card" && /tent camping|rv site/i.test(b.content)),
  );
}

async function main() {
  const host = await prisma.host.findFirst({
    where: {
      OR: [{ slug: "cherokee-landing" }, { name: { contains: "Cherokee" } }],
    },
  });
  if (!host) throw new Error("Cherokee host not found");

  let blocks = parseServicesBlocks(host.siteServicesBlocks);
  if (alreadyHasCamping(blocks)) {
    // Replace prior camping section: drop from first camping divider/heading onward if present
    const cut = blocks.findIndex(
      (b) =>
        (b.type === "divider" && /also on the resort/i.test(b.content || "")) ||
        (b.type === "heading" && /^camping$/i.test(b.content.trim())),
    );
    if (cut >= 0) blocks = blocks.slice(0, cut);
  }

  // Insert camping before trailing "Rules" / contact button if those follow boats
  const rulesIdx = blocks.findIndex(
    (b) => b.type === "heading" && /rules/i.test(b.content),
  );
  const camping = campingSection();
  if (rulesIdx >= 0) {
    blocks = [
      ...blocks.slice(0, rulesIdx),
      ...camping,
      ...blocks.slice(rulesIdx),
    ];
  } else {
    blocks = [...blocks, ...camping];
  }

  await prisma.host.update({
    where: { id: host.id },
    data: {
      sitePageServices: true,
      siteServicesTitle: "Boat rentals & camping",
      siteServicesPath: host.siteServicesPath || "boat-rentals",
      siteServicesBlocks: serializeServicesBlocks(blocks),
    },
  });

  console.log(
    JSON.stringify(
      {
        hostId: host.id,
        title: "Boat rentals & camping",
        blocks: blocks.length,
        campingCards: blocks.filter(
          (b) => b.type === "card" && /tent|rv/i.test(b.content),
        ).map((b) => ({ title: b.content, price: b.price })),
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
