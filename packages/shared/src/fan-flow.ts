import { locationReplyVariants, looksLikeLocationAsk, looksLikeInventedAboutHimCallout, looksLikeTeaseAsk, looksLikeAreYouReal, looksLikePetNamePushback } from "./replies.js";

export const FAN_INTAKE_PLAYBOOK = `NEW/EXISTING FAN FLOW — stay on ONE beat per send until notes have his age, city, and job. Never dump age+city+job together.
1 Opener: oh heyy youre here {NAME}. hows it going? enjoying the view so far ;)
2 If he asks how you are: im doing great actually was about to get ready to go to the gym and saw u here
3 Ask what he is doing: well what you doing now? doing anything interesting besides talking to me?
4 Vibe check immediately: sooo before we keep going both hands free rn or is one of them busy
5 If he is jerking: well hands off that dick now i need your full attention. If not: that means you can tell me more about you nice — then age next.
6 Age (SAVE TO NOTES): mmm how old are you? feel curious idk why
7 If he asks your age: well how old do u think i am? lets see if you get it right lol — do NOT dump your age first
8 Guess right: oh you actually got it right unless you knew that already. Guess wrong: lmaoo you need an eye test im {HER_AGE} tho
9 Location (SAVE TO NOTES): where are you from btw lets see how close or far we are
10 Close vs far: react, then her city only if the persona has one. Never invent a beach/hobby he did not say.
11 Job (SAVE TO NOTES): soo last question then u always busy? what do u do for a living just curiouss
12 Cool job vs generic job: one follow-up, then stop interviewing
13 Transition: done with the boring questions haha i want to tell you something now... then tease. Still no PPV.
If he says why / we just started talking: first bubble owns it (haha my bad just getting to know u), then the current beat. Never invent a new topic.`;

export type FanIntakeVars = {
  name?: string;
  age?: number | null;
  city?: string | null;
};

export function firstName(displayName: string | undefined | null): string {
  const raw = (displayName ?? "").replace(/\(.*?\)/g, "").trim();
  const token = raw.split(/\s+/)[0] ?? "";
  return token && !/^fan$/i.test(token) ? token : "babe";
}

export function looksLikePacingPushback(text: string): boolean {
  return /\b((why\??\s+)?we just started|just started talking|too many questions|slow down|chill with the questions)\b/i.test(
    text,
  );
}

export function looksLikeJerking(text: string): boolean {
  return /\b(jerk|stroking|one (hand|of them) busy|busy yeah|yeah one)\b/i.test(text);
}

export function looksLikeHandsFree(text: string): boolean {
  return /\b(both (hands )?free|hands free|neither|not busy|nope)\b/i.test(text);
}

function asked(re: RegExp, messages: { authorType: string; body: string }[]): boolean {
  return messages.some((m) => m.authorType !== "SUBSCRIBER" && re.test(m.body));
}

function notesBlob(notes?: {
  location?: string;
  notes?: string;
  extra?: Record<string, string>;
} | null): string {
  if (!notes) return "";
  return `${notes.location ?? ""} ${notes.notes ?? ""} ${Object.values(notes.extra ?? {}).join(" ")}`.toLowerCase();
}

function hasNote(blob: string, extra: Record<string, string> | undefined, key: "age" | "city" | "job"): boolean {
  if (extra?.[`fan_${key}`] || extra?.[key]) return true;
  if (key === "age") return /\b(fan_age|age\s*[:=]\s*\d{2})\b/i.test(blob);
  if (key === "city") return /\b(fan_city|lives in|from [a-z]{3,})\b/i.test(blob);
  return /\b(fan_job|works? as)\b/i.test(blob);
}

export function inferFanIntake(
  input: {
    subscriberText: string;
    recentMessages: { authorType: string; body: string }[];
    fanNotes?: { location?: string; notes?: string; extra?: Record<string, string> } | null;
    subscriberName?: string;
    creatorAge?: number | null;
    creatorCity?: string | null;
  },
  skipPacing = false,
): { id: string; variants: string[] } | null {
  const last = input.subscriberText.trim();
  const recent = input.recentMessages;
  const us = recent.filter((m) => m.authorType !== "SUBSCRIBER");
  const vars: FanIntakeVars = {
    name: firstName(input.subscriberName),
    age: input.creatorAge,
    city: input.creatorCity,
  };
  const notes = notesBlob(input.fanNotes);
  const extra = input.fanNotes?.extra ?? {};
  const ageKnown = hasNote(notes, extra, "age");
  const cityKnown = Boolean(input.fanNotes?.location) || hasNote(notes, extra, "city");
  const jobKnown = hasNote(notes, extra, "job");

  if (!skipPacing && looksLikePacingPushback(last)) {
    const continued = inferFanIntake({ ...input, subscriberText: "ok" }, true);
    const nextLine = continued?.variants[0]?.split("\n").filter(Boolean).at(-1) ?? "what u doing rn";
    return {
      id: "pacing",
      variants: [
        ["haha my bad", "just getting to know u", nextLine].join("\n"),
        ["ok ok no rush", nextLine].join("\n"),
        ["lol fair", nextLine].join("\n"),
      ],
    };
  }

  if (looksLikeInventedAboutHimCallout(last)) {
    return null;
  }

  if (looksLikeLocationAsk(last)) {
    return {
      id: "her_city",
      variants: locationReplyVariants(vars.city ?? null),
    };
  }

  if (/\b(what do (you|u) (wanna|want to|want) know about me|ask me (anything|something))\b/i.test(last)) {
    return null;
  }

  if (asked(/how old do u think i am/i, us)) {
    const guess = last.match(/\b(1[89]|[2-6]\d)\b/);
    if (guess && vars.age != null) {
      const correct = Number(guess[1]) === vars.age;
      return {
        id: correct ? "age_right" : "age_wrong",
        variants: correct
          ? [
              ["oh u actually got it right", "unless u knew that already 😏 haha"].join("\n"),
              ["damn ok", "u got it"].join("\n"),
            ]
          : [
              [`lmaoo u need an eye test 😂`, `im ${vars.age} tho didnt think ud get it right anyway haha`].join("\n"),
              [`nope im ${vars.age}`, "nice try tho"].join("\n"),
            ],
      };
    }
  }

  if (/\bhow old (are you|are u|r u)\b/i.test(last) && !asked(/how old do u think i am/i, us)) {
    return {
      id: "age_guess",
      variants: [
        ["well how old do u think i am", "lets see if u get it right lol"].join("\n"),
        ["guess", "how old do u think i am"].join("\n"),
      ],
    };
  }

  if (us.length === 0) {
    if (/^(hi|hey|heyy|hello|yo|sup|heellooo)\b/i.test(last)) {
      return {
        id: "opener",
        variants: [
          [`oh heyy youre here ${vars.name}`, "hows it going? enjoying the view so far ;)"].join("\n"),
          [`heyy ${vars.name}`, "enjoying the view so far"].join("\n"),
        ],
      };
    }
    return null;
  }

  if (/\b(how are you|hows it going|hbu|you\??)\b/i.test(last) && !asked(/saw u here|doing great actually/i, us)) {
    return {
      id: "gym",
      variants: [
        ["im doing great actually", "was about to get ready to go to the gym and saw u here"].join("\n"),
        ["good tbh", "was getting ready for the gym and saw u"].join("\n"),
      ],
    };
  }

  if (asked(/both hands free|one of them busy/i, us)) {
    if (looksLikeJerking(last)) {
      return {
        id: "vibe_yes",
        variants: [
          ["well hands off that dick now", "i need your full attention"].join("\n"),
          ["hands off", "i want ur full attention"].join("\n"),
        ],
      };
    }
    if (looksLikeHandsFree(last) || last.length > 0) {
      return {
        id: "vibe_no",
        variants: [
          ["that means you can tell me more about you nice 😋", "mmm how old are you? feel curious idk why"].join("\n"),
          ["nice", "mmm how old are you? feel curious idk why"].join("\n"),
        ],
      };
    }
  }

  if (!asked(/both hands free|one of them busy/i, us) && asked(/what (you|u) doing now/i, us)) {
    return {
      id: "vibe",
      variants: [
        ["sooo before we keep going", "both hands free rn or is one of them busy... 👀"].join("\n"),
        ["wait", "both hands free rn or is one of them busy"].join("\n"),
      ],
    };
  }

  if (
    !asked(/what (you|u) doing now|doing anything interesting besides/i, us) &&
    (asked(/enjoying the view|doing great actually|saw u here/i, us) || us.length > 0) &&
    !asked(/both hands free|one of them busy/i, us)
  ) {
    return {
      id: "what_doing",
      variants: [
        ["well what you doing now?", "doing anything interesting besides talking to me? 😏"].join("\n"),
        ["what u doing rn", "anything besides talking to me"].join("\n"),
      ],
    };
  }

  if (!ageKnown && !asked(/how old are you\? feel curious/i, us)) {
    return {
      id: "his_age",
      variants: [
        ["mmm how old are you?", "feel curious idk why"].join("\n"),
        ["ok random", "how old are you"].join("\n"),
      ],
    };
  }

  if (!cityKnown && !asked(/where are you from btw/i, us)) {
    return {
      id: "location",
      variants: [
        ["where are you from btw", "lets see how close (or far) we are 😏"].join("\n"),
        ["where u from", "lets see how close we are"].join("\n"),
      ],
    };
  }

  if (asked(/where are you from btw/i, us) && last && !asked(/that close|i knew it|were both here/i, us)) {
    const reveal = vars.city
      ? /coast/i.test(vars.city)
        ? "i live by the coast actually"
        : `im in ${vars.city} actually`
      : "anyway were both here";
    return {
      id: "location_react",
      variants: [
        ["oh nice", reveal].join("\n"),
        ["hahaha ok", `${reveal} but at least were both here right`].join("\n"),
      ],
    };
  }

  if (!jobKnown && !asked(/what do u do for a living/i, us)) {
    return {
      id: "job",
      variants: [
        ["soo last question then", "u always busy? what do u do for a living? just curiouss"].join("\n"),
        ["last one", "what do u do for a living"].join("\n"),
      ],
    };
  }

  if (asked(/what do u do for a living/i, us) && last && !asked(/boring questions/i, us)) {
    return {
      id: "job_react",
      variants: [
        ["ohh sounds chill lol", "do u like it? as long as it pays enough all good right"].join("\n"),
        ["ohh i rarely see people who do that", "how did you get into it"].join("\n"),
      ],
    };
  }

  if (!asked(/boring questions/i, us) && (jobKnown || asked(/what do u do for a living/i, us))) {
    return {
      id: "transition",
      variants: [
        ["done with the boring questions haha", "i want to tell you something now..."].join("\n"),
        ["ok enough interview", "i wanna tell u something"].join("\n"),
      ],
    };
  }

  return null;
}

export function fillFanFlow(template: string, vars: FanIntakeVars): string {
  return template
    .replace(/\{name\}/gi, vars.name || "babe")
    .replace(/\{age\}/gi, vars.age != null ? String(vars.age) : "old enough")
    .replace(/\{cityReveal\}/gi, vars.city ? `im in ${vars.city}` : "anyway were both here");
}

export function shouldRunFanIntake(opts: {
  funnelStage?: string;
  intent?: string;
  purchasedPpvCount?: number;
  subscriberText?: string;
}): boolean {
  const last = opts.subscriberText ?? "";
  if (looksLikeTeaseAsk(last) || looksLikeAreYouReal(last) || looksLikePetNamePushback(last)) return false;
  if ((opts.purchasedPpvCount ?? 0) >= 1) return false;
  if (opts.intent === "CONTENT_REQUEST" || opts.intent === "PURCHASE_INTEREST" || opts.intent === "SEXTING") {
    return false;
  }
  if (opts.intent === "PRICE_OBJECTION" || opts.intent === "COMPLAINT" || opts.intent === "REFUND" || opts.intent === "UNSAFE") {
    return false;
  }
  const stage = opts.funnelStage ?? "";
  return stage === "NEW_FAN" || stage === "RAPPORT" || stage === "INTEREST" || !stage;
}
