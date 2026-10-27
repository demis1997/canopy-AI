import { z } from "zod";

// Voice preferences never grant permission to bypass the independent policy checks.
export const personaControlsSchema = z
  .object({
    directness: z.enum(["GENTLE", "BALANCED", "DIRECT"]).default("BALANCED"),
    characterization: z.enum(["NEUTRAL", "CONFIDENT", "SOFT", "ASSERTIVE"]).default("NEUTRAL"),
    playfulness: z.number().min(0).max(1).default(0.5),
    casualProfanity: z.enum(["AVOID", "MIRROR", "ALLOW"]).default("MIRROR"),
    casing: z.enum(["PRESERVE", "LOWERCASE"]).default("PRESERVE"),
    emojiFrequency: z.enum(["NONE", "OCCASIONAL", "EXPRESSIVE"]).default("OCCASIONAL"),
    preferredVocabulary: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    avoidedVocabulary: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    pacing: z.enum(["GRADUAL", "BALANCED", "RESPONSIVE"]).default("BALANCED"),
    maxQuestions: z.number().int().min(0).max(1).default(1),
    allowSales: z.boolean().default(true),
    maxOffers: z.number().int().min(0).max(6).default(6),
    maxFollowUps: z.number().int().min(0).max(2).default(1),
  })
  .strict();
export type PersonaControls = z.infer<typeof personaControlsSchema>;
export function resolvePersonaControls(value?: unknown): PersonaControls {
  const result = personaControlsSchema.safeParse(value ?? {});
  return result.success ? result.data : personaControlsSchema.parse({});
}
export const casualProfanityPattern = /\b(?:damn|hell|shit|bullshit|fuck(?:ing)?|crap)\b/i;
export function personaStyleCodes(
  reply: string,
  turn: string,
  controls: PersonaControls,
): string[] {
  const codes: string[] = [];
  if (
    casualProfanityPattern.test(reply) &&
    (controls.casualProfanity === "AVOID" ||
      (controls.casualProfanity === "MIRROR" && !casualProfanityPattern.test(turn)))
  )
    codes.push("PERSONA_PROFANITY");
  if ((reply.match(/\?/g) ?? []).length > controls.maxQuestions)
    codes.push("PERSONA_QUESTION_LIMIT");
  if (controls.emojiFrequency === "NONE" && /\p{Extended_Pictographic}/u.test(reply))
    codes.push("PERSONA_EMOJI_LIMIT");
  if (controls.avoidedVocabulary.some((word) => reply.toLowerCase().includes(word.toLowerCase())))
    codes.push("PERSONA_AVOIDED_VOCABULARY");
  return codes;
}

// Preserve wording. Rejected voice preferences trigger regeneration, never euphemism substitution.
export function applyPersonaCasing(text: string, controls: PersonaControls): string {
  return controls.casing === "LOWERCASE" ? text.toLowerCase() : text;
}
