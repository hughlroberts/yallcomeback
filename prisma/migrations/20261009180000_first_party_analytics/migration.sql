-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "visitorId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "visitorId" TEXT,
    "listingId" TEXT,
    "bookingId" TEXT,
    "value" DOUBLE PRECISION,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "path" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");

-- CreateIndex
CREATE INDEX "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");

-- CreateIndex
CREATE INDEX "page_views_visitorId_createdAt_idx" ON "page_views"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "page_views_utmSource_createdAt_idx" ON "page_views"("utmSource", "createdAt");

-- CreateIndex
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");

-- CreateIndex
CREATE INDEX "events_name_createdAt_idx" ON "events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "events_utmSource_createdAt_idx" ON "events"("utmSource", "createdAt");

-- CreateIndex
CREATE INDEX "events_listingId_createdAt_idx" ON "events"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "events_bookingId_name_idx" ON "events"("bookingId", "name");
