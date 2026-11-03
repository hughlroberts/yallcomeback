-- AlterTable (additive: default-false column, no data change)
ALTER TABLE "Host" ADD COLUMN "servicesOverride" BOOLEAN NOT NULL DEFAULT false;
