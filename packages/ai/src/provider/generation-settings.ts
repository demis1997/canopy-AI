import { z } from "zod";
export const generationSettingsSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().gt(0).max(1).default(0.9),
  frequencyPenalty: z.number().min(-2).max(2).default(0.3),
  presencePenalty: z.number().min(-2).max(2).default(0),
  maxTokens: z.number().int().min(256).max(8192).default(2048),
  repetitionPenalty: z.number().min(1).max(2).optional(),
});
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export function generationSettingsFromEnv(env: NodeJS.Dict<string>) {
  const fields = {
    temperature: "AI_TEMPERATURE",
    topP: "AI_TOP_P",
    frequencyPenalty: "AI_FREQUENCY_PENALTY",
    presencePenalty: "AI_PRESENCE_PENALTY",
    maxTokens: "AI_MAX_OUTPUT_TOKENS",
    repetitionPenalty: "AI_REPETITION_PENALTY",
  } as const;
  const raw: Record<string, number> = {};
  for (const [field, key] of Object.entries(fields))
    if (env[key]?.trim()) raw[field] = Number(env[key]);
  if (raw.repetitionPenalty !== undefined && env.AI_REPETITION_PENALTY_SUPPORTED !== "true")
    throw new Error("AI_REPETITION_PENALTY requires explicit endpoint support");
  return generationSettingsSchema.parse(raw);
}
