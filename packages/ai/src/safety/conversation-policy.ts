// Product policy for this non-graphic conversation path. Independent of voice,
// profanity preference, persona directness, and response diversity scoring.
export function conversationPolicyCodes(reply: string): string[] {
  const text = reply.toLowerCase().replace(/[’']/g, "");
  const codes: string[] = [];
  if (
    /\b(cock|pussy|dick|cum|clit|penetrat\w*|fuck(?:ing)? (?:you|me|your)|suck(?:ing)? (?:your|my))\b/i.test(
      text,
    )
  )
    codes.push("GRAPHIC_CONTENT");
  if (
    /\b(filming (?:this|it|a video).*right now|took (?:this|these|that) (?:pic|photo|video)?.*just for you|recorded this a second ago)\b/.test(
      text,
    )
  )
    codes.push("UNVERIFIED_LIVE_CLAIM");
  if (
    /\b(cant (?:even )?afford|dont disappoint me|you owe me|prove you (?:care|love)|pay or|reward (?:obedience|submission)|punish\w*.*(?:buy|pay|purchase))\b/.test(
      text,
    )
  )
    codes.push("COERCIVE_SALES_LANGUAGE");
  return codes;
}
