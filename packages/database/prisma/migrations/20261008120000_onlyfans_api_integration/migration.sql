-- AlterEnum
ALTER TYPE "PlatformDriver" ADD VALUE 'ONLYFANS_API';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "platformAccountId" TEXT,
ADD COLUMN     "sourceAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sourceMetadata" JSONB,
ADD COLUMN     "sourcePriceCents" INTEGER;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "externalReceiptId" TEXT;

-- AlterTable
ALTER TABLE "ExtensionToken" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "platformAccountId" TEXT,
ADD COLUMN     "sourceMetadata" JSONB;

-- AlterTable
ALTER TABLE "PlatformAccount" ADD COLUMN     "apiKeyLastFour" TEXT,
ADD COLUMN     "encryptedApiKey" TEXT,
ADD COLUMN     "lastCatalogSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastReceiptSyncAt" TIMESTAMP(3),
ADD COLUMN     "providerAccountId" TEXT,
ADD COLUMN     "syncLockToken" TEXT,
ADD COLUMN     "syncLockUntil" TIMESTAMP(3),
ADD COLUMN     "workerLockToken" TEXT,
ADD COLUMN     "workerLockUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CatalogSyncRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "importedMedia" INTEGER NOT NULL DEFAULT 0,
    "importedProducts" INTEGER NOT NULL DEFAULT 0,
    "progress" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalFanId" TEXT,
    "sourceMessageId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogSyncRun_organizationId_platformAccountId_createdAt_idx" ON "CatalogSyncRun"("organizationId", "platformAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformReceipt_organizationId_reconciled_idx" ON "PlatformReceipt"("organizationId", "reconciled");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformReceipt_platformAccountId_externalId_key" ON "PlatformReceipt"("platformAccountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_importKey_key" ON "Product"("importKey");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_externalReceiptId_key" ON "Purchase"("externalReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_importKey_key" ON "MediaAsset"("importKey");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSyncRun" ADD CONSTRAINT "CatalogSyncRun_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformReceipt" ADD CONSTRAINT "PlatformReceipt_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one active catalog import per creator account, including racing requests.
CREATE UNIQUE INDEX "CatalogSyncRun_one_active_per_account" ON "CatalogSyncRun"("platformAccountId") WHERE "status" IN ('QUEUED', 'RUNNING');
