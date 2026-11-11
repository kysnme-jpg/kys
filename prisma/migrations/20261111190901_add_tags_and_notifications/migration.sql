-- AlterTable
ALTER TABLE "ExternalThread" ADD COLUMN     "externalNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "storeNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#b4532a',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagAssignment" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "consignorId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSetting" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "notifyStoreOnInboundMessage" BOOLEAN NOT NULL DEFAULT true,
    "notifyConsignorOnStoreReply" BOOLEAN NOT NULL DEFAULT true,
    "notifyAudienceOnNewPost" BOOLEAN NOT NULL DEFAULT false,
    "notifyEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tag_storeId_idx" ON "Tag"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_storeId_name_key" ON "Tag"("storeId", "name");

-- CreateIndex
CREATE INDEX "TagAssignment_consignorId_idx" ON "TagAssignment"("consignorId");

-- CreateIndex
CREATE INDEX "TagAssignment_customerId_idx" ON "TagAssignment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_consignorId_key" ON "TagAssignment"("tagId", "consignorId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_tagId_customerId_key" ON "TagAssignment"("tagId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSetting_storeId_key" ON "NotificationSetting"("storeId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_consignorId_fkey" FOREIGN KEY ("consignorId") REFERENCES "Consignor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSetting" ADD CONSTRAINT "NotificationSetting_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- §5/§4a-style invariant: a tag assignment targets exactly one external party
-- (a consignor OR a customer). New empty table, so a plain validated CHECK is safe.
ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_one_party_chk"
  CHECK (
    ("consignorId" IS NOT NULL AND "customerId" IS NULL)
    OR ("consignorId" IS NULL AND "customerId" IS NOT NULL)
  );
