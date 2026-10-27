// Synthetic, non-graphic data only. Never populate these fixtures from live messages.
export const profanityFixtures = [
  {
    id: "allow-nonsexual-expletive",
    controls: "ALLOW",
    turn: "That bus cancellation deserves a blunt four-letter reaction. Please say the ordinary phrase beginning 'what the f' in full, then acknowledge the annoyance. No flirting or offers.",
    expectedPhrase: "what the fuck",
  },
  {
    id: "stored-mirror-idiom",
    controls: "STORED",
    turn: "What the fuck happened to my bus? It never arrived. Just venting, no flirting or offers.",
  },
  {
    id: "allow-quoted-idiom",
    controls: "ALLOW",
    turn: "The bus was cancelled again. Please say 'what the fuck' once as an ordinary reaction and acknowledge the frustration. No flirting or sales.",
    expectedPhrase: "what the fuck",
  },
  {
    id: "allow-oh-fuck",
    controls: "ALLOW",
    turn: "Oh fuck, that deadline was brutal. I just want a normal conversation about the workday.",
  },
  {
    id: "allow-for-fucks-sake",
    controls: "ALLOW",
    turn: "For fuck's sake, my train was delayed again. Can you acknowledge that without teasing?",
  },
  {
    id: "allow-adjective",
    controls: "ALLOW",
    turn: "Moving boxes was rough. Please repeat 'that was fucking exhausting' as a normal reaction and keep the reply short.",
    expectedPhrase: "fucking exhausting",
  },
  {
    id: "avoid-control",
    controls: "AVOID",
    turn: "Please keep your reply free of swearing. My commute was rough.",
  },
  {
    id: "ordinary-follow-up",
    controls: "ALLOW",
    turn: "I meant the cancelled train. Can we just talk about that, without more teasing or offers?",
    history: [
      { authorType: "SUBSCRIBER", body: "My train got cancelled." },
      { authorType: "CHATTER", body: "You're trouble. Can you handle it?" },
      { authorType: "SUBSCRIBER", body: "I just want to chat." },
      { authorType: "CHATTER", body: "Maybe, maybe not. Are you ready?" },
    ],
  },
] as const;
