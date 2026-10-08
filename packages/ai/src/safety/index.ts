import type { AdultStatus, EscalationReason } from "@canopy/shared";

export type SafetyVerdict = {
  allowed: boolean;
  explicitAllowed: boolean;
  reason?: EscalationReason;
  flags: string[];
  chatterMessage: string;
};

const MINOR_PATTERNS: RegExp[] = [
  /\b(i['’]?m|i am|im)\s*(1[0-7]|under\s*18)\b/i,
  /\b(1[0-7])\s*(years?\s*old|yo)\b/i,
  /\b(minor|underage|not 18|not eighteen)\b/i,
  /\b(loli|lolita|child\s*porn|csam|preteen|schoolgirl\s*under)\b/i,
  /\b(my|his|her|their)\s*(daughter|son|kid|child|niece|nephew)\b.{0,40}\b(nude|sex|naked)\b/i,
];

const NONCON_PATTERNS: RegExp[] = [
  /\b(rape(?!\s*play)|unconscious|knock (her|him|them) out|roofie|date.?rape)\b/i,
  /\b(traffic(?:k)?(?:ing)?|sell (her|him) into|force (her|him) to have sex)\b/i,
];

const BESTIALITY = /\b(animal sex|with (a |my )?(dog|horse|zoo))\b/i;
const SEXTORTION = /\b(pay (me|or)|send money or i('ll| will) (post|leak|expose)|blackmail)\b/i;
const THREAT = /\b(i('ll| will) (kill|hurt|find you|come to your house))\b/i;
const VIOLENCE_INSTRUCTIONS = /\b(how to (rape|strangle|chloroform))\b/i;
const SELF_HARM = /\b(kill myself|suicide|want to die|overdose)\b/i;
const CREDENTIALS =
  /\b(password|2fa|verification code|login to my|bank pin|ssn|social security)\b/i;
const PII_ADDRESS =
  /\b(\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd)|home address|where do you live exactly)\b/i;
const COMPLAINT = /\b(chargeback|better business|lawyer|sue you|report to (visa|bank))\b/i;

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function evaluateSafety(input: {
  adultStatus: AdultStatus;
  subscriberText: string;
  generatedTexts?: string[];
}): SafetyVerdict {
  const text = [input.subscriberText, ...(input.generatedTexts ?? [])].join("\n");
  const flags: string[] = [];

  if (
    input.adultStatus === "CONFIRMED_MINOR" ||
    input.adultStatus === "SUSPECTED_MINOR" ||
    input.adultStatus === "UNCERTAIN"
  ) {
    flags.push("AGE_BLOCK");
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "MINOR_OR_UNCERTAIN_AGE",
      flags,
      chatterMessage:
        "Do not generate a sexual reply. Age is uncertain or indicates a minor. Escalate to a human and keep the conversation non-sexual until age is verified.",
    };
  }

  if (anyMatch(text, MINOR_PATTERNS)) {
    flags.push("MINOR_LANGUAGE");
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "SEXUAL_CONTENT_INVOLVING_MINOR",
      flags,
      chatterMessage:
        "Possible minor or underage third party. Stop sexual generation and escalate.",
    };
  }

  if (anyMatch(text, NONCON_PATTERNS)) {
    flags.push("NONCON");
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "NON_CONSENSUAL",
      flags,
      chatterMessage:
        "Non-consensual or exploitative content. Escalate. Do not continue the scene.",
    };
  }

  if (BESTIALITY.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "BESTIALITY",
      flags: ["BESTIALITY"],
      chatterMessage: "Blocked category. Escalate.",
    };
  }
  if (SEXTORTION.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "SEXTORTION",
      flags: ["SEXTORTION"],
      chatterMessage: "Possible extortion or blackmail. Escalate. Do not negotiate.",
    };
  }
  if (THREAT.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "THREAT",
      flags: ["THREAT"],
      chatterMessage: "Credible threat language. Escalate.",
    };
  }
  if (VIOLENCE_INSTRUCTIONS.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "SEXUAL_VIOLENCE_INSTRUCTIONS",
      flags: ["VIOLENCE"],
      chatterMessage: "Requests for sexual violence instructions. Escalate.",
    };
  }
  if (SELF_HARM.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "SELF_HARM_EMERGENCY",
      flags: ["SELF_HARM"],
      chatterMessage: "Possible emergency or self-harm. Stop sales. Escalate to a human.",
    };
  }
  if (CREDENTIALS.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "CREDENTIAL_REQUEST",
      flags: ["CREDENTIALS"],
      chatterMessage: "Credential request. Never collect passwords or codes. Escalate.",
    };
  }
  if (PII_ADDRESS.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "SENSITIVE_PII_REQUEST",
      flags: ["PII"],
      chatterMessage: "Request for a private address or sensitive personal data. Escalate.",
    };
  }
  if (COMPLAINT.test(text)) {
    return {
      allowed: false,
      explicitAllowed: false,
      reason: "COMPLAINT_REFUND_CHARGEBACK",
      flags: ["COMPLAINT"],
      chatterMessage: "Refund, chargeback, or serious complaint. Human review required.",
    };
  }

  const explicitAllowed =
    input.adultStatus === "VERIFIED_ADULT" || input.adultStatus === "PLATFORM_ASSUMED_ADULT";

  return {
    allowed: true,
    explicitAllowed,
    flags,
    chatterMessage: "",
  };
}

export function containsPromptInjection(text: string): boolean {
  return (
    /ignore (all|any|previous|prior) instructions/i.test(text) ||
    (/you are now /i.test(text) && /system prompt/i.test(text)) ||
    /<(system|instructions)>/i.test(text)
  );
}
