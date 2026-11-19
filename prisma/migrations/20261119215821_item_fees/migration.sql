-- CreateTable
CREATE TABLE "ItemFee" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "chargedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemFee_itemId_idx" ON "ItemFee"("itemId");

-- AddForeignKey
ALTER TABLE "ItemFee" ADD CONSTRAINT "ItemFee_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
