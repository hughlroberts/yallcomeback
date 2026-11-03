-- AlterTable (additive: nullable columns only, no data change)
ALTER TABLE "Host" ADD COLUMN "setupServiceCheckoutSessionId" TEXT;
ALTER TABLE "Host" ADD COLUMN "setupServiceAdminNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Host" ADD COLUMN "marketplaceGraceEndsAt" TIMESTAMP(3);
ALTER TABLE "Host" ADD COLUMN "marketplaceSuspendedAt" TIMESTAMP(3);
