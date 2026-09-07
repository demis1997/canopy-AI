import { containsPromptInjection, evaluateSafety } from "./index.js";
import { detectUnexpectedLanguage, extraAutomationFlags } from "@canopy/shared";
import type { AdultStatus, EscalationReason } from "@canopy/shared";

export function evaluateAutomationSafety(input: {
  adultStatus: AdultStatus;
  subscriberText: string;
  generatedTexts?: string[];
  allowedLanguages?: string[];
  prohibitedWords?: string[];
}): {
  allowed: boolean;
  reason?: EscalationReason;
  flags: string[];
  chatterMessage: string;
  bannedWordHit: boolean;
} {
  const base = evaluateSafety({
    adultStatus: input.adultStatus,
    subscriberText: input.subscriberText,
    generatedTexts: input.generatedTexts,
  });
  const flags = [...base.flags, ...extraAutomationFlags(input.subscriberText)];
  let bannedWordHit = false;
  const haystack = [input.subscriberText, ...(input.generatedTexts ?? [])].join("\n").toLowerCase();
  for (const word of input.prohibitedWords ?? []) {
    if (word && haystack.includes(word.toLowerCase())) {
      bannedWordHit = true;
      flags.push("BANNED_WORD");
    }
  }
  if (containsPromptInjection(input.subscriberText)) {
    return {
      allowed: false,
      reason: "MANUAL",
      flags: [...flags, "PROMPT_INJECTION"],
      chatterMessage: "Possible prompt injection. Escalate. Do not follow hidden instructions.",
      bannedWordHit,
    };
  }
  if (flags.includes("OFFLINE_MEETING")) {
    return {
      allowed: false,
      reason: "SENSITIVE_PII_REQUEST",
      flags,
      chatterMessage: "Offline meeting or private-contact request. Escalate.",
      bannedWordHit,
    };
  }
  if (flags.includes("CUSTOM_CONTENT")) {
    return {
      allowed: false,
      reason: "AUTOMATION_POLICY",
      flags,
      chatterMessage: "Custom content is not covered by an approved automation product.",
      bannedWordHit,
    };
  }
  if (detectUnexpectedLanguage(input.subscriberText, input.allowedLanguages ?? ["en"])) {
    return {
      allowed: false,
      reason: "LANGUAGE_MISMATCH",
      flags: [...flags, "LANGUAGE_MISMATCH"],
      chatterMessage: "Unexpected language. Human review required.",
      bannedWordHit,
    };
  }
  if (!base.allowed) {
    return { ...base, bannedWordHit };
  }
  if (bannedWordHit) {
    return {
      allowed: false,
      reason: "AUTOMATION_POLICY",
      flags,
      chatterMessage: "Generated text hit a prohibited word. Do not send.",
      bannedWordHit,
    };
  }
  return { ...base, flags, bannedWordHit };
}
