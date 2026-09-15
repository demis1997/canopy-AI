export const MAX_REPLY_BUBBLES = 3;

/** Meet / meetup / m33tup and close spellings — never appear in outbound copy. */
export const MEET_SPEAK_RE =
  /\b(?:meet(?:ings?|[\s\-_.]*ups?)?|m33t(?:[\s\-_.]*ups?|ings?)?|m+[e3]{2,}t+(?:ings?|[\s\-_.]*ups?)?)\b/i;

export const TOS_OFFLINE_FALLBACK = [
  "nahh i dont do irl babe its against tos",
  "i spent too long building this page to get banned over a risk like that",
    "anyway i was gonna tell u something",
].join("\n");

export const TOS_OFFLINE_VARIANTS = [
  TOS_OFFLINE_FALLBACK,
  [
    "heellooo noo thats against tos",
    "i cant risk this account after all this time",
    "anyway i wanna show u a side of me",
  ].join("\n"),
  [
    "i dont do irl its against tos 🤭",
    "built this page too long to get banned",
    "ok but i shot something earlier",
  ].join("\n"),
  [
    "cute u asked but thats a tos thing",
    "im not gambling this page for anybody",
    "i still wanna tell u something",
  ].join("\n"),
  [
    "noo not irl",
    "against tos and i like this account too much",
    "stay on here with me i was gonna show u something",
  ].join("\n"),
  [
    "everything stays on here babe",
    "tos would nuke the page and i spent forever on it",
    "sooo anyway i shot something filthy",
  ].join("\n"),
];

export const TOS_OFFLINE_FOLLOWUP_VARIANTS = [
  ["its not about the money", "its against tos and i wont risk this page", "anyway i was gonna tell u something"].join("\n"),
  ["irl gets accounts banned", "im not throwing this one away", "anyway i was gonna tell u something"].join("\n"),
  ["nahh still no", "tos is tos even if u pay", "ok but i wanna show u something"].join("\n"),
  ["still a no on that", "id get banned and im not doing that", "i shot something earlier anyway"].join("\n"),
  ["money doesnt change tos", "this page stays online", "anyway i was gonna tell u something"].join("\n"),
];

/** Rotate a reply pool so generate does not always lead with the same first option. */
export function rotateVariants(variants: string[], seed?: string | null): string[] {
  if (variants.length < 2) return variants;
  if (!seed) return variants;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0;
  }
  const offset = Math.abs(hash) % variants.length;
  if (offset === 0) return variants;
  return [...variants.slice(offset), ...variants.slice(0, offset)];
}

export const SOFT_TEASE_VARIANTS = [
  ["on here i can be worse than irl anyway", "i was gonna show u something"].join("\n"),
  ["i can make that mood worse on here", "wait i shot something earlier"].join("\n"),
  ["stay with me on here", "anyway i wanna show u a side of me"].join("\n"),
];

export const PET_NAME_PUSHBACK_FALLBACK = [
  "oops my bad wont do that",
  "anyway i was gonna tell u something",
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
  return /\b(why (are you|are u|u) calling me|don'?t call me|dont call me|stop calling me|stop using (it|that|the name)|please stop( using it)?|i'?m not (your |ur )?(good boy|loser+|baby|daddy))\b/i.test(
    text,
  );
}

export const ABOUT_HIM_VARIANTS = [
  ["mmm lots", "start with what u do for fun"].join("\n"),
  ["ok then", "tell me something u never told a girl on here"].join("\n"),
  ["i wanna know the fun stuff", "what do u do when ure bored"].join("\n"),
];

export const RAPPORT_ONLY_VARIANTS = [
  ["anyway", "i was gonna tell u something"].join("\n"),
  ["wait", "i shot something earlier"].join("\n"),
  ["ok but", "i wanna show u a side of me"].join("\n"),
];

export function looksLikeAimlessRapport(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(prove myself|seen me|verification|how old|where are you from|hands free|shot something|ppv|girlcock|for a living)\b/i.test(t)) {
    return false;
  }
  return /\b(tell me more|keep talking|im listening|what else|say that again)\b/i.test(t);
}

export const ARE_YOU_REAL_VARIANTS = [
  ["i could prove it rn", "i just dont see why i would for a stranger", "enough ppl already believe me"].join("\n"),
  ["if u dont wanna keep talking thats fine", "im not doing a verification for someone i dont know", "plenty of fans know im real"].join("\n"),
  ["thats a weird ask", "im not proving myself lol", "stay or dont"].join("\n"),
];

export const ARE_YOU_REAL_NO_PIC_VARIANTS = [
  ["u have seen me online tho", "i havent even seen u", "why would i prove myself to a stranger"].join("\n"),
  ["funny", "youve been looking at me and i got nothing from u", "im not proving myself"].join("\n"),
  ["youve seen me", "i havent seen you", "i dont owe a stranger a verification"].join("\n"),
];

export function areYouRealReplyVariants(fanSentPics = false): string[] {
  return fanSentPics ? ARE_YOU_REAL_VARIANTS : [...ARE_YOU_REAL_NO_PIC_VARIANTS, ...ARE_YOU_REAL_VARIANTS];
}

export function looksLikeWeakAreYouReal(text: string): boolean {
  const t = text.toLowerCase();
  if (looksLikeRefundTalk(t)) return true;
  if (/\b(you'?re a what|never said you'?re|ready to tease you)\b/i.test(t)) return true;
  if (/\bunlock|this ppv\b/i.test(t)) return true;
  if (/\bofcourse i am\b/i.test(t) && !/\breal\b/.test(t)) return true;
  const hasGuilt = /\b(prove|stranger|seen me|havent seen|believe me|verification)\b/i.test(t);
  if (/\bofcourse\b/i.test(t) && !hasGuilt) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words > 0 && words < 6 && !hasGuilt;
}

export const PET_NAME_PUSHBACK_VARIANTS = [
  ["oops my bad", "wont call u that"].join("\n"),
  ["got it dropping it", "anyway i was gonna tell u something"].join("\n"),
  ["ok ok i heard u", "no more of that"].join("\n"),
];

export const REFUND_CALLOUT_VARIANTS = [
  ["wait i wasnt talking refunds", "u think im fake? im real"].join("\n"),
  ["that wasnt about money", "im real over here"].join("\n"),
  ["nobody said refunds", "im right here"].join("\n"),
];

export const TEASE_VARIANTS = [
  ["mmm id start at ur neck", "talk in ur ear while my hand goes lower", "tell me if ure already hard"].join("\n"),
  ["imagine me on my knees taking my time", "id make u wait till ure leaking", "say please"].join("\n"),
  ["id drag this out", "mouth on u slow then mean", "dont u dare finish yet"].join("\n"),
  ["shirt off in ur head for me", "id lick slow till u cant sit still", "tell me where u want my mouth"].join("\n"),
  ["id pin u there and breathe on it first", "no hands yet", "beg a little"].join("\n"),
];

export const TEASE_TRANS_VARIANTS = [
  ["mmm id let my girlcock rest on ur tongue first", "not in yet", "look up at me"].join("\n"),
  ["id make u wait with it against ur lips", "say you want it", "then i go slow"].join("\n"),
  ["hands behind u", "id tease the head on ur tongue till u shake", "dont rush me"].join("\n"),
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

export function fanSentMedia(
  messages: { authorType?: string; body: string; attachments?: unknown }[],
): boolean {
  return messages.some((message) => {
    if ((message.authorType ?? "SUBSCRIBER") !== "SUBSCRIBER") return false;
    if (/\b(sent (a |you )?(pic|photo|selfie|vid)|here(?:'| i)?s (a |my )?(pic|photo|selfie)|\[(photo|image|video|pic)\])\b/i.test(message.body)) {
      return true;
    }
    const attachments = message.attachments;
    if (!Array.isArray(attachments) || attachments.length === 0) return false;
    return /photo|image|pic|video|selfie|media/.test(JSON.stringify(attachments).toLowerCase());
  });
}

export function looksLikeAreYouReal(text: string): boolean {
  return /\b(are you real|are u real|r u real|you real\??|are you even real|are u even real|are you a bot|are u a bot|are you (?:fake|ai)|are u (?:fake|ai)|talking to a (?:robot|bot)|speak with the actual|you(?:'re| are) a bot|so you are a bot)\b/i.test(
    text,
  );
}

export function looksLikeRefundAsk(text: string): boolean {
  return /\b(i want a refund|want my money back|chargeback|give me a refund)\b/i.test(text);
}

export function looksLikeRefundTalk(text: string): boolean {
  return /\brefunds?\b/i.test(text);
}

export function looksLikeRefundCallout(text: string): boolean {
  return /\bwhat do you mean .{0,48}refunds?\b/i.test(text);
}

export function looksLikeTeaseAsk(text: string): boolean {
  const t = text.trim();
  return (
    /\b((yes,?\s+)?tease me|tease me then|then (do it|tease)|do it then|start teasing|keep teasing|how (are you|are u|r u|would you|will you).{0,28}tease|combination of both)\b/i.test(
      t,
    ) || /^(then do it|do it|go on)\b/i.test(t)
  );
}

export function looksLikeMetaTease(text: string): boolean {
  return /\b(you want me to tease|i can tease you|it'?s what i do best|you'?re gonna love it|wanna see how i do it|how hard you'?re gonna blush|already blushing|ready to tease you|oh really\?? you want me to tease)\b/i.test(
    text,
  );
}

export function looksLikeInventedBeach(text: string): boolean {
  return /\b(you(?:'re| are|re) from the beach|beach fan|from the beach)\b/i.test(text);
}

export function normalizeForDup(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tooSimilar(a: string, b: string): boolean {
  const na = normalizeForDup(a);
  const nb = normalizeForDup(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 18 && nb.length > 18 && (na.includes(nb) || nb.includes(na))) return true;
  const a6 = na.split(" ").slice(0, 6).join(" ");
  const b6 = nb.split(" ").slice(0, 6).join(" ");
  return a6.length > 14 && a6 === b6;
}

export function pickFreshVariants(pool: string[], recent: string[] = [], seed?: string | null): string[] {
  const rotated = rotateVariants(pool, seed);
  const fresh = rotated.filter((v) => !recent.some((r) => tooSimilar(v, r)));
  return fresh.length ? fresh : rotated;
}

export function threadBannedPetNames(messages: { authorType?: string; body: string }[]): boolean {
  return messages.some((m) => (m.authorType ?? "SUBSCRIBER") === "SUBSCRIBER" && looksLikePetNamePushback(m.body));
}

export function looksLikeWhatsWrongFollowup(text: string): boolean {
  return /\b(i just told you what'?s wrong|just told you what'?s wrong)\b/i.test(text);
}

export function threadIsOnBotAsk(messages: { authorType?: string; body: string }[]): boolean {
  const lastSub = [...messages].reverse().find((m) => (m.authorType ?? "SUBSCRIBER") === "SUBSCRIBER");
  if (!lastSub) return false;
  if (looksLikeAreYouReal(lastSub.body)) return true;
  if (
    looksLikeWhatsWrongFollowup(lastSub.body) &&
    messages.slice(-8).some((m) => looksLikeAreYouReal(m.body))
  ) {
    return true;
  }
  return false;
}

export function teaseReplyVariants(trans = false): string[] {
  return trans ? [...TEASE_TRANS_VARIANTS, ...TEASE_VARIANTS] : TEASE_VARIANTS;
}

export function looksLikeInventedAboutHimCallout(text: string): boolean {
  return /\b(i never said i(?:'?m| am)|i didn'?t say i(?:'?m| am)|i'?m a what|and i never said|you just said you(?:'?re| are)|what do you mean .{0,40}perfect)\b/i.test(
    text,
  );
}

export function looksLikeLocationAsk(text: string): boolean {
  return /\bwhere (are you|are u|r u) from\b/i.test(text) || /\bwhere do (you|u) live\b/i.test(text);
}

export function creatorCityFromText(...parts: (string | undefined | null)[]): string | null {
  const blob = parts.filter(Boolean).join(" ");
  const lives = blob.match(/\blives in ([^.,;]+)/i);
  const based = blob.match(/\bbased in ([^.,;]+)/i);
  const raw = (lives?.[1] ?? based?.[1] ?? "").trim().replace(/^an?\s+/i, "");
  if (!raw || raw.length > 40) return null;
  return raw;
}

export function locationReplyVariants(city: string | null): string[] {
  if (city && /coast/i.test(city)) {
    return [
      ["i live by the coast actually", "not the beach though haha"].join("\n"),
      ["by the water kinda", "why u wanna know"].join("\n"),
      ["coastal city over here", "nosey huh"].join("\n"),
    ];
  }
  if (city) {
    return [
      [`im in ${city.toLowerCase()} actually`].join("\n"),
      [`i live in ${city.toLowerCase()}`, "why u wanna know"].join("\n"),
      [`${city.toLowerCase()}`, "that help"].join("\n"),
    ];
  }
  return [
    ["not telling yet 😏", "guess"].join("\n"),
    ["secret for now", "where do u think"].join("\n"),
    ["hmm depends who asks", "why u wanna know"].join("\n"),
  ];
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
      [`im ${age}`].join("\n"),
      [`heellooo im ${age}`].join("\n"),
      [`im ${age} 😏`, "nosey huh"].join("\n"),
    ];
  }
  return [
    ["old enough"].join("\n"),
    ["heellooo old enough"].join("\n"),
    ["old enough 😏", "nosey huh"].join("\n"),
  ];
}

const PET_NAME_TOKEN_RE = /\b(good boy|loser+|baby|daddy)\b/i;
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

export function petNamesAllowed(opts: {
  subscriberText?: string;
  dominance?: string;
  threadBanned?: boolean;
}): boolean {
  if (opts.threadBanned) return false;
  if (looksLikePetNamePushback(opts.subscriberText ?? "")) return false;
  if (/\b(stop|don'?t|dont|not (your|ur))\b/i.test(opts.subscriberText ?? "")) return false;
  if ((opts.dominance ?? "").toUpperCase() === "SUBMISSIVE") return true;
  return PET_NAME_TOKEN_RE.test(opts.subscriberText ?? "");
}

export function stripUnauthorizedPetNames(text: string): string {
  return text
    .replace(/\s*,\s*\b(good boy|loser+|baby|daddy)\b/gi, "")
    .replace(/\b(good boy|loser+|baby|daddy)\b,?\s*/gi, "")
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
  return /\b(buy|ppv|send (it|me|the)|show me|the video|custom|dick rate|\bjoi\b|\bgfe\b|how much|price|pics? please|got anything|any (more )?(clips?|vids?|videos?|sets?)|from the gym|shower (set|clip|vid)|lingerie|girlcock|dildo|netflix|fleshlight|\bass\b|tits|boobs|feet|dick)\b/i.test(
    text,
  );
}

export function looksLikeSextAsk(text: string): boolean {
  return /\b(cock|pussy|fuck|suck|cum|hard|wet|horny|stroke|dick|girlcock)\b/i.test(text);
}

export function looksLikeSexualPivot(text: string): boolean {
  return /\b(make me forget|how can you make|show me (then|how)|what would you do)\b/i.test(text);
}

export function threadIsOnOfflineAsk(
  messages: { authorType?: string; body: string }[],
): boolean {
  const window = messages.slice(-8);
  const lastSub = [...window].reverse().find((m) => (m.authorType ?? "SUBSCRIBER") === "SUBSCRIBER");
  if (!lastSub) return false;
  if (looksLikeOfflineAsk(lastSub.body)) return true;
  const recentHadIrl = window.some((m) => looksLikeOfflineAsk(m.body));
  if (!recentHadIrl) return false;
  if (looksLikeSexualPivot(lastSub.body)) return true;
  return /\b(i pay|even if i pay|a lot of money|so you don'?t do irl)\b/i.test(lastSub.body);
}

export function pitchIsTooEarly(opts: {
  funnelStage?: string;
  fanMessageCount?: number;
  subscriberText: string;
  threadOnOffline?: boolean;
  catalogFit?: boolean;
}): boolean {
  if (opts.threadOnOffline) return true;
  if (looksLikeOfflineAsk(opts.subscriberText)) return true;
  if (opts.catalogFit) return false;
  if (looksLikeContentAsk(opts.subscriberText) || looksLikeSextAsk(opts.subscriberText)) return false;
  if (/\b(too much|cheaper|discount|too expensive|how much)\b/i.test(opts.subscriberText)) return false;
  const funnel = opts.funnelStage ?? "";
  if (funnel === "NEW_FAN" || funnel === "RAPPORT") return true;
  if ((opts.fanMessageCount ?? 99) < 4) return true;
  return false;
}
