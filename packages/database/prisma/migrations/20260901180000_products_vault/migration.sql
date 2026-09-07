-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('DEMO_SEED', 'MANUAL', 'CSV_IMPORT', 'MEDIA_UPLOAD', 'PLATFORM_VAULT_SYNC');

-- CreateEnum
CREATE TYPE "PlatformConnectionMode" AS ENUM ('DEMO', 'MANUAL', 'CSV_IMPORT', 'PLATFORM_VAULT_SYNC');

-- CreateEnum
CREATE TYPE "VaultSyncStatus" AS ENUM ('IDLE', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DISABLED');

-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "spendCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "subscribedAt" TIMESTAMP(3),
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mutedAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "followUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priceCents" INTEGER,
ADD COLUMN "purchased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "externalId" TEXT,
ADD COLUMN "timesSold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN "resaleAllowed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "externalId" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placeholderKind" TEXT NOT NULL DEFAULT 'PHOTO_SET',
    "defaultPriceCents" INTEGER NOT NULL DEFAULT 0,
    "minimumPriceCents" INTEGER NOT NULL DEFAULT 0,
    "source" "ProductSource" NOT NULL DEFAULT 'MANUAL',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPreview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT,
    "mode" "PlatformConnectionMode" NOT NULL DEFAULT 'DEMO',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL DEFAULT 'Demo vault',
    "note" TEXT NOT NULL DEFAULT 'No authorised live platform API is connected. DEMO uses seeded vault data. PLATFORM_VAULT_SYNC requires an authorised integration.',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultSyncJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "VaultSyncStatus" NOT NULL DEFAULT 'DISABLED',
    "triggeredBy" TEXT NOT NULL DEFAULT 'user',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelcomeAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL DEFAULT '',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER,
    "productId" TEXT,
    "previewMediaId" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'new_subscribers',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelcomeAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_organizationId_creatorId_idx" ON "MediaAsset"("organizationId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_productId_mediaId_key" ON "ProductMedia"("productId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPreview_productId_mediaId_key" ON "ProductPreview"("productId", "mediaId");

-- CreateIndex
CREATE INDEX "PlatformConnection_organizationId_idx" ON "PlatformConnection"("organizationId");

-- CreateIndex
CREATE INDEX "VaultSyncJob_organizationId_createdAt_idx" ON "VaultSyncJob"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WelcomeAutomation_organizationId_creatorId_idx" ON "WelcomeAutomation"("organizationId", "creatorId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPreview" ADD CONSTRAINT "ProductPreview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPreview" ADD CONSTRAINT "ProductPreview_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultSyncJob" ADD CONSTRAINT "VaultSyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultSyncJob" ADD CONSTRAINT "VaultSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "PlatformConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelcomeAutomation" ADD CONSTRAINT "WelcomeAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WelcomeAutomation" ADD CONSTRAINT "WelcomeAutomation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
