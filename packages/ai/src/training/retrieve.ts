import type { FunnelStage, Intent } from "@canopy/shared";
import {
  AGENCY_TRAINING_CHUNKS,
  personaLooksTrans,
  type TrainingChunkSeed,
} from "./corpus.js";

export type RetrievalQuery = {
  message: string;
  intent: Intent;
  funnelStage: FunnelStage;
  transPersona: boolean;
  extraChunks?: { content: string; tags?: string[]; intent?: string | null; funnelStage?: string | null }[];
};

const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "you", "i", "it", "is", "for", "in"]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function scoreChunk(query: RetrievalQuery, chunk: TrainingChunkSeed): number {
  if (chunk.tags.includes("trans") && !query.transPersona) return -100;
  let score = 0;
  if (chunk.intent && chunk.intent === query.intent) score += 6;
  if (chunk.funnelStage && chunk.funnelStage === query.funnelStage) score += 4;
  if (query.intent === "SEXTING" && chunk.tags.includes("sexting")) score += 5;
  if (query.intent === "PRICE_OBJECTION" && chunk.tags.includes("pricing")) score += 8;
  if (query.funnelStage === "NEW_FAN" && chunk.tags.includes("first-message")) score += 6;
  if (query.transPersona && chunk.tags.includes("trans")) score += 7;
  const q = new Set(tokens(`${query.message} ${query.intent} ${query.funnelStage}`));
  for (const t of tokens(chunk.content + " " + chunk.tags.join(" "))) {
    if (q.has(t)) score += 1;
  }
  return score;
}

export function retrieveTraining(query: RetrievalQuery, limit = 8): string[] {
  const extra: TrainingChunkSeed[] = (query.extraChunks ?? []).map((c, i) => ({
    title: `db-${i}`,
    documentType: "APPROVED_EXAMPLE",
    content: c.content,
    intent: (c.intent as Intent | undefined) ?? undefined,
    funnelStage: (c.funnelStage as FunnelStage | undefined) ?? undefined,
    tags: c.tags ?? [],
  }));
  const ranked = [...AGENCY_TRAINING_CHUNKS, ...extra]
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const always = AGENCY_TRAINING_CHUNKS.find((c) => c.tags.includes("hard-rules") && c.tags.includes("style"));
  const out = ranked.map((r) => r.chunk.content);
  if (always && !out.includes(always.content)) out.unshift(always.content);
  return out.slice(0, limit);
}

export { personaLooksTrans, AGENCY_TRAINING_CHUNKS };
