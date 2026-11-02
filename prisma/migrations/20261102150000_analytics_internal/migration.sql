-- AlterTable
ALTER TABLE "User" ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "events" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "events_userId_idx" ON "events"("userId");
