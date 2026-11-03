-- AlterTable (additive: nullable column, no data change)
ALTER TABLE "Property" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Property_hostId_archivedAt_idx" ON "Property"("hostId", "archivedAt");
