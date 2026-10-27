import type { SessionEvent, SubscriberPreference } from "@canopy/shared";
export type RoutingFixture = {
  id: string;
  controls: "ALLOW" | "AVOID" | "STORED";
  turn: string;
  expectedPhrase?: string;
  history?: readonly { authorType: string; body: string }[];
  preferenceBefore?: string;
  events?: SessionEvent[];
  returning?: boolean;
  expectedPreference?: SubscriberPreference;
  expectedOfferStatus?: "DECLINED" | "PURCHASED";
};
// Entirely synthetic adults and backend events; no live subscriber reads or deliveries.
export const subscriberRoutingFixtures: RoutingFixture[] = [
  {
    id: "prefers-leading",
    controls: "ALLOW",
    turn: "I prefer taking the lead in our conversation. We can start with music.",
    expectedPreference: "PREFERS_LEADING",
  },
  {
    id: "prefers-following",
    controls: "ALLOW",
    turn: "I want you to lead our conversation. Pick a relaxed topic for us.",
    expectedPreference: "PREFERS_FOLLOWING",
  },
  {
    id: "unknown-preference",
    controls: "STORED",
    turn: "Hi, I spent the afternoon listening to music.",
    expectedPreference: "UNKNOWN",
  },
  {
    id: "changed-preference",
    controls: "ALLOW",
    preferenceBefore: "I like leading",
    turn: "Actually I prefer following now. You can pick our next topic.",
    expectedPreference: "PREFERS_FOLLOWING",
  },
  {
    id: "casual-profanity",
    controls: "STORED",
    turn: "What the fuck, my train was cancelled. Just venting about my commute.",
    expectedPreference: "UNKNOWN",
  },
  {
    id: "allow-profanity",
    controls: "ALLOW",
    turn: "My bus got cancelled. Say 'what the fuck' once as an ordinary reaction, then acknowledge the frustration.",
    expectedPhrase: "what the fuck",
  },
  {
    id: "declined-ppv",
    controls: "ALLOW",
    events: [{ type: "OFFER_SENT", id: "synthetic-offer", productId: "synthetic-item" }],
    turn: "No thanks, not buying. I'd rather just chat about music.",
    expectedOfferStatus: "DECLINED",
  },
  {
    id: "confirmed-purchase",
    controls: "ALLOW",
    events: [
      { type: "OFFER_SENT", id: "synthetic-offer", productId: "synthetic-item" },
      { type: "PURCHASE_CONFIRMED", productId: "synthetic-item" },
    ],
    turn: "Thanks, that was nice. Let's keep chatting.",
    expectedOfferStatus: "PURCHASED",
  },
  {
    id: "topic-change",
    controls: "ALLOW",
    preferenceBefore: "I like following",
    events: [{ type: "OFFER_SENT", id: "synthetic-offer", productId: "synthetic-item" }],
    turn: "Anyway, let's change the subject. What music do you like?",
    expectedPreference: "PREFERS_FOLLOWING",
  },
  {
    id: "return-after-days",
    controls: "ALLOW",
    preferenceBefore: "I like following",
    returning: true,
    turn: "Hi again, it's been a few days. Let's talk about our week.",
    expectedPreference: "PREFERS_FOLLOWING",
  },
  {
    id: "dont-repeat-preference",
    controls: "ALLOW",
    history: [{ authorType: "CHATTER", body: "Do you prefer taking the lead or having me lead?" }],
    turn: "I'd rather not answer that. Just chat with me about music.",
    expectedPreference: "UNKNOWN",
  },
];
