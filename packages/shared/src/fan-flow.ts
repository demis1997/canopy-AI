import {
  locationReplyVariants,
  looksLikeLocationAsk,
  looksLikeInventedAboutHimCallout,
  looksLikeTeaseAsk,
  looksLikeAreYouReal,
  looksLikePetNamePushback,
  looksLikeSextAsk,
  looksLikeContentAsk,
} from "./replies.js";

export const FAN_INTAKE_PLAYBOOK = `NEW/EXISTING FAN FLOW — one beat per send. Quoted lines are word-for-word.
PHASE 1 NEW (no history):
IF he paid the welcome bundle: ask if he enjoyed it, then jump to sub/dom check. Then 5 warmup sends (1 "are you ready for me"; 2 = two teasers + text; 3 plain text; 4 plain text; 5 two more teasers) then first sequence product $7-9.
IF he did NOT pay welcome: ALWAYS start by asking how he is after the automated messages. If he asks how she is, answer. Then VIBE: "how many hands are you typing with?" If jerking: "can i ask you something before we dive deeper?" and skip remaining intake — jump to sub/dom. If not jerking: HIS age (NOTES), location (NOTES), job (NOTES), then assessment.
If he asks HER age: send a teaser and tell him her age.
Location close: "oh thats interesting, i dont talk to a lot of people that are pretty close to me". Far or wbu: "oh deal breaker, just kidding haha. its cool were gonna still talk on here anyways".
Interesting job / wbu: "thank gosh haha finally somebody interesting on this platform lol i thought such ppl dont exist anymore lool". Generic job: "thats fine, props to you for working anyways, its cool that you have a job afterall".
PHASE 1 EXISTING: ask how he's been without hype. If he asks back: "oh ive been great and its good to see you here, really happy that were talking now". Vibe: "how many hands are you typing with, haha? you can be honest with me". Jerking + no sub/dom yet: "well i was really expecting that... in that case, can i ask you something since i cant quite read you?" then the check. Switch: what he feels like being now. Sub or dom known: jump to that script. Not jerking: fill missing age/location/job then sell.
PHASE 2: "let me ask you a naughty question now tho. what turns you on, being in charge or submitting like a good boy?" Sub: "figured that a long time ago, it was just a matter of time till you were going to admit it. ready to finally surrender to me now?" Dom: "well in that case i just want to see if you can properly do it hehe, so are you going to prove yourself now?" Switch: "im kind of the same, but if you really were to decide, what do you feel like being now, letting me take charge or you doing it?" Then run the matching script. Fan submissive → dominant script. Fan dominant → submissive script.
PHASE 3 AFTERCARE after 3 sequence products: "that was so good, seriously felt like cloud nine, haha" then closer-not-just-sexual then spicier as we progress.
DEVIATION: answered + extra → ack, next step. Wont answer → ack, next step. Completely off → re-ask once; if still off, ask what he wants; if that is content, sell it; if not, ignore. Unpaid locked drop: follow up, do not send another locked item unless he says he will buy the next one (once only). Mid-sequence PPV ask: sell that item then resume the sequence. Max 6 sequence drops, each priced higher than the last.`;

export const SUB_DOM_QUESTION = [
  "let me ask you a naughty question now tho",
  "what turns you on, being in charge or submitting like a good boy?",
].join("\n");

export const AFTERCARE_QUOTES = [
  "that was so good, seriously felt like cloud nine, haha",
  "i want to get to know you more than just on a sexual note, because thats only gonna bring us closer together",
  "and if we are closer together.. that means even our fun is gonna be spicier and spicier as we progress",
];

export type FanIntakeVars = {
  name?: string;
  age?: number | null;
  city?: string | null;
};

export type FanIntakeBeat = {
  id: string;
  variants: string[];
  skipPitch?: boolean;
};

export type FanIntakeInput = {
  subscriberText: string;
  recentMessages: { authorType: string; body: string }[];
  fanNotes?: {
    location?: string;
    notes?: string;
    extra?: Record<string, string>;
    dominance?: string;
  } | null;
  subscriberName?: string;
  creatorAge?: number | null;
  creatorCity?: string | null;
  boughtWelcome?: boolean;
  existingFan?: boolean;
  skipKeys?: Array<"howare" | "vibe" | "age" | "city" | "job" | "subdom" | "warmup">;
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

export function looksLikeWontAnswer(text: string): boolean {
  return /\b(dont wanna (say|answer|tell)|don'?t (want to|wanna) (say|answer)|none of (your|ur) business|skip( that| this)?|next question|rather not|not telling|idk|i don'?t know|private)\b/i.test(
    text,
  );
}

export function looksLikeJerking(text: string): boolean {
  return /\b(jerk|stroking|one (hand|of them) busy|just one|left hand|right hand|busy yeah|yeah one)\b/i.test(text);
}

export function looksLikeHandsFree(text: string): boolean {
  return /\b(both (hands )?free|hands free|neither|not busy|nope|two hands)\b/i.test(text);
}

export function looksLikeWillBuyNext(text: string): boolean {
  return /\b(i('ll| will)|im gonna|gonna) (buy|get|unlock|take) (it|that|the next)|send the next (one|ppv)|ill take the next\b/i.test(
    text,
  );
}

export function looksLikeInterestingJob(text: string): boolean {
  return /\b(doctor|surgeon|lawyer|attorney|engineer|software|dev|founder|ceo|owner|entrepreneur|finance|banker|pilot|architect|producer|director|investor)\b/i.test(
    text,
  );
}

export function isExistingFan(input: {
  funnelStage?: string;
  purchasedPpvCount?: number;
  priorCreatorMessages?: number;
  extra?: Record<string, string>;
  ageKnown?: boolean;
  cityKnown?: boolean;
  jobKnown?: boolean;
}): boolean {
  if (input.extra?.phase1_done === "true") return true;
  if ((input.purchasedPpvCount ?? 0) > 0) return true;
  if (input.ageKnown || input.cityKnown || input.jobKnown) return true;
  if ((input.priorCreatorMessages ?? 0) >= 2 && (input.funnelStage ?? "NEW_FAN") !== "NEW_FAN") return true;
  return false;
}

function asked(re: RegExp, messages: { authorType: string; body: string }[]): boolean {
  return messages.some((m) => m.authorType !== "SUBSCRIBER" && re.test(m.body));
}

function askedCount(re: RegExp, messages: { authorType: string; body: string }[]): number {
  return messages.filter((m) => m.authorType !== "SUBSCRIBER" && re.test(m.body)).length;
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

function skipped(input: FanIntakeInput, key: NonNullable<FanIntakeInput["skipKeys"]>[number]): boolean {
  return Boolean(input.skipKeys?.includes(key));
}

function currentQuestionKey(us: { authorType: string; body: string }[]): NonNullable<FanIntakeInput["skipKeys"]>[number] | null {
  const last = [...us].reverse()[0]?.body ?? "";
  if (/how many hands|both hands free|one of them busy/i.test(last)) return "vibe";
  if (/how old are you/i.test(last)) return "age";
  if (/where are you from/i.test(last)) return "city";
  if (/what do u do for a living|for a living/i.test(last)) return "job";
  if (/being in charge or submitting/i.test(last)) return "subdom";
  if (/are you ready for me/i.test(last)) return "warmup";
  if (/how are you|how have you been|enjoying the view/i.test(last)) return "howare";
  return null;
}

function looksCloseToCreator(text: string, creatorCity: string | null): boolean {
  if (/\b(close|nearby|same (city|town|state)|not far|around here)\b/i.test(text)) return true;
  if (creatorCity && new RegExp(`\\b${creatorCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
    return true;
  }
  return false;
}

export function extractFanFacts(input: {
  subscriberText: string;
  recentMessages: { authorType: string; body: string }[];
  creatorCity?: string | null;
}): {
  extra: Record<string, string>;
  location?: string;
  dominance?: "UNKNOWN" | "SUBMISSIVE" | "DOMINANT" | "SWITCH";
  notesAppend?: string;
} {
  const last = input.subscriberText.trim();
  const us = input.recentMessages.filter((m) => m.authorType !== "SUBSCRIBER");
  const extra: Record<string, string> = {};
  const notes: string[] = [];
  let location: string | undefined;
  let dominance: "UNKNOWN" | "SUBMISSIVE" | "DOMINANT" | "SWITCH" | undefined;
  if (/\?/.test(last) && !/\b(im|i am|i'm)\b/i.test(last)) {
    return { extra };
  }
  if (asked(/how old are you/i, us) && !asked(/how old do u think i am/i, us)) {
    const age = last.match(/\b(1[89]|[2-6]\d)\b/);
    if (age) {
      extra.fan_age = age[1]!;
      notes.push(`age: ${age[1]}`);
    }
  }
  if (asked(/where are you from/i, us)) {
    const city = last
      .replace(/[?!.,]/g, " ")
      .replace(/\b(im|i'm|i am|from|in|near|live|around|the)\b/gi, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 3)
      .join(" ");
    if (city && !/^(yes|yeah|nah|idk|you|what|about)\b/i.test(city)) {
      extra.fan_city = city.toLowerCase();
      location = city;
      notes.push(`city: ${city}`);
    }
  }
  if (asked(/what do u do for a living|for a living/i, us)) {
    const job = last.replace(/[?!]/g, "").trim().slice(0, 80);
    if (job.length >= 3 && !looksLikeWontAnswer(job)) {
      extra.fan_job = job;
      notes.push(`job: ${job}`);
    }
  }
  if (asked(/being in charge or submitting|take charge or you doing it/i, us)) {
    if (/\b(both|switch|either|depends)\b/i.test(last)) dominance = "SWITCH";
    else if (/\b(submit|submissive|good boy|you in charge|u in charge|you take charge)\b/i.test(last)) {
      dominance = "SUBMISSIVE";
    } else if (/\b(in charge|dominat|im the dom|i'?m dom|i like (to )?control)\b/i.test(last)) {
      dominance = "DOMINANT";
    }
    if (dominance) extra.fan_dominance = dominance;
  }
  return { extra, location, dominance, notesAppend: notes.length ? notes.join("; ") : undefined };
}

function beat(id: string, variants: string[], skipPitch = false): FanIntakeBeat {
  return { id, variants, skipPitch };
}

function subDomVariants(): string[] {
  return [
    SUB_DOM_QUESTION,
    ["naughty question", "what turns you on, being in charge or submitting like a good boy?"].join("\n"),
  ];
}

export function inferFanIntake(input: FanIntakeInput, skipPacing = false): FanIntakeBeat | null {
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
  const skip = (key: NonNullable<FanIntakeInput["skipKeys"]>[number]) => skipped(input, key);
  const ageKnown = skip("age") || hasNote(notes, extra, "age");
  const cityKnown = skip("city") || Boolean(input.fanNotes?.location) || hasNote(notes, extra, "city");
  const jobKnown = skip("job") || hasNote(notes, extra, "job");
  const dominance = (input.fanNotes?.dominance ?? extra.fan_dominance ?? "UNKNOWN").toUpperCase();
  const dominanceKnown = dominance === "SUBMISSIVE" || dominance === "DOMINANT" || dominance === "SWITCH";
  const boughtWelcome = Boolean(input.boughtWelcome || extra.bought_welcome === "true");
  const existingFan = Boolean(input.existingFan);

  const skipCurrentAndContinue = (): FanIntakeBeat | null => {
    const key = currentQuestionKey(us);
    if (!key) return inferFanIntake({ ...input, subscriberText: "ok" }, true);
    return inferFanIntake({ ...input, subscriberText: "ok", skipKeys: [...(input.skipKeys ?? []), key] }, true);
  };

  if (!skipPacing && (looksLikePacingPushback(last) || looksLikeWontAnswer(last))) {
    const continued = skipCurrentAndContinue();
    const nextLine = continued?.variants[0]?.split("\n").filter(Boolean).at(-1) ?? "what u doing rn";
    return beat("pacing", [
      ["haha my bad", "just getting to know u", nextLine].join("\n"),
      ["ok ok no rush", nextLine].join("\n"),
      ["lol fair", nextLine].join("\n"),
    ]);
  }

  if (looksLikeInventedAboutHimCallout(last)) {
    return null;
  }

  if (looksLikeLocationAsk(last)) {
    return beat("her_city", locationReplyVariants(vars.city ?? null));
  }

  if (/\b(what do (you|u) (wanna|want to|want) know about me|ask me (anything|something))\b/i.test(last)) {
    return null;
  }

  const pendingKey = currentQuestionKey(us);
  const unanswered =
    (pendingKey === "age" && !ageKnown && !/\b(1[89]|[2-6]\d)\b/.test(last)) ||
    (pendingKey === "city" && !cityKnown && last.length > 0 && !looksCloseToCreator(last, vars.city ?? null) && !/[a-z]{3,}/i.test(last.replace(/\b(im|from|in|near|the|a)\b/gi, ""))) ||
    (pendingKey === "job" && !jobKnown && last.length < 3) ||
    (pendingKey === "vibe" && !looksLikeJerking(last) && !looksLikeHandsFree(last) && last.split(/\s+/).length > 10) ||
    (pendingKey === "subdom" && !dominanceKnown && last.split(/\s+/).length > 12 && !/\b(sub|dom|charge|submit|both|switch)\b/i.test(last));

  if (pendingKey && unanswered && askedCount(new RegExp(pendingKey === "age" ? "how old are you" : pendingKey === "city" ? "where are you from" : pendingKey === "job" ? "for a living" : pendingKey === "vibe" ? "hands" : pendingKey === "subdom" ? "being in charge or submitting" : "how are you|how have you been", "i"), us) >= 2) {
    if (looksLikeContentAsk(last)) return null;
    return beat(
      "ignore",
      [
        ["alright", "hmu when u wanna actually talk"].join("\n"),
        ["ok", "ping me when u know what u want"].join("\n"),
      ],
      true,
    );
  }

  if (pendingKey && unanswered && last.split(/\s+/).length > 8 && !looksLikeContentAsk(last)) {
    if (pendingKey === "age") {
      return beat("age_reaffirm", [
        ["wait i still wanna know", "how old are you?"].join("\n"),
        ["hold on tho", "how old are you"].join("\n"),
      ]);
    }
    if (pendingKey === "city") {
      return beat("city_reaffirm", [
        ["ok but", "where are you from btw"].join("\n"),
      ]);
    }
    if (pendingKey === "job") {
      return beat("job_reaffirm", [
        ["still curious", "what do u do for a living"].join("\n"),
      ]);
    }
    if (pendingKey === "vibe") {
      return beat("vibe_reaffirm", [
        ["wait", "how many hands are you typing with?"].join("\n"),
      ]);
    }
    if (pendingKey === "subdom") {
      return beat("subdom_reaffirm", subDomVariants());
    }
  }

  if (/\bhow old (are you|are u|r u)\b/i.test(last) || /\bwhat(?:'?s| is) (?:your|ur) age\b/i.test(last)) {
    const ageLine = vars.age != null ? `im ${vars.age}` : "old enough";
    const closer = !ageKnown ? "mmm how old are you? feel curious idk why" : null;
    return beat("her_age_tease", [
      ["wait let me send u something", ageLine, closer].filter(Boolean).join("\n"),
      ["hold on", ageLine, closer].filter(Boolean).join("\n"),
    ]);
  }

  if (asked(/being in charge or submitting/i, us) && !dominanceKnown) {
    if (/\b(both|switch|either|depends)\b/i.test(last)) {
      return beat("switch_now", [
        [
          "im kind of the same, but if you really were to decide",
          "what do you feel like being now, letting me take charge or you doing it?",
        ].join("\n"),
      ]);
    }
    if (/\b(submit|submissive|good boy|you in charge|u in charge)\b/i.test(last)) {
      return beat("sub_yes", [
        [
          "figured that a long time ago, it was just a matter of time till you were going to admit it",
          "ready to finally surrender to me now?",
        ].join("\n"),
      ]);
    }
    if (/\b(in charge|dominat|im the dom|i like (to )?control|prove)\b/i.test(last)) {
      return beat("dom_yes", [
        [
          "well in that case i just want to see if you can properly do it hehe",
          "so are you going to prove yourself now?",
        ].join("\n"),
      ]);
    }
  }

  if (boughtWelcome && !dominanceKnown && !skip("subdom")) {
    if (!asked(/enjoy(ed)? (that |the )?bundle/i, us) && us.length <= 2) {
      return beat("welcome_bundle", [
        [
          "hope you enjoyed that bundle",
          "let me ask you a naughty question now tho",
          "what turns you on, being in charge or submitting like a good boy?",
        ].join("\n"),
        ["so did that bundle hit", SUB_DOM_QUESTION].join("\n"),
      ]);
    }
    if (!asked(/being in charge or submitting/i, us)) {
      return beat("subdom", subDomVariants());
    }
  }

  if (boughtWelcome && dominanceKnown && !skip("warmup")) {
    if (!asked(/are you ready for me/i, us)) {
      return beat("warmup_ready", [
        ["are you ready for me"].join("\n"),
        ["soo", "are you ready for me"].join("\n"),
      ]);
    }
    if (askedCount(/are you ready for me/i, us) >= 1 && !asked(/getting warmed up|shot something|peek/i, us)) {
      return beat("warmup_tease_1", [
        ["dont get too excited.. i havent done anything yet", "im just getting warmed up", "wait i shot something earlier"].join("\n"),
        ["hold on", "let me send a peek", "i shot something earlier"].join("\n"),
      ]);
    }
    if (asked(/getting warmed up|shot something|peek/i, us) && !asked(/this is gonna be|wait till u see/i, us)) {
      return beat("warmup_text_1", [
        ["this is gonna be fun"].join("\n"),
        ["ok stay with me"].join("\n"),
      ]);
    }
    if (asked(/this is gonna be|wait till u see|ok stay with me/i, us) && !asked(/u have no idea|keep that thought/i, us)) {
      return beat("warmup_text_2", [
        ["u have no idea"].join("\n"),
        ["keep that thought"].join("\n"),
      ]);
    }
    if (asked(/u have no idea|keep that thought/i, us) && !asked(/last peek|one more before/i, us)) {
      return beat("warmup_tease_2", [
        ["one more before i send the real thing", "wait let me send u something"].join("\n"),
        ["last peek", "i shot something filthy"].join("\n"),
      ]);
    }
    return null;
  }

  if (existingFan && !skip("howare") && !asked(/how have you been/i, us) && !asked(/how many hands/i, us) && us.length === 0) {
    return beat("existing_opener", [
      ["hey", "how have you been"].join("\n"),
      ["hey", "how u been"].join("\n"),
    ]);
  }

  if (
    existingFan &&
    asked(/how have you been|how u been/i, us) &&
    /\b(how are you|hows it going|hbu|you\??|wbu)\b/i.test(last) &&
    !asked(/good to see you here/i, us)
  ) {
    return beat("existing_askback", [
      ["oh ive been great and its good to see you here", "really happy that were talking now"].join("\n"),
    ]);
  }

  if (us.length === 0 && !boughtWelcome) {
    return beat("how_are", [
      [`heyy ${vars.name}`, "how are you"].join("\n"),
      [`heyy ${vars.name}`, "hows it going"].join("\n"),
    ]);
  }

  if (
    !existingFan &&
    /\b(how are you|hows it going|hbu|you\??)\b/i.test(last) &&
    !asked(/saw u here|doing great actually/i, us)
  ) {
    return beat("gym", [
      ["im doing great actually", "was about to get ready to go to the gym and saw u here"].join("\n"),
      ["good tbh", "was getting ready for the gym and saw u"].join("\n"),
    ]);
  }

  const vibeAsked = asked(/how many hands|both hands free|one of them busy/i, us);
  if (vibeAsked && !skip("vibe")) {
    if (looksLikeJerking(last)) {
      if (existingFan && !dominanceKnown) {
        return beat("vibe_yes", [
          [
            "well i was really expecting that...",
            "in that case, can i ask you something since i cant quite read you?",
          ].join("\n"),
        ]);
      }
      return beat("vibe_yes", [
        ["can i ask you something before we dive deeper?"].join("\n"),
        ["wait", "can i ask you something before we dive deeper?"].join("\n"),
      ]);
    }
    if (looksLikeHandsFree(last) || last.length > 0) {
      if (existingFan && ageKnown && cityKnown && jobKnown) {
        return dominanceKnown ? null : beat("subdom", subDomVariants());
      }
      if (existingFan) {
        if (!ageKnown) {
          return beat("his_age", [
            ["mmm how old are you?", "feel curious idk why"].join("\n"),
            ["ok random", "how old are you"].join("\n"),
          ]);
        }
        if (!cityKnown) {
          return beat("location", [
            ["where are you from btw", "lets see how close or far we are"].join("\n"),
          ]);
        }
        if (!jobKnown) {
          return beat("job", [
            ["soo last question then", "what do u do for a living? just curiouss"].join("\n"),
          ]);
        }
      }
      return beat("vibe_no", [
        ["ok", "mmm how old are you? feel curious idk why"].join("\n"),
        ["nice", "mmm how old are you? feel curious idk why"].join("\n"),
      ]);
    }
  }

  if (asked(/dive deeper|cant quite read you/i, us) && !dominanceKnown) {
    if (existingFan && /\b(switch|both)\b/i.test(extra.fan_dominance ?? "")) {
      return beat("switch_now", [
        [
          "im kind of the same, but if you really were to decide",
          "what do you feel like being now, letting me take charge or you doing it?",
        ].join("\n"),
      ]);
    }
    return beat("subdom", subDomVariants());
  }

  if (asked(/where are you from/i, us) && last && !asked(/pretty close to me|deal breaker/i, us) && (cityKnown || last.length > 0)) {
    const close = looksCloseToCreator(last, vars.city ?? null);
    return beat("location_react", close
      ? [
          ["oh thats interesting", "i dont talk to a lot of people that are pretty close to me"].join("\n"),
        ]
      : [
          ["oh deal breaker, just kidding haha", "its cool were gonna still talk on here anyways"].join("\n"),
        ]);
  }

  if (asked(/what do u do for a living|for a living/i, us) && last && !asked(/somebody interesting|props to you for working/i, us) && (jobKnown || last.length > 2)) {
    const interesting = looksLikeInterestingJob(last) || /\bwbu\b|\bwhat about you\b/i.test(last);
    return beat("job_react", interesting
      ? [
          ["thank gosh haha finally somebody interesting on this platform lol i thought such ppl dont exist anymore lool"].join("\n"),
        ]
      : [
          ["thats fine, props to you for working anyways, its cool that you have a job afterall"].join("\n"),
        ]);
  }

  if (!vibeAsked && !skip("vibe") && !asked(/how old are you|where are you from|for a living|being in charge or submitting|are you ready for me/i, us) && (asked(/how are you|hows it going|how have you been|saw u here|doing great actually/i, us) || us.length > 0)) {
    if (existingFan) {
      return beat("vibe", [
        ["how many hands are you typing with, haha?", "you can be honest with me"].join("\n"),
        ["wait", "how many hands are you typing with, haha?"].join("\n"),
      ]);
    }
    return beat("vibe", [
      ["how many hands are you typing with?"].join("\n"),
      ["wait", "how many hands are you typing with?"].join("\n"),
    ]);
  }

  if (!ageKnown && !asked(/how old are you\? feel curious|how old are you/i, us)) {
    return beat("his_age", [
      ["mmm how old are you?", "feel curious idk why"].join("\n"),
      ["ok random", "how old are you"].join("\n"),
    ]);
  }

  if (!cityKnown && !asked(/where are you from btw/i, us)) {
    return beat("location", [
      ["where are you from btw", "lets see how close or far we are"].join("\n"),
      ["where u from", "lets see how close we are"].join("\n"),
    ]);
  }

  if (!jobKnown && !asked(/what do u do for a living/i, us)) {
    return beat("job", [
      ["soo last question then", "u always busy? what do u do for a living? just curiouss"].join("\n"),
      ["last one", "what do u do for a living"].join("\n"),
    ]);
  }

  if (!dominanceKnown && !skip("subdom") && (jobKnown || asked(/somebody interesting|props to you for working/i, us) || asked(/dive deeper/i, us))) {
    return beat("subdom", subDomVariants());
  }

  if (existingFan && dominanceKnown) {
    return null;
  }

  if (dominanceKnown) {
    return null;
  }

  return null;
}

export function fillFanFlow(template: string, vars: FanIntakeVars): string {
  return template
    .replace(/\{name\}/gi, vars.name || "babe")
    .replace(/\{age\}/gi, vars.age != null ? String(vars.age) : "old enough")
    .replace(/\{cityReveal\}/gi, vars.city ? `im in ${vars.city}` : "anyway were both here");
}

export function intakeComplete(opts: {
  extra?: Record<string, string>;
  location?: string;
  notes?: string;
  dominance?: string;
  boughtWelcome?: boolean;
}): boolean {
  const blob = `${opts.location ?? ""} ${opts.notes ?? ""} ${Object.values(opts.extra ?? {}).join(" ")}`;
  const extra = opts.extra ?? {};
  const age = hasNote(blob, extra, "age");
  const city = Boolean(opts.location) || hasNote(blob, extra, "city");
  const job = hasNote(blob, extra, "job");
  const dominance = (opts.dominance ?? extra.fan_dominance ?? "UNKNOWN").toUpperCase();
  const known = dominance === "SUBMISSIVE" || dominance === "DOMINANT" || dominance === "SWITCH";
  if (opts.boughtWelcome) return known;
  return (age && city && job) || known;
}

export function shouldRunFanIntake(opts: {
  funnelStage?: string;
  intent?: string;
  purchasedPpvCount?: number;
  subscriberText?: string;
  intakeComplete?: boolean;
  sequenceKind?: string | null;
}): boolean {
  const last = opts.subscriberText ?? "";
  if (looksLikeTeaseAsk(last) || looksLikeAreYouReal(last) || looksLikePetNamePushback(last)) return false;
  if (looksLikeContentAsk(last)) return false;
  if ((opts.purchasedPpvCount ?? 0) >= 3) return false;
  if (opts.sequenceKind && opts.sequenceKind !== "STARTER") return false;
  if (opts.intent === "CONTENT_REQUEST" || opts.intent === "PURCHASE_INTEREST") return false;
  if (opts.intent === "PRICE_OBJECTION" || opts.intent === "COMPLAINT" || opts.intent === "REFUND" || opts.intent === "UNSAFE") {
    return false;
  }
  if (opts.intakeComplete && (opts.intent === "SEXTING" || looksLikeSextAsk(last))) return false;
  const stage = opts.funnelStage ?? "";
  return stage === "NEW_FAN" || stage === "RAPPORT" || stage === "INTEREST" || !stage;
}
