-- T48 (additive only): internal / QA brand flag. No admin invoices or charges
-- for these brands while live Stripe keys are in use.
ALTER TABLE "Host" ADD COLUMN "isTestBrand" BOOLEAN NOT NULL DEFAULT false;
