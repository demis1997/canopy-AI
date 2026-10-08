export const ROLES = ["PLATFORM_ADMIN", "AGENCY_OWNER", "MANAGER", "CHATTER", "CREATOR"] as const;
export type Role = (typeof ROLES)[number];

export const ORGANIZATION_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const ORGANIZATION_TYPES = ["AGENCY", "INDEPENDENT_CREATOR"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ADULT_STATUSES = [
  "VERIFIED_ADULT",
  "PLATFORM_ASSUMED_ADULT",
  "UNCERTAIN",
  "SUSPECTED_MINOR",
  "CONFIRMED_MINOR",
] as const;
export type AdultStatus = (typeof ADULT_STATUSES)[number];

export const EXPLICITNESS_LEVELS = ["FLIRTY", "SUGGESTIVE", "EXPLICIT", "VERY_EXPLICIT"] as const;
export type ExplicitnessLevel = (typeof EXPLICITNESS_LEVELS)[number];

export const PERSONA_STYLES = ["DOMINANT", "SUBMISSIVE", "ROMANTIC", "PLAYFUL", "DIRECT"] as const;
export type PersonaStyle = (typeof PERSONA_STYLES)[number];

export const FUNNEL_STAGES = [
  "NEW_FAN",
  "RAPPORT",
  "INTEREST",
  "OFFER",
  "OBJECTION",
  "PURCHASE",
  "FOLLOW_UP",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const MESSAGE_AUTHOR_TYPES = [
  "SUBSCRIBER",
  "CREATOR",
  "CHATTER",
  "AI_SUGGESTION",
  "SYSTEM",
] as const;
export type MessageAuthorType = (typeof MESSAGE_AUTHOR_TYPES)[number];

export const INTENTS = [
  "CASUAL_CHAT",
  "FLIRT",
  "SEXTING",
  "PURCHASE_INTEREST",
  "PRICE_OBJECTION",
  "CONTENT_REQUEST",
  "COMPLAINT",
  "REFUND",
  "UNSAFE",
  "UNCERTAIN",
] as const;
export type Intent = (typeof INTENTS)[number];

export const RECOMMENDED_ACTIONS = [
  "REPLY",
  "BUILD_RAPPORT",
  "ESCALATE_EXPLICITNESS",
  "PRESENT_OFFER",
  "ANSWER_OBJECTION",
  "REQUEST_HUMAN_REVIEW",
  "BLOCK",
] as const;
export type RecommendedAction = (typeof RECOMMENDED_ACTIONS)[number];

export const TONES = [
  "PLAYFUL",
  "ROMANTIC",
  "TEASING",
  "DOMINANT",
  "SUBMISSIVE",
  "DIRECT",
] as const;
export type Tone = (typeof TONES)[number];

export const MEDIA_TYPES = ["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const ESCALATION_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const ESCALATION_REASONS = [
  "MINOR_OR_UNCERTAIN_AGE",
  "SEXUAL_CONTENT_INVOLVING_MINOR",
  "NON_CONSENSUAL",
  "EXPLOITATION_TRAFFICKING",
  "BESTIALITY",
  "SEXTORTION",
  "THREAT",
  "SEXUAL_VIOLENCE_INSTRUCTIONS",
  "IDENTIFIABLE_THIRD_PARTY",
  "SELF_HARM_EMERGENCY",
  "CREDENTIAL_REQUEST",
  "SENSITIVE_PII_REQUEST",
  "COMPLAINT_REFUND_CHARGEBACK",
  "CONFLICTING_AGE",
  "SAFETY_POST_CHECK",
  "INVALID_PRODUCT_OR_PRICE",
  "PROVIDER_FAILURE",
  "MANUAL",
  "AUTOMATION_POLICY",
  "BROWSER_CHALLENGE",
  "LOW_CONFIDENCE",
  "HUMAN_TAKEOVER",
  "FAN_REQUESTED_HUMAN",
  "UNMAPPED_VAULT",
  "LANGUAGE_MISMATCH",
  "SELECTOR_FAILURE",
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const SENSITIVITY_LEVELS = ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const MEMORY_CATEGORIES = [
  "PREFERRED_NAME",
  "INTERESTS",
  "CONVERSATION_STYLE",
  "EXPLICIT_PREFERENCES",
  "BOUNDARIES",
  "PREVIOUS_PURCHASES",
  "PRODUCTS_OFFERED",
  "PRICE_OBJECTIONS",
  "PROMISES",
  "PERSONAL_DETAILS",
  "LAST_INTERACTION",
  "FOLLOW_UP",
  "FUNNEL_STAGE",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const PLAYBOOKS = [
  "NEW_SUBSCRIBER_GREETING",
  "BUILDING_RAPPORT",
  "IDENTIFYING_INTERESTS",
  "FLIRTING",
  "SEXTING",
  "INTRODUCING_PRODUCT",
  "PRESENTING_PPV",
  "PRICE_OBJECTION",
  "UPSELLING",
  "NO_RESPONSE_FOLLOW_UP",
  "AFTERCARE",
  "POST_PURCHASE",
  "COMPLAINT_REFUND",
] as const;
export type Playbook = (typeof PLAYBOOKS)[number];

export const ANALYTICS_EVENT_TYPES = [
  "MESSAGE_RECEIVED",
  "GENERATION_REQUESTED",
  "SUGGESTIONS_PRODUCED",
  "SUGGESTION_ACCEPTED",
  "SUGGESTION_EDITED",
  "FUNNEL_TRANSITION",
  "OFFER_PRESENTED",
  "PURCHASE",
  "REFUND",
  "COMPLAINT",
  "ESCALATION",
  "SAFETY_BLOCK",
  "HUMAN_QUALITY_RATING",
  "OVERRIDE",
  "AUTOMATION_DECISION",
  "AUTOMATION_SENT",
  "AUTOMATION_ESCALATED",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const DOCUMENT_TYPES = [
  "HISTORICAL_CONVERSATION",
  "APPROVED_EXAMPLE",
  "SALES_SCRIPT",
  "PROMPT",
  "CHATTER_TRAINING",
  "PRODUCT_DESCRIPTION",
  "CREATOR_INSTRUCTIONS",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PRODUCT_SOURCES = [
  "DEMO_SEED",
  "MANUAL",
  "CSV_IMPORT",
  "MEDIA_UPLOAD",
  "PLATFORM_VAULT_SYNC",
] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PLATFORM_CONNECTION_MODES = [
  "DEMO",
  "MANUAL",
  "CSV_IMPORT",
  "PLATFORM_VAULT_SYNC",
] as const;
export type PlatformConnectionMode = (typeof PLATFORM_CONNECTION_MODES)[number];

export const GENERATION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "BLOCKED",
  "INVALID",
  "FAILED",
  "MANUAL_REVIEW",
  "STALE",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const REPLY_OUTCOMES = ["PENDING", "SELECTED", "EDITED", "DISCARDED", "INSERTED"] as const;
export type ReplyOutcome = (typeof REPLY_OUTCOMES)[number];

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "SUSPEND",
  "APPROVE",
  "REJECT",
  "EXPORT",
  "GENERATE",
  "SELECT_REPLY",
  "ESCALATE",
  "ROTATE_KEY",
  "CONFIGURE_PROVIDER",
  "CONNECT_PLATFORM",
  "DISCONNECT_PLATFORM",
  "EMERGENCY_STOP",
  "AUTOMATION_SEND",
  "AUTOMATION_FAIL",
  "CONFIGURE_AUTONOMY",
  "APPROVE_AUTOMATION",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
