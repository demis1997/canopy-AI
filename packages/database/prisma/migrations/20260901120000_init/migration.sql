-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'AGENCY_OWNER', 'MANAGER', 'CHATTER', 'CREATOR');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('AGENCY', 'INDEPENDENT_CREATOR');

-- CreateEnum
CREATE TYPE "AdultStatus" AS ENUM ('VERIFIED_ADULT', 'PLATFORM_ASSUMED_ADULT', 'UNCERTAIN', 'SUSPECTED_MINOR', 'CONFIRMED_MINOR');

-- CreateEnum
CREATE TYPE "ExplicitnessLevel" AS ENUM ('FLIRTY', 'SUGGESTIVE', 'EXPLICIT', 'VERY_EXPLICIT');

-- CreateEnum
CREATE TYPE "PersonaStyle" AS ENUM ('DOMINANT', 'SUBMISSIVE', 'ROMANTIC', 'PLAYFUL', 'DIRECT');

-- CreateEnum
CREATE TYPE "MessageLength" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('NEW_FAN', 'RAPPORT', 'INTEREST', 'OFFER', 'OBJECTION', 'PURCHASE', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "MessageAuthorType" AS ENUM ('SUBSCRIBER', 'CREATOR', 'CHATTER', 'AI_SUGGESTION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('CASUAL_CHAT', 'FLIRT', 'SEXTING', 'PURCHASE_INTEREST', 'PRICE_OBJECTION', 'CONTENT_REQUEST', 'COMPLAINT', 'REFUND', 'UNSAFE', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "RecommendedAction" AS ENUM ('REPLY', 'BUILD_RAPPORT', 'ESCALATE_EXPLICITNESS', 'PRESENT_OFFER', 'ANSWER_OBJECTION', 'REQUEST_HUMAN_REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('PLAYFUL', 'ROMANTIC', 'TEASING', 'DOMINANT', 'SUBMISSIVE', 'DIRECT');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('PHOTO', 'VIDEO', 'AUDIO', 'TEXT', 'BUNDLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('MINOR_OR_UNCERTAIN_AGE', 'SEXUAL_CONTENT_INVOLVING_MINOR', 'NON_CONSENSUAL', 'EXPLOITATION_TRAFFICKING', 'BESTIALITY', 'SEXTORTION', 'THREAT', 'SEXUAL_VIOLENCE_INSTRUCTIONS', 'IDENTIFIABLE_THIRD_PARTY', 'SELF_HARM_EMERGENCY', 'CREDENTIAL_REQUEST', 'SENSITIVE_PII_REQUEST', 'COMPLAINT_REFUND_CHARGEBACK', 'CONFLICTING_AGE', 'SAFETY_POST_CHECK', 'INVALID_PRODUCT_OR_PRICE', 'PROVIDER_FAILURE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'HIGHLY_SENSITIVE');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('PREFERRED_NAME', 'INTERESTS', 'CONVERSATION_STYLE', 'EXPLICIT_PREFERENCES', 'BOUNDARIES', 'PREVIOUS_PURCHASES', 'PRODUCTS_OFFERED', 'PRICE_OBJECTIONS', 'PROMISES', 'PERSONAL_DETAILS', 'LAST_INTERACTION', 'FOLLOW_UP', 'FUNNEL_STAGE');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'COMPLETED', 'BLOCKED', 'INVALID', 'FAILED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ReplyOutcome" AS ENUM ('PENDING', 'SELECTED', 'EDITED', 'DISCARDED', 'INSERTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('HISTORICAL_CONVERSATION', 'APPROVED_EXAMPLE', 'SALES_SCRIPT', 'PROMPT', 'CHATTER_TRAINING', 'PRODUCT_DESCRIPTION', 'CREATOR_INSTRUCTIONS');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('MESSAGE_RECEIVED', 'GENERATION_REQUESTED', 'SUGGESTIONS_PRODUCED', 'SUGGESTION_ACCEPTED', 'SUGGESTION_EDITED', 'FUNNEL_TRANSITION', 'OFFER_PRESENTED', 'PURCHASE', 'REFUND', 'COMPLAINT', 'ESCALATION', 'SAFETY_BLOCK', 'HUMAN_QUALITY_RATING', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'APPROVE', 'REJECT', 'EXPORT', 'GENERATE', 'SELECT_REPLY', 'ESCALATE', 'ROTATE_KEY', 'CONFIGURE_PROVIDER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'AGENCY',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "seatLimit" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPersona" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT NOT NULL,
    "biography" TEXT NOT NULL DEFAULT '',
    "authorisedBackstory" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '',
    "typicalMessageLength" "MessageLength" NOT NULL DEFAULT 'SHORT',
    "preferredEmojis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequentlyUsedPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredExplicitVocabulary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prohibitedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredCompliments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedExplicitness" "ExplicitnessLevel" NOT NULL DEFAULT 'SUGGESTIVE',
    "style" "PersonaStyle" NOT NULL DEFAULT 'PLAYFUL',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contentBoundaries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimsNeverToMake" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customContentRules" TEXT NOT NULL DEFAULT '',
    "offlineMeetingPolicy" TEXT NOT NULL DEFAULT 'Never arrange offline meetings.',
    "discountLimitPercent" INTEGER NOT NULL DEFAULT 10,
    "escalationRules" TEXT NOT NULL DEFAULT '',
    "approvedExampleMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorBoundary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hardBlock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatterCreatorAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "chatterId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatterCreatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "platformHandle" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'demo',
    "adultStatus" "AdultStatus" NOT NULL DEFAULT 'UNCERTAIN',
    "notes" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriberMemory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriberMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "funnelStage" "FunnelStage" NOT NULL DEFAULT 'NEW_FAN',
    "adultStatus" "AdultStatus" NOT NULL DEFAULT 'UNCERTAIN',
    "rapportPriority" BOOLEAN NOT NULL DEFAULT true,
    "lastOfferAt" TIMESTAMP(3),
    "offerCountToday" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platformThreadId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorType" "MessageAuthorType" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mediaType" "MediaType" NOT NULL,
    "standardPriceCents" INTEGER NOT NULL,
    "minimumPriceCents" INTEGER NOT NULL,
    "bundlePriceCents" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explicitnessCategory" "ExplicitnessLevel" NOT NULL DEFAULT 'EXPLICIT',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "customContent" BOOLEAN NOT NULL DEFAULT false,
    "deliveryRules" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creatorId" TEXT,
    "title" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingChunk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "creatorId" TEXT,
    "content" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "intent" "Intent",
    "funnelStage" "FunnelStage",
    "explicitness" "ExplicitnessLevel",
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "language" TEXT NOT NULL DEFAULT 'en',
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "promptVersionId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "intent" "Intent",
    "funnelStage" "FunnelStage",
    "recommendedAction" "RecommendedAction",
    "recommendedProductId" TEXT,
    "approvedPriceCents" INTEGER,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latencyMs" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(10,6),
    "requestId" TEXT,
    "validationErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "tone" "Tone" NOT NULL,
    "internalReason" TEXT NOT NULL,
    "outcome" "ReplyOutcome" NOT NULL DEFAULT 'PENDING',
    "editDistance" INTEGER,
    "selectedById" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Escalation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT,
    "openedById" TEXT,
    "reason" "EscalationReason" NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "riskEvent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "creatorId" TEXT,
    "chatterId" TEXT,
    "conversationId" TEXT,
    "promptVersionId" TEXT,
    "model" TEXT,
    "playbook" TEXT,
    "numericValue" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMProviderConfiguration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'venice',
    "generationModel" TEXT NOT NULL DEFAULT '',
    "classificationModel" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.venice.ai/api/v1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthOk" BOOLEAN,
    "lastLatencyMs" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLMProviderConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyLastFour" TEXT NOT NULL,
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "memoryRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "generationRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_role_idx" ON "OrganizationMembership"("organizationId", "role");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Creator_organizationId_idx" ON "Creator"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_organizationId_handle_key" ON "Creator"("organizationId", "handle");

-- CreateIndex
CREATE INDEX "CreatorPersona_organizationId_creatorId_isActive_idx" ON "CreatorPersona"("organizationId", "creatorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPersona_creatorId_version_key" ON "CreatorPersona"("creatorId", "version");

-- CreateIndex
CREATE INDEX "CreatorBoundary_organizationId_creatorId_idx" ON "CreatorBoundary"("organizationId", "creatorId");

-- CreateIndex
CREATE INDEX "ChatterCreatorAssignment_organizationId_chatterId_idx" ON "ChatterCreatorAssignment"("organizationId", "chatterId");

-- CreateIndex
CREATE INDEX "ChatterCreatorAssignment_organizationId_creatorId_idx" ON "ChatterCreatorAssignment"("organizationId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatterCreatorAssignment_chatterId_creatorId_key" ON "ChatterCreatorAssignment"("chatterId", "creatorId");

-- CreateIndex
CREATE INDEX "Subscriber_organizationId_idx" ON "Subscriber"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_organizationId_platform_platformHandle_key" ON "Subscriber"("organizationId", "platform", "platformHandle");

-- CreateIndex
CREATE INDEX "SubscriberMemory_organizationId_subscriberId_creatorId_idx" ON "SubscriberMemory"("organizationId", "subscriberId", "creatorId");

-- CreateIndex
CREATE INDEX "SubscriberMemory_organizationId_category_idx" ON "SubscriberMemory"("organizationId", "category");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_lastMessageAt_idx" ON "Conversation"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_creatorId_idx" ON "Conversation"("organizationId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_organizationId_creatorId_subscriberId_key" ON "Conversation"("organizationId", "creatorId", "subscriberId");

-- CreateIndex
CREATE INDEX "Message_organizationId_conversationId_createdAt_idx" ON "Message"("organizationId", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSummary_conversationId_key" ON "ConversationSummary"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationSummary_organizationId_idx" ON "ConversationSummary"("organizationId");

-- CreateIndex
CREATE INDEX "Product_organizationId_creatorId_available_idx" ON "Product"("organizationId", "creatorId", "available");

-- CreateIndex
CREATE INDEX "Offer_organizationId_conversationId_createdAt_idx" ON "Offer"("organizationId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_organizationId_createdAt_idx" ON "Purchase"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Purchase_organizationId_subscriberId_idx" ON "Purchase"("organizationId", "subscriberId");

-- CreateIndex
CREATE INDEX "TrainingDocument_organizationId_status_idx" ON "TrainingDocument"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TrainingChunk_organizationId_creatorId_status_idx" ON "TrainingChunk"("organizationId", "creatorId", "status");

-- CreateIndex
CREATE INDEX "TrainingChunk_organizationId_documentType_idx" ON "TrainingChunk"("organizationId", "documentType");

-- CreateIndex
CREATE INDEX "PromptTemplate_organizationId_idx" ON "PromptTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_templateId_version_key" ON "PromptVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "Generation_organizationId_conversationId_createdAt_idx" ON "Generation"("organizationId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_organizationId_model_createdAt_idx" ON "Generation"("organizationId", "model", "createdAt");

-- CreateIndex
CREATE INDEX "ReplyOption_organizationId_generationId_idx" ON "ReplyOption"("organizationId", "generationId");

-- CreateIndex
CREATE INDEX "Escalation_organizationId_status_createdAt_idx" ON "Escalation"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_organizationId_type_createdAt_idx" ON "AnalyticsEvent"("organizationId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_organizationId_creatorId_createdAt_idx" ON "AnalyticsEvent"("organizationId", "creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_organizationId_chatterId_createdAt_idx" ON "AnalyticsEvent"("organizationId", "chatterId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCredential_organizationId_provider_idx" ON "ApiCredential"("organizationId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "DataRetentionPolicy_organizationId_key" ON "DataRetentionPolicy"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionToken_tokenHash_key" ON "ExtensionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ExtensionToken_userId_expiresAt_idx" ON "ExtensionToken"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPersona" ADD CONSTRAINT "CreatorPersona_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorBoundary" ADD CONSTRAINT "CreatorBoundary_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatterCreatorAssignment" ADD CONSTRAINT "ChatterCreatorAssignment_chatterId_fkey" FOREIGN KEY ("chatterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatterCreatorAssignment" ADD CONSTRAINT "ChatterCreatorAssignment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberMemory" ADD CONSTRAINT "SubscriberMemory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberMemory" ADD CONSTRAINT "SubscriberMemory_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberMemory" ADD CONSTRAINT "SubscriberMemory_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriberMemory" ADD CONSTRAINT "SubscriberMemory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDocument" ADD CONSTRAINT "TrainingDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDocument" ADD CONSTRAINT "TrainingDocument_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingChunk" ADD CONSTRAINT "TrainingChunk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingChunk" ADD CONSTRAINT "TrainingChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "TrainingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingChunk" ADD CONSTRAINT "TrainingChunk_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyOption" ADD CONSTRAINT "ReplyOption_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyOption" ADD CONSTRAINT "ReplyOption_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyOption" ADD CONSTRAINT "ReplyOption_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escalation" ADD CONSTRAINT "Escalation_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMProviderConfiguration" ADD CONSTRAINT "LLMProviderConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCredential" ADD CONSTRAINT "ApiCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionToken" ADD CONSTRAINT "ExtensionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

