export const MAX_REPLY_BUBBLES = 4;

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
