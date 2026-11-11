-- §4a Layer 2: physical database CHECK constraints enforcing the messaging
-- isolation invariants the application already enforces. Added NOT VALID so the
-- migration can never fail on existing rows — every NEW write is still checked.
-- Prisma can't express CHECK constraints in schema.prisma, so they live here and
-- are applied only through `prisma migrate deploy`.

-- External thread: exactly one external party, consistent with externalClass.
ALTER TABLE "ExternalThread"
  ADD CONSTRAINT "ExternalThread_one_party_chk"
  CHECK (
    ("consignorId" IS NOT NULL AND "customerId" IS NULL AND "externalClass" = 'CONSIGNOR')
    OR
    ("consignorId" IS NULL AND "customerId" IS NOT NULL AND "externalClass" = 'CUSTOMER')
  ) NOT VALID;

-- External message: sender is exactly one recognised class.
ALTER TABLE "ExternalMessage"
  ADD CONSTRAINT "ExternalMessage_sender_class_chk"
  CHECK ("senderClass" IN ('INTERNAL', 'EXTERNAL')) NOT VALID;

-- Internal message belongs to exactly one of a channel or a direct thread.
ALTER TABLE "InternalMessage"
  ADD CONSTRAINT "InternalMessage_one_target_chk"
  CHECK (
    ("channelId" IS NOT NULL AND "threadId" IS NULL)
    OR ("channelId" IS NULL AND "threadId" IS NOT NULL)
  ) NOT VALID;

-- Internal participant belongs to exactly one of a channel or a direct thread.
ALTER TABLE "InternalParticipant"
  ADD CONSTRAINT "InternalParticipant_one_target_chk"
  CHECK (
    ("channelId" IS NOT NULL AND "threadId" IS NULL)
    OR ("channelId" IS NULL AND "threadId" IS NOT NULL)
  ) NOT VALID;
