-- AlterEnum
ALTER TYPE "EscalationReason" ADD VALUE 'FAN_REQUESTED_HUMAN';

-- AlterEnum
ALTER TYPE "GenerationStatus" ADD VALUE 'STALE';

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN "inputMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "operationalIntent" TEXT,
ADD COLUMN "responseMode" TEXT,
ADD COLUMN "diagnostics" JSONB;
