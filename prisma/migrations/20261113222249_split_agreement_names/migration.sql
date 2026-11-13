-- AlterTable
ALTER TABLE "BorrowedGarment" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "Layaway" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- Backfill: split each existing full name at its LAST space
-- ("Mary Ann Smith" → first "Mary Ann", last "Smith"; a single word is a first name).
UPDATE "Layaway" SET
  "firstName" = CASE WHEN btrim("buyerName") ~ '\s' THEN btrim(regexp_replace(btrim("buyerName"), '\s+\S+$', '')) ELSE btrim("buyerName") END,
  "lastName"  = CASE WHEN btrim("buyerName") ~ '\s' THEN substring(btrim("buyerName") from '\S+$') ELSE NULL END
WHERE "firstName" IS NULL AND "lastName" IS NULL;

UPDATE "BorrowedGarment" SET
  "firstName" = CASE WHEN btrim("borrowerName") ~ '\s' THEN btrim(regexp_replace(btrim("borrowerName"), '\s+\S+$', '')) ELSE btrim("borrowerName") END,
  "lastName"  = CASE WHEN btrim("borrowerName") ~ '\s' THEN substring(btrim("borrowerName") from '\S+$') ELSE NULL END
WHERE "firstName" IS NULL AND "lastName" IS NULL;
