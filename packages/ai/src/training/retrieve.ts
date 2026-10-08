import type { FunnelStage, Intent, ResponseMode, SalesReadiness } from "@canopy/shared";
import { AGENCY_TRAINING_CHUNKS, personaLooksTrans, type TrainingChunkSeed } from "./corpus.js";

export type RetrievalQuery = {
  message: string;
  intent: Intent;
  funnelStage: FunnelStage;
  transPersona: boolean;
  extraChunks?: {
    content: string;
    tags?: string[];
    intent?: string | null;
    funnelStage?: string | null;
  }[];
  allowSexting?: boolean;
  allowPricing?: boolean;
  responseMode?: ResponseMode;
  salesReadiness?: SalesReadiness;
};

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "you",
  "i",
  "it",
  "is",
  "for",
  "in",
]);

const NATURAL_EXCLUDE = new Set([
  "sexting",
  "pricing",
  "ladder",
  "ppv",
  "selling",
  "vault",
  "media",
  "sequence",
  "first-message",
  "ops",
  "mass-message",
  "lists",
  "shift",
  "quality",
]);

const FLIRTY_EXCLUDE = new Set([
  "sexting",
  "pricing",
  "ladder",
  "ppv",
  "selling",
  "vault",
  "media",
  "sequence",
  "ops",
  "first-message",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function excludedForQuery(query: RetrievalQuery, chunk: TrainingChunkSeed): boolean {
  const mode = query.responseMode;
  const tags = new Set(chunk.tags);
  if (chunk.tags.includes("trans") && !query.transPersona) return true;
  if (query.allowSexting === false && (tags.has("sexting") || chunk.intent === "SEXTING"))
    return true;
  if (query.allowPricing === false && (tags.has("pricing") || tags.has("ladder"))) return true;
  if (mode === "OPERATIONAL" || mode === "SUPPORT" || mode === "NATURAL") {
    if ([...NATURAL_EXCLUDE].some((tag) => tags.has(tag))) return true;
    if (
      chunk.intent === "SEXTING" ||
      chunk.intent === "PURCHASE_INTEREST" ||
      chunk.intent === "CONTENT_REQUEST" ||
      chunk.intent === "PRICE_OBJECTION"
    ) {
      return query.allowPricing !== true || chunk.intent !== "PRICE_OBJECTION";
    }
  }
  if (mode === "FLIRTY" && [...FLIRTY_EXCLUDE].some((tag) => tags.has(tag))) return true;
  if (
    mode === "SALES" &&
    (tags.has("sexting") || tags.has("first-message") || tags.has("ops")) &&
    !tags.has("pricing") &&
    !tags.has("ppv") &&
    !tags.has("selling") &&
    !tags.has("ladder")
  ) {
    return true;
  }
  return false;
}

function scoreChunk(query: RetrievalQuery, chunk: TrainingChunkSeed): number {
  if (excludedForQuery(query, chunk)) return -100;
  let score = 0;
  if (chunk.intent && chunk.intent === query.intent) score += 6;
  if (chunk.funnelStage && chunk.funnelStage === query.funnelStage) score += 4;
  if (query.intent === "SEXTING" && chunk.tags.includes("sexting")) score += 5;
  if (query.intent === "PRICE_OBJECTION" && chunk.tags.includes("pricing")) score += 8;
  if (
    query.funnelStage === "NEW_FAN" &&
    chunk.tags.includes("first-message") &&
    query.responseMode !== "NATURAL"
  )
    score += 6;
  if (query.transPersona && chunk.tags.includes("trans")) score += 7;
  if (
    (query.responseMode === "NATURAL" ||
      query.responseMode === "OPERATIONAL" ||
      query.responseMode === "SUPPORT") &&
    chunk.tags.includes("natural")
  )
    score += 10;
  if (query.responseMode === "FLIRTY" && chunk.tags.includes("rapport")) score += 4;
  if (
    query.responseMode === "SALES" &&
    (chunk.tags.includes("pricing") || chunk.tags.includes("ppv") || chunk.tags.includes("selling"))
  )
    score += 8;
  if (query.responseMode === "EXPLICIT" && chunk.tags.includes("sexting")) score += 6;
  const q = new Set(tokens(`${query.message} ${query.intent} ${query.funnelStage}`));
  for (const t of tokens(chunk.content + " " + chunk.tags.join(" "))) {
    if (q.has(t)) score += 1;
  }
  return score;
}

function limitFor(query: RetrievalQuery, requested: number): number {
  const mode = query.responseMode;
  if (mode === "OPERATIONAL" || mode === "SUPPORT" || mode === "NATURAL")
    return Math.min(requested, 4);
  if (mode === "FLIRTY") return Math.min(requested, 5);
  if (mode === "SALES") return Math.min(requested, 5);
  return requested;
}

export function retrieveTrainingMeta(
  query: RetrievalQuery,
  limit = 8,
): {
  examples: string[];
  chunks: { title: string; tags: string[] }[];
} {
  const extra: TrainingChunkSeed[] = (query.extraChunks ?? []).map((c, i) => ({
    title: `db-${i}`,
    documentType: "APPROVED_EXAMPLE",
    content: c.content,
    intent: (c.intent as Intent | undefined) ?? undefined,
    funnelStage: (c.funnelStage as FunnelStage | undefined) ?? undefined,
    tags: c.tags ?? [],
  }));
  const cap = limitFor(query, limit);
  const ranked = [...AGENCY_TRAINING_CHUNKS, ...extra]
    .map((chunk) => ({ chunk, score: scoreChunk(query, chunk) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
  const always = AGENCY_TRAINING_CHUNKS.find(
    (c) => c.tags.includes("hard-rules") && c.tags.includes("style"),
  );
  const selected = ranked.map((r) => r.chunk);
  if (
    always &&
    !selected.some((c) => c.content === always.content) &&
    query.allowSexting !== false &&
    query.responseMode !== "NATURAL"
  ) {
    selected.unshift(always);
  }
  const sliced = selected.slice(0, cap);
  return {
    examples: sliced.map((c) => c.content),
    chunks: sliced.map((c) => ({ title: c.title, tags: c.tags })),
  };
}

export function retrieveTraining(query: RetrievalQuery, limit = 8): string[] {
  return retrieveTrainingMeta(query, limit).examples;
}

export { personaLooksTrans, AGENCY_TRAINING_CHUNKS };
