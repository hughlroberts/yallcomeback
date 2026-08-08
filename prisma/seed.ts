import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function imgs(
  propertyId: string,
  paths: { path: string; alt: string }[]
) {
  return paths.map((p, i) => ({
    propertyId,
    url: p.path,
    alt: p.alt,
    sortOrder: i,
    isCover: i === 0,
  }));
}

async function main() {
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.calendarBlock.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.icalConnection.deleteMany();
  await prisma.seasonalPrice.deleteMany();
  await prisma.propertyImage.deleteMany();
  await prisma.thingToDo.deleteMany();
  await prisma.property.deleteMany();
  await prisma.location.deleteMany();
  await prisma.hostingInvoice.deleteMany();
  await prisma.user.deleteMany();
  await prisma.host.deleteMany();
  await prisma.hostingPlan.deleteMany();

  const passwordHash = await hash("admin12345", 10);
  const hostPassword = await hash("host12345", 10);

  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {
      siteName: "Yall Come Back",
      marketplaceName: "Yall Come Back Marketplace",
      marketplaceEnabled: true,
    },
    create: {
      id: "default",
      siteName: "Yall Come Back",
      marketplaceName: "Yall Come Back Marketplace",
      marketplaceEnabled: true,
      currency: "USD",
      currencySymbol: "$",
      defaultDepositPercent: 30,
      contactEmail: "hello@yallcomeback.com",
    },
  });

  await prisma.hostingPlan.create({
    data: {
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
  });

  /** Owner / partner brands you host at no charge (still a customer on the platform). */
  const planComplimentary = await prisma.hostingPlan.create({
    data: {
      name: "Complimentary",
      slug: "complimentary",
      description:
        "Free hosting for your own brand or partner accounts. Still a full platform customer — no monthly fee.",
      monthlyPrice: 0,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 2,
    },
  });

  await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Platform Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

 // --- Primary real brand: Cherokee Landing (demo free self-host migration)
  const cherokee = await prisma.host.create({
    data: {
      name: "Cherokee Landing",
      slug: "cherokee-landing",
      tagline: "Family lakeside stays on Cedar Creek Lake",
      description:
        "Cherokee Landing is a family-owned resort on Cedar Creek Lake in East Texas. Hugh & Charlotte Roberts have lived in the area for 25 years - welcoming families for swimming, fishing, pontoon days, and quiet sunsets over the water. Book direct on our Yall Come Back host site or find us on the free marketplace.",
      contactEmail: "host@example.com",
      billingEmail: "host@example.com",
      websiteUrl: null,
      sitePresence: "STAYLOCAL",
      logoUrl: "/seed/host/hugh.jpg",
      primaryColor: "#0e7490",
      defaultDisclaimer: `By booking at Cherokee Landing you acknowledge:

• Lake, dock, boat ramp, and outdoor areas involve inherent risks. Use at your own risk; supervise children at all times.
• You are responsible for damage beyond normal wear, lost keys, and excessive cleaning.
• Quiet hours after 10pm. No parties or large gatherings without prior written approval.
• Exterior security cameras may be present on common property.
• Boat rentals and amenities are subject to availability and separate terms.

Questions? Message us in-app from your listing or booking.`,
      listOnMarketplace: true,
      active: true,
      // Demo of free self-host: own domain + always on free marketplace
      hostingMode: "SELF",
      approvalStatus: "APPROVED",
      subscriptionStatus: "NONE",
      planId: null,
      reviewedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      email: "host@example.com",
      name: "Hugh Roberts",
      passwordHash: hostPassword,
      role: "HOST",
      hostId: cherokee.id,
    },
  });

  const pendingHost = await prisma.host.create({
    data: {
      name: "Mountain Quiet Cabins",
      slug: "mountain-quiet",
      tagline: "Awaiting platform approval",
      description: "Demo host in pending review.",
      contactEmail: "pending@example.com",
      billingEmail: "pending@example.com",
      listOnMarketplace: true,
      active: true,
      hostingMode: "PLATFORM",
      approvalStatus: "PENDING_REVIEW",
      subscriptionStatus: "NONE",
      planId: planComplimentary.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "pending@example.com",
      name: "Pat Pending",
      passwordHash: hostPassword,
      role: "HOST",
      hostId: pendingHost.id,
    },
  });

  const cedarCreek = await prisma.location.create({
    data: {
      hostId: cherokee.id,
      name: "Cedar Creek Lake",
      slug: "cedar-creek-lake",
      region: "Texas",
      country: "United States",
      description:
        "East Texas lake country - sandy bottoms, open water, fishing, and quiet evenings. Cherokee Landing sits right on the shoreline with dock access, swimming, and boat rentals nearby.",
      heroImage: "/seed/lakefront/01.jpg",
      published: true,
      thingsToDo: {
        create: [
          {
            title: "Swim off the sandy bottom",
            slug: "sandy-bottom-swim",
            category: "Outdoors",
            description:
              "Rare for the area - a sandy bottom off the dock makes lake swimming easy for families.",
            imageUrl: "/seed/lakefront/02.jpg",
            sortOrder: 0,
          },
          {
            title: "Pontoon boat rental",
            slug: "pontoon-rental",
            category: "On the water",
            description:
              "Cherokee Landing rents pontoons for fishing, cruising, and tubing. Book ahead - 2-night stays often include a boat discount.",
            imageUrl: "/seed/lakefront/05.jpg",
            sortOrder: 1,
          },
          {
            title: "Kayak & paddleboard",
            slug: "kayak-paddle",
            category: "Outdoors",
            description:
              "Explore quiet coves along Cedar Creek. Kayaks available with many of our stays.",
            imageUrl: "/seed/eagles-nest/05.jpg",
            sortOrder: 2,
          },
          {
            title: "Sunset on the dock",
            slug: "dock-sunset",
            category: "Relax",
            description:
              "Covered porches and private docks are made for coffee at sunrise and golden hour over the water.",
            imageUrl: "/seed/lakefront/04.jpg",
            sortOrder: 3,
          },
          {
            title: "Game room rainy days",
            slug: "game-room",
            category: "Family",
            description:
              "Ping pong, air hockey, arcade, and cornhole keep the whole group entertained when the weather turns.",
            imageUrl: "/seed/lakefront/03.jpg",
            sortOrder: 4,
          },
        ],
      },
    },
  });

 // --- Lakefront home (Airbnb 600541790815158094)
  const lakefront = await prisma.property.create({
    data: {
      hostId: cherokee.id,
      locationId: cedarCreek.id,
      title: "Lakefront with Private Dock",
      slug: "lakefront-private-dock",
      tagline: "Deep water, sandy bottom, and a private dock on Cedar Creek",
      description: `Enjoy a private home right on Cedar Creek Lake with your family. Located within Cherokee Landing Resort.

Not many rentals in the area have a sandy bottom off their dock - or this open lake view. The home is spacious with private parking and a game room for ping pong, air hockey, and rainy-day fun.

Don't have a boat? Next door, Cherokee Landing rents pontoon boats for fishing, cruising, and tubing.

The space
Three unique spaces for guests: the entire house with a huge living room of windows; a covered front deck for morning coffee; a private dock for swimming, fishing, kayaking, or parking your boat; and a game room in the garage. Light a fire or BBQ by the lake.

Guest access
Entire house, dock, garage, and front lawn - all private.

Highlights from guests
• Rated 5.0 from 20 reviews (Guest Favorite)
• Peaceful setting, comfortable beds, and sunsets from the covered porch
• Superhost: Hugh - 7 years hosting, responds within an hour`,
      address: "Cherokee Landing Resort",
      city: "Log Cabin",
      region: "Texas",
      postalCode: "75148",
      country: "United States",
      bedrooms: 2,
      bathrooms: 2,
      beds: 5,
      maxGuests: 9,
      baseNightlyRate: 285,
      defaultMinNights: 2,
      cleaningFee: 150,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      petsAllowed: true,
      maxPets: 2,
      depositPercent: 30,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n9 guests maximum\nPets allowed with fee\nNo parties\nQuiet hours after 10pm\nRespect the dock and lake access for all Cherokee Landing guests",
      amenities: JSON.stringify([
        "Lake view",
        "Waterfront",
        "Private dock",
        "Sandy bottom swimming",
        "Kitchen",
        "Wifi",
        "Free parking",
        "Game room",
        "Ping pong",
        "Air hockey",
        "Fire pit",
        "BBQ",
        "Kayaks available",
        "TV",
        "Washer",
        "Air conditioning",
        "Pets allowed",
      ]),
      published: true,
      featured: true,
      listOnMarketplace: true,
      seasons: {
        create: [
          {
            name: "Summer peak",
            startDate: new Date("2026-06-01T00:00:00"),
            endDate: new Date("2026-08-31T00:00:00"),
            nightlyRate: 365,
            minNights: 3,
          },
          {
            name: "Holiday weekends",
            startDate: new Date("2026-11-25T00:00:00"),
            endDate: new Date("2026-11-30T00:00:00"),
            nightlyRate: 395,
            minNights: 3,
          },
        ],
      },
      icalConnections: {
        create: { name: "Export feed", enabled: true },
      },
    },
  });

  await prisma.propertyImage.createMany({
    data: imgs(lakefront.id, [
      { path: "/seed/lakefront/01.jpg", alt: "Lakefront home exterior on Cedar Creek" },
      { path: "/seed/lakefront/02.jpg", alt: "Private dock and open water" },
      { path: "/seed/lakefront/03.jpg", alt: "Living space with lake views" },
      { path: "/seed/lakefront/04.jpg", alt: "Covered porch overlooking the lake" },
      { path: "/seed/lakefront/05.jpg", alt: "Outdoor and yard at Cherokee Landing" },
      { path: "/seed/lakefront/06.jpg", alt: "Primary bedroom" },
      { path: "/seed/lakefront/07.jpg", alt: "Second bedroom" },
      { path: "/seed/lakefront/08.jpg", alt: "Living room sleeping area" },
    ]),
  });

  // Demo availability blocks so public calendars show real unavailable nights
  const blockStart = new Date();
  blockStart.setDate(blockStart.getDate() + 10);
  blockStart.setHours(0, 0, 0, 0);
  const blockEnd = new Date(blockStart);
  blockEnd.setDate(blockEnd.getDate() + 4);
  const maintStart = new Date();
  maintStart.setDate(maintStart.getDate() + 28);
  maintStart.setHours(0, 0, 0, 0);
  const maintEnd = new Date(maintStart);
  maintEnd.setDate(maintEnd.getDate() + 2);

  await prisma.calendarBlock.createMany({
    data: [
      {
        propertyId: lakefront.id,
        startDate: blockStart,
        endDate: blockEnd,
        source: "MANUAL",
        blockType: "OFFLINE",
        occupantName: "Guest (offline booking)",
        notes: "Seed demo - private note not shown on public calendar",
      },
      {
        propertyId: lakefront.id,
        startDate: maintStart,
        endDate: maintEnd,
        source: "MANUAL",
        blockType: "MAINTENANCE",
        notes: "Dock cleaning",
      },
    ],
  });

 // --- Upper Eagles Nest (Airbnb 1495909859860012054)
  const eagles = await prisma.property.create({
    data: {
      hostId: cherokee.id,
      locationId: cedarCreek.id,
      title: "Upper Eagles Nest @ Cedar Creek",
      slug: "upper-eagles-nest",
      tagline: "Peaceful upstairs suite with lake views and deck access",
      description: `Relax with the whole family at this peaceful place right on Cedar Creek Lake. This is the upstairs unit - there's a downstairs and a few other rentals on the property if you have a larger group.

The Eagles Nest has central heat and air, access to a boat ramp, dock, and fish cleaning station. There's enough parking for your family and boat.

The space
Cherokee Landing is a family-owned resort on Cedar Creek Lake with multiple rooms and campsites available.

Guest access
Upstairs including the outside deck. The dock is for all guests, and there's an open swimming location with a nice sandy bottom.

Other things to note
If you rent for 2 nights, you get 10% off a boat rental when booked in advance.

Hosted by Hugh & Charlotte Roberts - active in the community and operating a local children's home alongside the resort.`,
      address: "Cherokee Landing Resort, Cedar Creek Lake",
      city: "Malakoff",
      region: "Texas",
      postalCode: "75148",
      country: "United States",
      bedrooms: 2,
      bathrooms: 1,
      beds: 3,
      maxGuests: 6,
      baseNightlyRate: 195,
      defaultMinNights: 2,
      cleaningFee: 95,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      maxPets: 2,
      petsAllowed: true,
      depositPercent: 30,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n6 guests maximum\nPets allowed with fee\nNo parties\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Lake view",
        "Beach access",
        "Kitchen",
        "Wifi",
        "Free parking",
        "Deck",
        "Boat ramp access",
        "Dock access",
        "Fish cleaning station",
        "Air conditioning",
        "Heating",
        "Pets allowed",
      ]),
      published: true,
      featured: true,
      listOnMarketplace: true,
      seasons: {
        create: [
          {
            name: "Summer peak",
            startDate: new Date("2026-06-01T00:00:00"),
            endDate: new Date("2026-08-31T00:00:00"),
            nightlyRate: 249,
            minNights: 2,
          },
        ],
      },
      icalConnections: {
        create: { name: "Export feed", enabled: true },
      },
    },
  });

  await prisma.propertyImage.createMany({
    data: imgs(eagles.id, [
      { path: "/seed/eagles-nest/01.jpg", alt: "Upper Eagles Nest exterior" },
      { path: "/seed/eagles-nest/02.jpg", alt: "Living area with lake light" },
      { path: "/seed/eagles-nest/03.jpg", alt: "Bedroom with king bed" },
      { path: "/seed/eagles-nest/04.jpg", alt: "Kitchen and dining" },
      { path: "/seed/eagles-nest/05.jpg", alt: "Deck and outdoor space" },
      { path: "/seed/eagles-nest/06.jpg", alt: "Second bedroom" },
    ]),
  });

  const eaglesBlockStart = new Date();
  eaglesBlockStart.setDate(eaglesBlockStart.getDate() + 16);
  eaglesBlockStart.setHours(0, 0, 0, 0);
  const eaglesBlockEnd = new Date(eaglesBlockStart);
  eaglesBlockEnd.setDate(eaglesBlockEnd.getDate() + 3);

  await prisma.calendarBlock.create({
    data: {
      propertyId: eagles.id,
      startDate: eaglesBlockStart,
      endDate: eaglesBlockEnd,
      source: "MANUAL",
      blockType: "OWNER",
      occupantName: "Owner weekend",
      notes: "Seed demo block",
    },
  });

 // --- Lower Eagles Nest (Airbnb 1498159256776624358)
  const lowerEagles = await prisma.property.create({
    data: {
      hostId: cherokee.id,
      locationId: cedarCreek.id,
      title: "Lower Eagles Nest @ Cedar Creek",
      slug: "lower-eagles-nest",
      tagline: "Lakeside cabin with covered patio, boat slip access, and open living",
      description: `Come to Cherokee Landing for the best value on the lake. On site we offer boat rentals, camping, boat launch, swimming area, large fishing pier, fish cleaning station, and plenty of spots to tie your boat.

Sit under the covered patio as you enjoy the views of the lake. You will appreciate the large open design of the kitchen and living room. It has two bedrooms, both with full beds. Approximately 700 sq ft with seating for four at the dining table.

The space
Right on Cedar Creek Reservoir with lake access, a boat slip, and a swimming area on site. Covered patio with fire pit, BBQ area, and seating.

Hosted by Hugh & Charlotte Roberts - family-owned resort on Cedar Creek Lake.`,
      address: "Cherokee Landing Resort, Cedar Creek Lake",
      city: "Malakoff",
      region: "Texas",
      postalCode: "75148",
      country: "United States",
      bedrooms: 2,
      bathrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 175,
      defaultMinNights: 2,
      cleaningFee: 85,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      maxPets: 2,
      petsAllowed: true,
      depositPercent: 30,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      houseRules:
        "Check-in after 3:00 PM\n4 guests maximum\nPets allowed with fee\nNo parties\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Beach access",
        "Lake access",
        "Kitchen",
        "Wifi",
        "Free parking",
        "Covered patio",
        "Fire pit",
        "BBQ",
        "Boat slip access",
        "Boat ramp",
        "Fishing pier",
        "Pets allowed",
        "Air conditioning",
      ]),
      published: true,
      featured: true,
      listOnMarketplace: true,
      seasons: {
        create: [
          {
            name: "Summer peak",
            startDate: new Date("2026-06-01T00:00:00"),
            endDate: new Date("2026-08-31T00:00:00"),
            nightlyRate: 225,
            minNights: 2,
          },
        ],
      },
      icalConnections: {
        create: { name: "Export feed", enabled: true },
      },
    },
  });

  await prisma.propertyImage.createMany({
    data: imgs(lowerEagles.id, [
      { path: "/seed/lower-eagles/01.jpg", alt: "Lower Eagles Nest exterior" },
      { path: "/seed/lower-eagles/02.jpg", alt: "Bedroom with queen bed" },
      { path: "/seed/lower-eagles/03.jpg", alt: "Second bedroom" },
      { path: "/seed/lower-eagles/04.jpg", alt: "Open kitchen and living" },
      { path: "/seed/lower-eagles/05.jpg", alt: "Covered patio by the lake" },
    ]),
  });

 // --- Back Eagles Nest (Airbnb 1498164599045817140)
  const backEagles = await prisma.property.create({
    data: {
      hostId: cherokee.id,
      locationId: cedarCreek.id,
      title: "Back Eagles Nest @ Cedar Creek",
      slug: "back-eagles-nest",
      tagline: "Kitchenette suite with private patio, grill, and fire pit",
      description: `Enjoy a small kitchenette-style apartment with a private patio and grill. Just a walk away from the water at Cherokee Landing.

One bedroom with a queen bed, plus a full bed in the living area - sleeps up to 4.

Highlights
• Near Cedar Creek Reservoir with lake access included
• Private patio with grill and fire pit
• Pet-friendly with free parking
• Convenient base for lakeside getaways

Hosted by Hugh & Charlotte Roberts.`,
      address: "Cherokee Landing Resort, Cedar Creek Lake",
      city: "Malakoff",
      region: "Texas",
      postalCode: "75148",
      country: "United States",
      bedrooms: 1,
      bathrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 145,
      defaultMinNights: 2,
      cleaningFee: 75,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      maxPets: 2,
      petsAllowed: true,
      depositPercent: 30,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      houseRules:
        "Check-in after 3:00 PM\n4 guests maximum\nPets allowed with fee\nNo parties\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Lake access",
        "Kitchenette",
        "Wifi",
        "Free parking",
        "Private patio",
        "Grill",
        "Fire pit",
        "Pets allowed",
        "Air conditioning",
      ]),
      published: true,
      featured: false,
      listOnMarketplace: true,
      seasons: {
        create: [
          {
            name: "Summer peak",
            startDate: new Date("2026-06-01T00:00:00"),
            endDate: new Date("2026-08-31T00:00:00"),
            nightlyRate: 185,
            minNights: 2,
          },
        ],
      },
      icalConnections: {
        create: { name: "Export feed", enabled: true },
      },
    },
  });

  await prisma.propertyImage.createMany({
    data: imgs(backEagles.id, [
      { path: "/seed/back-eagles/01.jpg", alt: "Back Eagles Nest living area" },
      { path: "/seed/back-eagles/02.jpg", alt: "Bedroom with queen bed" },
      { path: "/seed/back-eagles/03.jpg", alt: "Kitchenette and dining" },
      { path: "/seed/back-eagles/04.jpg", alt: "Private patio seating" },
      { path: "/seed/back-eagles/05.jpg", alt: "Outdoor space with grill" },
    ]),
  });

 // --- Motel rooms (resort lodging) - 4 units
  // 2 with kitchenette, 2 standard with 2 beds
  const motelBase = {
    hostId: cherokee.id,
    locationId: cedarCreek.id,
    address: "Cherokee Landing Resort",
    city: "Malakoff",
    region: "Texas",
    postalCode: "75148",
    country: "United States",
    bathrooms: 1,
    depositPercent: 30,
    checkInTime: "15:00",
    checkOutTime: "11:00",
    defaultMinNights: 1,
    published: true,
    featured: false,
    listOnMarketplace: true,
  } as const;

  const motelKitchenetteA = await prisma.property.create({
    data: {
      ...motelBase,
      title: "Motel Room · Kitchenette A",
      slug: "motel-kitchenette-a",
      tagline: "Resort motel with kitchenette - walk to the lake & pier",
      description: `Cherokee Landing motel lodging with a kitchenette for simple meals. Ideal for couples or small families who want resort amenities without a full house rental.

On-site: boat ramp, swimming area, fishing pier, fish cleaning station, boat rentals, and camping. See the host site for full resort details.

This unit has a kitchenette (sink, mini-fridge, microwave/cooktop as equipped), private bath, and parking at the door.`,
      bedrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 119,
      cleaningFee: 45,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      petsAllowed: true,
      maxPets: 2,
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n4 guests maximum\nKitchenette - no deep frying\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Kitchenette",
        "Wifi",
        "Free parking",
        "Air conditioning",
        "TV",
        "Lake access",
        "Boat ramp access",
        "Pets allowed",
      ]),
      icalConnections: { create: { name: "Export feed", enabled: true } },
    },
  });

  const motelKitchenetteB = await prisma.property.create({
    data: {
      ...motelBase,
      title: "Motel Room · Kitchenette B",
      slug: "motel-kitchenette-b",
      tagline: "Second kitchenette motel room at Cherokee Landing",
      description: `Same layout family as Kitchenette A - motel lodging with kitchenette on the Cherokee Landing resort grounds. Great when traveling with another couple or for longer stays that need a place to heat meals.

Resort amenities include swimming area, fishing pier, boat launch, and pontoon rentals next door.`,
      bedrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 119,
      cleaningFee: 45,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      petsAllowed: true,
      maxPets: 2,
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n4 guests maximum\nKitchenette - no deep frying\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Kitchenette",
        "Wifi",
        "Free parking",
        "Air conditioning",
        "TV",
        "Lake access",
        "Boat ramp access",
        "Pets allowed",
      ]),
      icalConnections: { create: { name: "Export feed", enabled: true } },
    },
  });

  const motelStandardA = await prisma.property.create({
    data: {
      ...motelBase,
      title: "Motel Room · Two Beds A",
      slug: "motel-two-beds-a",
      tagline: "Simple motel room with two beds - no kitchenette",
      description: `Affordable motel-style room at Cherokee Landing with two beds. Perfect for overnight lake trips, fishing weekends, or when you plan to eat out / grill on the resort.

No kitchenette - bathroom, AC, wifi, and parking included. Full resort access: pier, swim area, boat ramp, and rentals.`,
      bedrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 99,
      cleaningFee: 35,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      petsAllowed: true,
      maxPets: 2,
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n4 guests maximum\nNo kitchenette\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Two beds",
        "Wifi",
        "Free parking",
        "Air conditioning",
        "TV",
        "Lake access",
        "Boat ramp access",
        "Pets allowed",
      ]),
      icalConnections: { create: { name: "Export feed", enabled: true } },
    },
  });

  const motelStandardB = await prisma.property.create({
    data: {
      ...motelBase,
      title: "Motel Room · Two Beds B",
      slug: "motel-two-beds-b",
      tagline: "Second two-bed motel room - clean and simple",
      description: `Matching two-bed motel room without kitchenette. Book alongside Two Beds A when you need two rooms for a larger group on a budget.

Cherokee Landing resort amenities steps away: swimming, fishing pier, boat launch, and pontoon rentals.`,
      bedrooms: 1,
      beds: 2,
      maxGuests: 4,
      baseNightlyRate: 99,
      cleaningFee: 35,
      petFee: 25,
      petFeeUnit: "PER_STAY",
      petsAllowed: true,
      maxPets: 2,
      houseRules:
        "Check-in after 3:00 PM\nCheckout before 11:00 AM\n4 guests maximum\nNo kitchenette\nQuiet hours after 10pm",
      amenities: JSON.stringify([
        "Two beds",
        "Wifi",
        "Free parking",
        "Air conditioning",
        "TV",
        "Lake access",
        "Boat ramp access",
        "Pets allowed",
      ]),
      icalConnections: { create: { name: "Export feed", enabled: true } },
    },
  });

  // Motel photos: reuse lake/resort imagery until dedicated motel shots are uploaded
  for (const [prop, folder, alts] of [
    [
      motelKitchenetteA,
      "eagles-nest",
      [
        "Motel kitchenette room exterior style",
        "Living / sleeping area",
        "Kitchenette style prep area",
        "Bedroom",
        "Outdoor resort access",
      ],
    ],
    [
      motelKitchenetteB,
      "back-eagles",
      [
        "Kitchenette motel room",
        "Bedroom",
        "Kitchenette counter",
        "Seating area",
        "Patio / outdoor",
      ],
    ],
    [
      motelStandardA,
      "lower-eagles",
      [
        "Two-bed motel room",
        "Bedroom beds",
        "Second sleeping space",
        "Bath / room detail",
        "Resort grounds nearby",
      ],
    ],
    [
      motelStandardB,
      "lakefront",
      [
        "Standard motel room",
        "Sleeping area",
        "Room interior",
        "Resort setting",
        "Lake access nearby",
      ],
    ],
  ] as const) {
    await prisma.propertyImage.createMany({
      data: imgs(prop.id, [
        { path: `/seed/${folder}/01.jpg`, alt: alts[0] },
        { path: `/seed/${folder}/02.jpg`, alt: alts[1] },
        { path: `/seed/${folder}/03.jpg`, alt: alts[2] },
        { path: `/seed/${folder}/04.jpg`, alt: alts[3] },
        { path: `/seed/${folder}/05.jpg`, alt: alts[4] },
      ]),
    });
  }

  const { seedSampleBookings } = await import("./seed-sample-bookings");
  await seedSampleBookings();

  const { seedSampleMessages } = await import("./seed-sample-messages");
  await seedSampleMessages(prisma);

  console.log("\nSeed complete with Cherokee Landing stays + motel rooms.\n");
  console.log("Platform admin: admin@example.com / admin12345");
  console.log("Cherokee Landing host: host@example.com / host12345");
  console.log("  Site: /h/cherokee-landing");
  console.log("  · Lakefront with Private Dock");
  console.log("  · Upper Eagles Nest");
  console.log("  · Lower Eagles Nest");
  console.log("  · Back Eagles Nest");
  console.log("  · Motel Kitchenette A/B");
  console.log("  · Motel Two Beds A/B");
  console.log("Pending: pending@example.com / host12345");
  console.log("Sample bookings: /admin/bookings");
  console.log("Sample messages: /admin/messages  (host@example.com)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
