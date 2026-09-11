-- CreateEnum
CREATE TYPE "SequenceKind" AS ENUM ('STARTER', 'TEASER', 'VOICE', 'PHOTO', 'SEXTING', 'PPV', 'FOLLOW_UP', 'AFTERCARE');

-- CreateEnum
CREATE TYPE "SequenceStepMedia" AS ENUM ('TEXT', 'VOICE', 'PHOTO', 'PPV');

-- CreateEnum
CREATE TYPE "FanDominance" AS ENUM ('UNKNOWN', 'SUBMISSIVE', 'DOMINANT', 'SWITCH');

-- AlterTable
ALTER TABLE "CreatorPersona" ADD COLUMN "favouriteColor" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CreatorPersona" ADD COLUMN "favouriteFlowers" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "secondPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "activeSequenceId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "activeSequenceStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "unansweredFollowUps" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SequenceKind" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "mediaHint" "SequenceStepMedia" NOT NULL DEFAULT 'TEXT',
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "priceTier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "realName" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "dominance" "FanDominance" NOT NULL DEFAULT 'UNKNOWN',
    "preferredTone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "extra" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sequence_organizationId_creatorId_kind_idx" ON "Sequence"("organizationId", "creatorId", "kind");

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_position_idx" ON "SequenceStep"("sequenceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FanNote_creatorId_subscriberId_key" ON "FanNote"("creatorId", "subscriberId");

-- CreateIndex
CREATE INDEX "FanNote_organizationId_creatorId_idx" ON "FanNote"("organizationId", "creatorId");

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanNote" ADD CONSTRAINT "FanNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanNote" ADD CONSTRAINT "FanNote_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanNote" ADD CONSTRAINT "FanNote_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_activeSequenceId_fkey" FOREIGN KEY ("activeSequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
