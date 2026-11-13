-- AlterTable
ALTER TABLE "Consignor" ALTER COLUMN "portalEnabled" SET DEFAULT true;

-- Turn the portal on for every existing consignor (requested by the owner).
-- This only sets the flag: a consignor who has never been sent a login still
-- needs one ("Resend portal access" / "Email inventory") before they can sign in.
UPDATE "Consignor" SET "portalEnabled" = true WHERE "portalEnabled" = false;
