/**
 * One-shot: existing accounts never received a verify email, so mark them
 * confirmed the first time this column exists and nobody is verified yet.
 * Later boots skip so new signups stay unverified until they click the link.
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const verified = await prisma.user.count({
      where: { emailVerifiedAt: { not: null } },
    });
    if (verified > 0) return;
    const n = await prisma.user.updateMany({
      where: { emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    if (n.count) {
      console.info(
        "[auth] grandfathered emailVerifiedAt for",
        n.count,
        "existing users",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[auth] grandfather emailVerifiedAt failed", err);
  process.exit(1);
});
