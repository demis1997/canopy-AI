import { describe, expect, it } from "vitest";
import {
  automationDecisionSchema,
  confidenceFromGeneration,
  defaultAutomationPolicy,
  evaluateDeliveryGates,
  extraAutomationFlags,
  idempotencyKey,
  inQuietHours,
  readFeatureFlags,
  routeAutonomy,
  type AutomationDecision,
  type DeliveryGateInput,
} from "../src/automation.js";

const decision = (over: Partial<AutomationDecision> = {}): AutomationDecision => ({
  action: "SEND_TEXT",
  messages: ["mmm hey"],
  productId: null,
  price: null,
  confidence: 0.9,
  funnelStage: "RAPPORT",
  reason: "ok",
  scheduledDelaySeconds: 8,
  safetyFlags: [],
  ...over,
});

const baseGate = (over: Partial<DeliveryGateInput> = {}): DeliveryGateInput => ({
  expectedAccountId: "acc_1",
  actualAccountId: "acc_1",
  expectedFanId: "fan_1",
  actualFanId: "fan_1",
  autonomyMode: "HYBRID",
  flags: { browserIntegration: true, autonomousText: true, autonomousPpv: false, mockPlatform: true },
  humanTakeover: false,
  lockedUntil: null,
  newerMessageAfterTrigger: false,
  alreadySentForTrigger: false,
  messagesSentLastHour: 0,
  policy: defaultAutomationPolicy(),
  decision: decision(),
  safetyAllowed: true,
  bannedWordHit: false,
  ...over,
});

describe("feature flags", () => {
  it("defaults autonomous text on and live browser/PPV off", () => {
    const flags = readFeatureFlags({});
    expect(flags.browserIntegration).toBe(false);
    expect(flags.autonomousText).toBe(true);
    expect(flags.autonomousPpv).toBe(false);
    expect(flags.mockPlatform).toBe(true);
  });
});

describe("decision schema", () => {
  it("accepts a valid automation decision", () => {
    expect(automationDecisionSchema.safeParse(decision()).success).toBe(true);
  });
});

describe("idempotency", () => {
  it("builds a stable key", () => {
    expect(
      idempotencyKey({
        platformAccountId: "a",
        externalConversationId: "c",
        triggerExternalMessageId: "m",
        actionType: "SEND_TEXT",
      }),
    ).toBe("a:c:m:SEND_TEXT");
  });
});

describe("delivery gates", () => {
  it("blocks emergency-stop / paused; copilot auto-sends when the flag is on", () => {
    expect(evaluateDeliveryGates(baseGate({ autonomyMode: "PAUSED" })).ok).toBe(false);
    expect(evaluateDeliveryGates(baseGate({ autonomyMode: "COPILOT" })).ok).toBe(true);
  });

  it("allows a human-approved copilot send while still blocking paused accounts", () => {
    expect(evaluateDeliveryGates(baseGate({ autonomyMode: "COPILOT", humanApproved: true })).ok).toBe(true);
    expect(evaluateDeliveryGates(baseGate({ autonomyMode: "PAUSED", humanApproved: true })).ok).toBe(false);
  });

  it("blocks when autonomous text flag is off", () => {
    expect(
      evaluateDeliveryGates(
        baseGate({
          flags: { browserIntegration: true, autonomousText: false, autonomousPpv: false, mockPlatform: true },
        }),
      ).reason,
    ).toBe("AUTONOMOUS_TEXT_DISABLED");
  });

  it("blocks human takeover and newer messages and duplicates", () => {
    expect(evaluateDeliveryGates(baseGate({ humanTakeover: true })).reason).toBe("HUMAN_TAKEOVER");
    expect(evaluateDeliveryGates(baseGate({ newerMessageAfterTrigger: true })).reason).toBe("NEWER_MESSAGE");
    expect(evaluateDeliveryGates(baseGate({ alreadySentForTrigger: true })).reason).toBe("DUPLICATE_TRIGGER");
  });

  it("enforces per-fan hourly rate limits", () => {
    const policy = { ...defaultAutomationPolicy(), maximumMessagesPerHourPerFan: 2 };
    expect(evaluateDeliveryGates(baseGate({ policy, messagesSentLastHour: 2 })).reason).toBe("RATE_LIMIT");
  });

  it("escalates low confidence", () => {
    expect(evaluateDeliveryGates(baseGate({ decision: decision({ confidence: 0.2 }) })).reason).toBe(
      "LOW_CONFIDENCE",
    );
  });

  it("blocks PPV when flag, mapping, purchase or price fails", () => {
    const ppv = decision({ action: "SEND_PPV", productId: "p1", price: 40, confidence: 0.9 });
    const flags = { browserIntegration: true, autonomousText: true, autonomousPpv: true, mockPlatform: true };
    const product = {
      id: "p1",
      approvedForAutomation: true,
      alreadyPurchased: false,
      platformMediaReference: "vault_1",
      minimumPriceCents: 1000,
      maximumPriceCents: 8000,
      standardPriceCents: 4000,
    };
    expect(
      evaluateDeliveryGates(baseGate({ decision: ppv, flags, product, policy: { ...defaultAutomationPolicy(), ppvEnabled: true } })).ok,
    ).toBe(true);
    expect(
      evaluateDeliveryGates(
        baseGate({
          decision: ppv,
          flags: { ...flags, autonomousPpv: false },
          product,
          policy: { ...defaultAutomationPolicy(), ppvEnabled: true },
        }),
      ).reason,
    ).toBe("AUTONOMOUS_PPV_DISABLED");
    expect(
      evaluateDeliveryGates(
        baseGate({
          decision: ppv,
          flags,
          product: { ...product, alreadyPurchased: true },
          policy: { ...defaultAutomationPolicy(), ppvEnabled: true },
        }),
      ).reason,
    ).toBe("ALREADY_PURCHASED");
    expect(
      evaluateDeliveryGates(
        baseGate({
          decision: decision({ action: "SEND_PPV", productId: "p1", price: 80, confidence: 0.9 }),
          flags,
          product,
          policy: { ...defaultAutomationPolicy(), ppvEnabled: true, maximumPpvPriceCents: 5000 },
        }),
      ).reason,
    ).toBe("PPV_PRICE_LIMIT");
    expect(
      evaluateDeliveryGates(
        baseGate({
          decision: ppv,
          flags,
          product: { ...product, platformMediaReference: null },
          policy: { ...defaultAutomationPolicy(), ppvEnabled: true },
        }),
      ).reason,
    ).toBe("UNMAPPED_VAULT");
  });
});

describe("autonomy routing", () => {
  const flags = { browserIntegration: true, autonomousText: true, autonomousPpv: false, mockPlatform: true };
  const policy = defaultAutomationPolicy();
  const gateOk = { ok: true, reason: "OK", flags: [] };

  it("schedules copilot when autonomous text is on; paused still cancels", () => {
    expect(
      routeAutonomy({ mode: "COPILOT", flags, decision: decision(), policy, humanTakeover: false, gate: gateOk })
        .status,
    ).toBe("SCHEDULED");
    expect(
      routeAutonomy({ mode: "PAUSED", flags, decision: decision(), policy, humanTakeover: false, gate: gateOk })
        .status,
    ).toBe("CANCELLED");
  });

  it("schedules hybrid/autopilot only when gates pass", () => {
    expect(
      routeAutonomy({ mode: "AUTOPILOT", flags, decision: decision(), policy, humanTakeover: false, gate: gateOk })
        .status,
    ).toBe("SCHEDULED");
    expect(
      routeAutonomy({
        mode: "HYBRID",
        flags,
        decision: decision(),
        policy,
        humanTakeover: false,
        gate: { ok: false, reason: "LOW_CONFIDENCE", flags: [] },
      }).status,
    ).toBe("APPROVAL_REQUIRED");
  });
});

describe("safety helpers", () => {
  it("flags meetings and custom content", () => {
    expect(extraAutomationFlags("come over to my hotel")).toContain("OFFLINE_MEETING");
    expect(extraAutomationFlags("can you make me a custom video")).toContain("CUSTOM_CONTENT");
  });

  it("treats quiet hours as UTC", () => {
    expect(inQuietHours(new Date("2026-09-04T03:00:00Z"), { startHour: 2, endHour: 8 })).toBe(true);
    expect(inQuietHours(new Date("2026-09-04T12:00:00Z"), { startHour: 2, endHour: 8 })).toBe(false);
  });

  it("lowers confidence for blocked generations", () => {
    expect(confidenceFromGeneration({ blocked: true })).toBeLessThan(0.3);
  });
});
