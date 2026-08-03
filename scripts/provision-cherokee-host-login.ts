/**
 * Make Cherokee Landing a standalone host brand with its own HOST login.
 * Platform ADMIN (e.g. hughroberts@me.com) stays unscoped and uses Ops backdoors.
 *
 *   DATABASE_URL=... npx tsx scripts/provision-cherokee-host-login.ts
 *
 * Optional:
 *   CHEROKEE_HOST_EMAIL=cherokeelanding@icloud.com
 *   CHEROKEE_HOST_PASSWORD='...'   # min 8 chars; random if omitted
 */
import { randomBytes } from "crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (
    process.env.CHEROKEE_HOST_EMAIL || "cherokeelanding@icloud.com"
  )
    .trim()
    .toLowerCase();
  const passwordPlain =
    process.env.CHEROKEE_HOST_PASSWORD?.trim() ||
    `CL-${randomBytes(4).toString("hex")}-2026!`;

  if (passwordPlain.length < 8) {
    throw new Error("CHEROKEE_HOST_PASSWORD must be at least 8 characters");
  }

  const host = await prisma.host.findUnique({
    where: { slug: "cherokee-landing" },
  });
  if (!host) throw new Error("cherokee-landing host missing — run provision-cherokee-paid first");

  await prisma.host.update({
    where: { id: host.id },
    data: {
      name: "Cherokee Landing",
      contactEmail: email,
      billingEmail: email,
      // Standalone business brand — not Hugh personal
      active: true,
      approvalStatus: "APPROVED",
      hostingMode: "PLATFORM",
      subscriptionStatus: "ACTIVE",
      sitePublishState: "DEMO",
      sitePresence: "BOTH",
      customDomain: host.customDomain || "cherokeelanding.net",
      websiteUrl: host.websiteUrl || "https://cherokeelanding.net",
    },
  });

  const passwordHash = await hash(passwordPlain, 10);

  // Primary host login
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Cherokee Landing",
      passwordHash,
      role: "HOST",
      hostId: host.id,
    },
    update: {
      name: "Cherokee Landing",
      passwordHash,
      role: "HOST",
      hostId: host.id,
    },
  });

  // Retire old dogfood email if different (keep account but point at Cherokee or delete host link)
  const legacy = await prisma.user.findUnique({
    where: { email: "host@cherokeelanding.net" },
  });
  if (legacy && legacy.id !== user.id) {
    // Keep legacy as secondary host user OR disable — keep as HOST on Cherokee for recovery
    await prisma.user.update({
      where: { id: legacy.id },
      data: {
        role: "HOST",
        hostId: host.id,
        name: "Cherokee Landing (legacy)",
      },
    });
  }

  // Ensure platform admin is not accidentally scoped to Cherokee
  await prisma.user.updateMany({
    where: { role: "ADMIN" },
    data: { hostId: null },
  });

  // Personal brand: no Cherokee host users on hugh-roberts
  const personal = await prisma.host.findUnique({
    where: { slug: "hugh-roberts" },
  });
  if (personal) {
    await prisma.host.update({
      where: { id: personal.id },
      data: {
        contactEmail: "hughroberts@me.com",
        billingEmail: "hughroberts@me.com",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: {
          id: host.id,
          slug: "cherokee-landing",
          name: "Cherokee Landing",
          contactEmail: email,
        },
        login: {
          email,
          password: passwordPlain,
          role: "HOST",
          note: "Sign in at /login — host admin only sees Cherokee listings/brand.",
        },
        platformAdmin: {
          access:
            "Stay logged in as ADMIN. Use Ops → Website hosting → Cherokee Landing for backdoor tools (brand, properties, guest site, pricing).",
        },
        guestDemo:
          "https://yallcomeback-production.up.railway.app/h/cherokee-landing",
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
