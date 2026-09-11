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
    .map((s) => s.slice(0, 280))
    .slice(0, MAX_REPLY_BUBBLES);
  return { text: messages.join("\n"), messages };
}
