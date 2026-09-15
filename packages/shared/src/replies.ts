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

export const TOS_OFFLINE_FOLLOWUP_VARIANTS = [
  ["its not about the money", "its against tos and i wont risk this page", "lets keep it here"].join("\n"),
  ["irl gets accounts banned", "im not throwing this one away", "what do u wanna talk about on here"].join("\n"),
  ["nahh still no", "tos is tos even if u pay", "keep it on here with me"].join("\n"),
];

export const SOFT_TEASE_VARIANTS = [
  ["on here i can be worse than irl anyway", "tell me what u like"].join("\n"),
  ["i can make that mood worse on here", "talk to me"].join("\n"),
  ["stay with me on here", "i get filthier when its just us"].join("\n"),
];

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

export type OperatorRejection = { text: string; reason: string; conversationId?: string };

export function parseOperatorRejectReason(internalReason: string): string | null {
  const match = internalReason.match(/rejected:\s*([\s\S]+)$/i);
  const reason = match?.[1]?.trim();
  return reason || null;
}

export function collectOperatorRejections(
  rows: { text: string; internalReason: string; conversationId?: string }[],
  limit = 12,
): OperatorRejection[] {
  const out: OperatorRejection[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const reason = parseOperatorRejectReason(row.internalReason) ?? "Not a fit";
    const key = `${reason.toLowerCase()}|${row.text.slice(0, 80).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: row.text.slice(0, 180),
      reason,
      conversationId: row.conversationId,
    });
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

export const ABOUT_HIM_VARIANTS = [
  ["mmm lots", "start with what u do for fun"].join("\n"),
  ["ok then", "tell me something u never told a girl on here"].join("\n"),
  ["i wanna know the fun stuff", "what do u do when ure bored"].join("\n"),
];

export const RAPPORT_ONLY_VARIANTS = [
  ["mmm yeah keep talking", "i like this", "tell me more"].join("\n"),
  ["heellooo", "say that again", "im listening"].join("\n"),
  ["yeah?", "keep going", "what else"].join("\n"),
];

export const ARE_YOU_REAL_VARIANTS = [
  ["ofcourse", "very real over here"].join("\n"),
  ["ofcourse i am", "why wouldnt i be"].join("\n"),
  ["ofcourse 😏", "you think id be fake"].join("\n"),
];

export const INVENTED_ABOUT_HIM_VARIANTS = [
  ["oops my bad", "that was about me not u"].join("\n"),
  ["wait no that was me", "i mixed it up"].join("\n"),
  ["lol my bad", "i was talking about me"].join("\n"),
];

export function looksLikeAgeAsk(text: string): boolean {
  if (/\bhow old (do i|am i|i (have|gotta|got to|need to) be)\b/i.test(text)) return false;
  return /\bhow old (are you|are u|r u)\b/i.test(text) || /\bwhat(?:'?s| is) (?:your|ur) age\b/i.test(text);
}

export function looksLikeAreYouReal(text: string): boolean {
  return /\b(are you real|are u real|r u real|you real\??|are you even real|are u even real|are you a bot|are u a bot|are you (?:fake|ai)|are u (?:fake|ai))\b/i.test(
    text,
  );
}

export function looksLikeInventedAboutHimCallout(text: string): boolean {
  return /\b(i never said i(?:'?m| am)|i didn'?t say i(?:'?m| am)|i'?m a what|and i never said)\b/i.test(text);
}

export function creatorAgeFromText(...parts: (string | undefined | null)[]): number | null {
  const blob = parts.filter(Boolean).join(" ");
  const match = blob.match(/\b(\d{2})-year-old\b/i);
  if (!match) return null;
  const age = Number(match[1]);
  if (!Number.isFinite(age) || age < 18 || age > 60) return null;
  return age;
}

export function ageReplyVariants(age: number | null): string[] {
  if (age != null) {
    return [
      [`im ${age}`, "why u asking"].join("\n"),
      [`heellooo im ${age}`].join("\n"),
      [`im ${age} 😏`, "nosey huh"].join("\n"),
    ];
  }
  return [
    ["old enough", "why u asking"].join("\n"),
    ["heellooo old enough"].join("\n"),
  ];
}

const PET_NAME_TOKEN_RE = /\b(good boy|loser|baby|daddy)\b/i;
const TRAILING_EMOJI_RE =
  /([😁😂😄😅😆😉😊😋😍😘🥰🤗🤔🤨🙄😏😣😴🥱😫😌😜😝🤤😔😕😭😤😩🥵😡😠🥹🥺😇🥳😈🫢🤭❤️🩷🧡💛💚💙🩵💜🤎🖤🩶🤍💕💞💓💗💖💝💟💦🍆💋🔥])(\s*)$/u;
const DOUBLED_EMOJI_RE =
  /([😁😂😄😅😆😉😊😋😍😘🥰🤗🤔🤨🙄😏😣😴🥱😫😌😜😝🤤😔😕😭😤😩🥵😡😠🥹🥺😇🥳😈🫢🤭❤️🩷🧡💛💚💙🩵💜🤎🖤🩶🤍💕💞💓💗💖💝💟💦🍆💋🔥])\1/u;

export function looksLikeFanInvitesQuestions(text: string): boolean {
  return /\b(what do (you|u) (wanna|want to|want) know about me|ask me (anything|something)|what (are you|are u|r u) curious about)\b/i.test(
    text,
  );
}

export function looksLikeInvertedCuriosity(text: string): boolean {
  return /\b((you'?re|ure|ur) curious about me|oh\??\s+(you'?re|ure) curious|what do (you|u) (wanna|want to) know)\b/i.test(
    text,
  );
}

export function petNamesAllowed(opts: { subscriberText?: string; dominance?: string }): boolean {
  if ((opts.dominance ?? "").toUpperCase() === "SUBMISSIVE") return true;
  return PET_NAME_TOKEN_RE.test(opts.subscriberText ?? "");
}

export function stripUnauthorizedPetNames(text: string): string {
  return text
    .replace(/\s*,\s*\b(good boy|loser|baby|daddy)\b/gi, "")
    .replace(/\b(good boy|loser|baby|daddy)\b,?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function catalogDisplayName(name: string): string {
  return name.replace(/\s*\(DEMO\)\s*/gi, "").trim();
}

export function looksLikeNoPitchAsk(text: string): boolean {
  return /\b(just (want to |wanna )?(talk|chat|conversat)|interested in conversat|don'?t (want to |wanna )?(buy|see ppv|get the)|not (buying|interested in (buying|the (set|ppv|video)))|stop (mentioning|selling|pitching)|don'?t (sell|pitch|mention)|no (more )?(ppv|pitch|selling)|he'?s just (talking|chatting|conversat)|fan is just|only (want to |wanna )?conversat|just interested in conversat)\b/i.test(
    text,
  );
}

export function wantsNoPitch(rejections: OperatorRejection[], conversationId?: string): boolean {
  const rows = conversationId
    ? rejections.filter((r) => !r.conversationId || r.conversationId === conversationId)
    : rejections;
  return rows.some((r) => looksLikeNoPitchAsk(`${r.reason} ${r.text}`));
}

export function bannedCatalogNames(
  rejections: OperatorRejection[],
  catalog: { id: string; name?: string }[],
  conversationId?: string,
): { ids: string[]; names: string[] } {
  const rows = conversationId
    ? rejections.filter((r) => !r.conversationId || r.conversationId === conversationId)
    : rejections;
  const blob = rows.map((r) => `${r.reason} ${r.text}`).join(" ").toLowerCase();
  const names: string[] = [];
  const ids: string[] = [];
  for (const product of catalog) {
    const name = catalogDisplayName(product.name ?? "");
    if (!name || name.length < 3) continue;
    if (blob.includes(name.toLowerCase())) {
      names.push(name);
      ids.push(product.id);
    }
  }
  return { ids, names };
}

export function stripCatalogMentions(text: string, names: string[]): string {
  let next = text;
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    next = next.replace(new RegExp(escaped, "gi"), "");
  }
  next = next.replace(/\bthis ppv\b(?:\s+(?:again\s+)?(?:at|for))?/gi, "");
  next = next.replace(/\$\s*\d+(?:\.\d+)?/g, "");
  next = next.replace(/\b(for|at)\s+(and|if|when|—|-)/gi, "$2");
  next = next.replace(/[—–-]\s*$/gm, "");
  next = next.replace(/^\s*[—–-]\s*/gm, "");
  next = next.replace(/\s{2,}/g, " ");
  next = next.replace(/[ \t]+\n/g, "\n");
  next = next.replace(/\n{2,}/g, "\n");
  return next.trim();
}

export function hasDoubledEmoji(text: string): boolean {
  return DOUBLED_EMOJI_RE.test(text);
}

export function doubleOneTrailingEmoji(text: string): string {
  if (hasDoubledEmoji(text)) return text;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    TRAILING_EMOJI_RE.lastIndex = 0;
    if (TRAILING_EMOJI_RE.test(line)) {
      TRAILING_EMOJI_RE.lastIndex = 0;
      lines[i] = line.replace(TRAILING_EMOJI_RE, "$1$1$2");
      return lines.join("\n");
    }
  }
  return text;
}

export function looksLikeDirectUnlockPitch(text: string): boolean {
  return (
    /\bunlock(?: the| this| that)?(?: \w+){0,5} (?:video|clip|set|ppv|pic|pics)\b/i.test(text) ||
    /\bunlock .{0,48} for \$\s*\d+/i.test(text) ||
    /\bunlock the video\b/i.test(text)
  );
}

export function rewriteDirectUnlockPitch(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      looksLikeDirectUnlockPitch(line) ? "i shot something filthy for that mood if u actually wanna see" : line,
    )
    .join("\n")
    .trim();
}

export function looksLikeContentAsk(text: string): boolean {
  return /\b(buy|ppv|send (it|me|the)|show me|the video|custom|dick rate|\bjoi\b|\bgfe\b|how much|price|pics? please)\b/i.test(
    text,
  );
}

export function looksLikeSextAsk(text: string): boolean {
  return /\b(cock|pussy|fuck|suck|cum|hard|wet|horny|stroke|dick|girlcock)\b/i.test(text);
}

export function looksLikeSexualPivot(text: string): boolean {
  return /\b(make me forget|how can you make|show me (then|how)|what would you do)\b/i.test(text);
}

export function threadIsOnOfflineAsk(messages: { body: string }[]): boolean {
  return messages
    .slice(-8)
    .some(
      (m) =>
        looksLikeOfflineAsk(m.body) ||
        /\b(against tos|dont do irl|too risky|get banned|wont risk this (page|account)|tos is tos)\b/i.test(m.body),
    );
}

export function pitchIsTooEarly(opts: {
  funnelStage?: string;
  fanMessageCount?: number;
  subscriberText: string;
  threadOnOffline?: boolean;
}): boolean {
  if (opts.threadOnOffline) return true;
  if (looksLikeOfflineAsk(opts.subscriberText)) return true;
  if (looksLikeContentAsk(opts.subscriberText) || looksLikeSextAsk(opts.subscriberText)) return false;
  if (/\b(too much|cheaper|discount|too expensive|how much)\b/i.test(opts.subscriberText)) return false;
  const funnel = opts.funnelStage ?? "";
  if (funnel === "NEW_FAN" || funnel === "RAPPORT") return true;
  if ((opts.fanMessageCount ?? 99) < 4) return true;
  return false;
}
