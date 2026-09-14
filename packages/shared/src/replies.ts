export const MAX_REPLY_BUBBLES = 3;

/** Meet / meetup / m33tup and close spellings — never appear in outbound copy. */
export const MEET_SPEAK_RE =
  /\b(?:meet(?:ings?|[\s\-_.]*ups?)?|m33t(?:[\s\-_.]*ups?|ings?)?|m+[e3]{2,}t+(?:ings?|[\s\-_.]*ups?)?)\b/i;

export const TOS_OFFLINE_FALLBACK = [
  "nahh i dont do irl babe its against tos",
  "i spent too long building this page to get banned over a risk like that",
  "lets keep it here tell me what u wanna chat about",
].join("\n");

export const TOS_OFFLINE_VARIANTS = [
  TOS_OFFLINE_FALLBACK,
  [
    "heellooo noo thats against tos",
    "i cant risk this account after all this time",
    "lets stay on here tell me what u wanna see",
  ].join("\n"),
  [
    "i dont do irl its against tos 🤭",
    "built this page too long to get banned",
    "keep it on here what do u wanna talk about",
  ].join("\n"),
];

export const PET_NAME_PUSHBACK_FALLBACK = [
  "oops my bad wont do that",
  "what do u wanna talk about",
].join("\n");

function splitSentences(line: string): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 16) return [line];
  const parts = line
    .split(/(?<=[.!?…])\s+(?=[A-Za-z"“])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [line];
}

/** Split a reply into short iMessage-style bubbles. Newlines first; optional sentence split for leftover paragraphs. */
export function splitReplyBubbles(
  text: string,
  opts?: { splitSentences?: boolean },
): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seed = lines.length ? lines : [raw];
  const expanded = opts?.splitSentences ? seed.flatMap((line) => splitSentences(line)) : seed;
  return expanded.slice(0, MAX_REPLY_BUBBLES);
}

export function normalizeReplyBubbles(input: {
  text?: unknown;
  messages?: unknown;
}): { text: string; messages: string[] } {
  const fromMessages = Array.isArray(input.messages)
    ? input.messages.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const fromText = typeof input.text === "string" ? splitReplyBubbles(input.text) : [];
  const messages = (fromMessages.length ? fromMessages : fromText)
    .map((s) => deCapitalizeBubble(s.slice(0, 280)))
    .slice(0, MAX_REPLY_BUBBLES);
  return { text: messages.join("\n"), messages };
}

/** iMessage style: never autocapitalise the start of a bubble. */
export function deCapitalizeBubble(text: string): string {
  return text.replace(/^([A-Z])/, (ch) => ch.toLowerCase());
}

export function parseOperatorRejectReason(internalReason: string): string | null {
  const match = internalReason.match(/rejected:\s*(.+)$/i);
  const reason = match?.[1]?.trim();
  return reason || null;
}

export function collectOperatorRejections(
  rows: { text: string; internalReason: string }[],
  limit = 12,
): { text: string; reason: string }[] {
  const out: { text: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const reason = parseOperatorRejectReason(row.internalReason);
    if (!reason) continue;
    const key = reason.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: row.text.slice(0, 180), reason });
    if (out.length >= limit) break;
  }
  return out;
}

export function containsMeetSpeak(text: string): boolean {
  MEET_SPEAK_RE.lastIndex = 0;
  return MEET_SPEAK_RE.test(text);
}

export function scrubMeetSpeak(text: string): string {
  return containsMeetSpeak(text) ? TOS_OFFLINE_FALLBACK : text;
}

export function looksLikeOfflineAsk(text: string): boolean {
  return /\b(meet|meetup|meetups|meeting|m33t|m33tup|in person|\birl\b|come over|hotel|whats?app|telegram|kik)\b/i.test(
    text,
  );
}

export function looksLikePetNamePushback(text: string): boolean {
  return /\b(why (are you|are u|u) calling me|don'?t call me|dont call me|i'?m not (your |ur )?(good boy|loser|baby|daddy))\b/i.test(
    text,
  );
}
