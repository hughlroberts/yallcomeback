/**
 * Upsert a platform ADMIN user (multiple managers supported — each is role ADMIN).
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='You' \
 *     npx tsx scripts/ensure-platform-admin.ts
 *
 * Production (Railway):
 *   railway run --service yallcomeback npx tsx scripts/ensure-platform-admin.ts
 *   # or with DATABASE_URL exported from Postgres public URL
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Platform Admin").trim();

  if (!email || !email.includes("@")) {
    throw new Error("Set ADMIN_EMAIL to a valid email");
  }
  if (password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD to at least 8 characters");
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
      // Platform managers are not tied to a single host brand
      hostId: null,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        message:
          "Platform ADMIN ready. Sign in at /login and change password under Account → Login & security.",
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
