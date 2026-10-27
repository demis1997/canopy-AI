// Keep complete recent turns within an explicit budget. Pending fan turns are
// supplied separately, so trimming history never silently changes the requested turn.
export function selectConversationContext(
  messages: { authorType: string; body: string }[],
  maxChars = 16000,
) {
  const selected: typeof messages = [];
  let chars = 0;
  for (const message of messages
    .filter((m) => ["SUBSCRIBER", "CREATOR", "CHATTER"].includes(m.authorType))
    .slice(-32)
    .reverse()) {
    if (chars + message.body.length > maxChars) break;
    selected.push(message);
    chars += message.body.length;
  }
  return selected.reverse();
}
