-- AlterEnum
ALTER TYPE "EscalationReason" ADD VALUE 'AUTOMATION_POLICY';
ALTER TYPE "EscalationReason" ADD VALUE 'BROWSER_CHALLENGE';
ALTER TYPE "EscalationReason" ADD VALUE 'LOW_CONFIDENCE';
ALTER TYPE "EscalationReason" ADD VALUE 'HUMAN_TAKEOVER';
ALTER TYPE "EscalationReason" ADD VALUE 'UNMAPPED_VAULT';
ALTER TYPE "EscalationReason" ADD VALUE 'LANGUAGE_MISMATCH';
ALTER TYPE "EscalationReason" ADD VALUE 'SELECTOR_FAILURE';

-- AlterEnum
ALTER TYPE "AnalyticsEventType" ADD VALUE 'AUTOMATION_DECISION';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'AUTOMATION_SENT';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'AUTOMATION_ESCALATED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CONNECT_PLATFORM';
ALTER TYPE "AuditAction" ADD VALUE 'DISCONNECT_PLATFORM';
ALTER TYPE "AuditAction" ADD VALUE 'EMERGENCY_STOP';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_SEND';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_FAIL';
ALTER TYPE "AuditAction" ADD VALUE 'CONFIGURE_AUTONOMY';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_AUTOMATION';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'demo',
ADD COLUMN "platformMediaReference" TEXT,
ADD COLUMN "approvedForAutomation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maximumPriceCents" INTEGER,
ADD COLUMN "alreadySoldDetectionMetadata" JSONB;

-- CreateEnum
CREATE TYPE "PlatformKind" AS ENUM ('ONLYFANS');
CREATE TYPE "AutonomyMode" AS ENUM ('COPILOT', 'HYBRID', 'AUTOPILOT', 'PAUSED');
CREATE TYPE "PlatformConnectionStatus" AS ENUM ('DISCONNECTED', 'LOGIN_REQUIRED', 'CONNECTED', 'SYNCING', 'CHALLENGE_REQUIRED', 'DEGRADED', 'PAUSED');
CREATE TYPE "PlatformDriver" AS ENUM ('MOCK', 'BROWSER');
CREATE TYPE "PlatformMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "PlatformMessageKind" AS ENUM ('TEXT', 'PPV', 'TIP', 'MEDIA', 'SYSTEM');
CREATE TYPE "DeliveryStatus" AS ENUM ('RECEIVED', 'PENDING', 'SENT', 'VERIFIED', 'FAILED', 'AMBIGUOUS');
CREATE TYPE "AutomationActionType" AS ENUM ('SEND_TEXT', 'SEND_PPV', 'FOLLOW_UP', 'WELCOME');
CREATE TYPE "AutomationActionStatus" AS ENUM ('PENDING', 'GENERATING', 'APPROVAL_REQUIRED', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "PlatformKind" NOT NULL DEFAULT 'ONLYFANS',
    "driver" "PlatformDriver" NOT NULL DEFAULT 'MOCK',
    "externalAccountId" TEXT,
    "displayName" TEXT NOT NULL,
    "autonomyMode" "AutonomyMode" NOT NULL DEFAULT 'COPILOT',
    "connectionStatus" "PlatformConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastInboxSyncAt" TIMESTAMP(3),
    "manualInterventionReason" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "canopyConversationId" TEXT NOT NULL,
    "externalConversationId" TEXT NOT NULL,
    "externalFanId" TEXT NOT NULL,
    "externalFanDisplayName" TEXT NOT NULL,
    "lastSyncedMessageId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "automationLockedUntil" TIMESTAMP(3),
    "humanTakeover" BOOLEAN NOT NULL DEFAULT false,
    "processingLockUntil" TIMESTAMP(3),
    "processingLockToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformConversationId" TEXT NOT NULL,
    "canopyMessageId" TEXT,
    "externalMessageId" TEXT NOT NULL,
    "direction" "PlatformMessageDirection" NOT NULL,
    "messageType" "PlatformMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "platformConversationId" TEXT NOT NULL,
    "triggerMessageId" TEXT,
    "actionType" "AutomationActionType" NOT NULL,
    "status" "AutomationActionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "generatedPayload" JSONB,
    "finalPayload" JSONB,
    "confidence" DOUBLE PRECISION,
    "escalationReason" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "screenshotPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationPolicy" (
    "id" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "minimumConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.72,
    "maximumPpvPriceCents" INTEGER NOT NULL DEFAULT 5000,
    "minimumReplyDelaySeconds" INTEGER NOT NULL DEFAULT 8,
    "maximumReplyDelaySeconds" INTEGER NOT NULL DEFAULT 45,
    "maximumMessagesPerHourPerFan" INTEGER NOT NULL DEFAULT 8,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "followUpsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ppvEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHours" JSONB,
    "allowedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalationRules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "humanTakeoverMinutes" INTEGER NOT NULL DEFAULT 30,
    "allowedLanguages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAccount_organizationId_creatorId_platform_key" ON "PlatformAccount"("organizationId", "creatorId", "platform");
CREATE INDEX "PlatformAccount_organizationId_connectionStatus_idx" ON "PlatformAccount"("organizationId", "connectionStatus");
CREATE UNIQUE INDEX "PlatformConversation_platformAccountId_externalConversationId_key" ON "PlatformConversation"("platformAccountId", "externalConversationId");
CREATE INDEX "PlatformConversation_organizationId_platformAccountId_idx" ON "PlatformConversation"("organizationId", "platformAccountId");
CREATE INDEX "PlatformConversation_canopyConversationId_idx" ON "PlatformConversation"("canopyConversationId");
CREATE UNIQUE INDEX "PlatformMessage_platformConversationId_externalMessageId_key" ON "PlatformMessage"("platformConversationId", "externalMessageId");
CREATE INDEX "PlatformMessage_organizationId_platformConversationId_sentAt_idx" ON "PlatformMessage"("organizationId", "platformConversationId", "sentAt");
CREATE UNIQUE INDEX "AutomationAction_idempotencyKey_key" ON "AutomationAction"("idempotencyKey");
CREATE INDEX "AutomationAction_organizationId_status_createdAt_idx" ON "AutomationAction"("organizationId", "status", "createdAt");
CREATE INDEX "AutomationAction_platformAccountId_status_idx" ON "AutomationAction"("platformAccountId", "status");
CREATE UNIQUE INDEX "AutomationPolicy_platformAccountId_key" ON "AutomationPolicy"("platformAccountId");

ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformConversation" ADD CONSTRAINT "PlatformConversation_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformConversation" ADD CONSTRAINT "PlatformConversation_canopyConversationId_fkey" FOREIGN KEY ("canopyConversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformMessage" ADD CONSTRAINT "PlatformMessage_platformConversationId_fkey" FOREIGN KEY ("platformConversationId") REFERENCES "PlatformConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformMessage" ADD CONSTRAINT "PlatformMessage_canopyMessageId_fkey" FOREIGN KEY ("canopyMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_platformConversationId_fkey" FOREIGN KEY ("platformConversationId") REFERENCES "PlatformConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationPolicy" ADD CONSTRAINT "AutomationPolicy_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
