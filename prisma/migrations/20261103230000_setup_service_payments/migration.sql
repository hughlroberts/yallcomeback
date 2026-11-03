-- T46 (additive only): open setup Checkout session + one row per paid setup session.
ALTER TABLE "Host" ADD COLUMN "setupServiceOpenSessionId" TEXT;

CREATE TABLE "SetupServicePayment" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "amountCents" INTEGER,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "adminAlertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupServicePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SetupServicePayment_sessionId_key" ON "SetupServicePayment"("sessionId");
CREATE INDEX "SetupServicePayment_hostId_idx" ON "SetupServicePayment"("hostId");

ALTER TABLE "SetupServicePayment" ADD CONSTRAINT "SetupServicePayment_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;
