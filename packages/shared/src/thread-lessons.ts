import {
  looksLikeAreYouReal,
  looksLikeInventedAboutHimCallout,
  looksLikeInventedBeach,
  looksLikeMetaTease,
  looksLikePetNamePushback,
  looksLikeRefundCallout,
  looksLikeRefundTalk,
  looksLikeSextAsk,
  looksLikeTeaseAsk,
  looksLikeWhatsWrongFollowup,
} from "./replies.js";

export type ThreadLessons = {
  bans: string[];
  answeredAreYouReal: boolean;
  bannedPetNames: boolean;
  bannedRefunds: boolean;
  bannedBeach: boolean;
  heWantsTease: boolean;
};

export function looksLikeStaleAreYouReal(text: string): boolean {
  return /\b(ofcourse im real|ofcourse i am(?: real)?|not a bot|very real over here|you think i'?d be fake|why would i be fake|why wouldnt i be)\b/i.test(
    text,
  );
}

export function inferThreadLessons(
  messages: { authorType: string; body: string }[],
): ThreadLessons {
  let answeredAreYouReal = false;
  let bannedPetNames = false;
  let bannedRefunds = false;
  let bannedBeach = false;
  let heWantsTease = false;

  for (const message of messages) {
    const fromFan = message.authorType === "SUBSCRIBER";
    const body = message.body;
    if (fromFan) {
      if (looksLikeAreYouReal(body) || looksLikeWhatsWrongFollowup(body)) answeredAreYouReal = true;
      if (looksLikePetNamePushback(body)) bannedPetNames = true;
      if (looksLikeRefundCallout(body)) bannedRefunds = true;
      if (looksLikeInventedAboutHimCallout(body) || /from the beach|beach fan/i.test(body))
        bannedBeach = true;
      if (looksLikeTeaseAsk(body)) heWantsTease = true;
    } else {
      if (
        looksLikeStaleAreYouReal(body) ||
        /\b(prove myself|seen me online|havent seen u|complete stranger)\b/i.test(body)
      ) {
        answeredAreYouReal = true;
      }
      if (looksLikeRefundTalk(body)) bannedRefunds = true;
      if (looksLikeInventedBeach(body)) bannedBeach = true;
      if (looksLikeTeaseAsk(body) || looksLikeMetaTease(body))
        heWantsTease = heWantsTease || looksLikeMetaTease(body);
    }
  }

  const bans: string[] = [];
  if (answeredAreYouReal) {
    bans.push(
      "Already answered are-you-real. Do not rerun that speech unless he asks again THIS turn. If he is flirting or sexting now, sext back.",
    );
  }
  if (bannedPetNames) {
    bans.push(
      "He told you to stop pet names. Never loser, good boy, baby, or daddy again in this thread.",
    );
  }
  if (bannedRefunds) {
    bans.push("Do not mention refunds unless he asked for one. A bot complaint is not a refund.");
  }
  if (bannedBeach) {
    bans.push("Do not say he is from the beach or invent hobbies. That was wrong.");
  }
  if (heWantsTease) {
    bans.push("He asked to be teased. Actually sext. Never write you want me to tease you.");
  }
  return { bans, answeredAreYouReal, bannedPetNames, bannedRefunds, bannedBeach, heWantsTease };
}

export function mergeThreadLessonMemory(
  lessons: ThreadLessons,
  stored?: string | null,
): ThreadLessons {
  const extra = (stored ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bans = [...lessons.bans];
  for (const line of extra) {
    if (!bans.includes(line)) bans.push(line);
  }
  return {
    ...lessons,
    bannedPetNames: lessons.bannedPetNames || /pet name|loser|good boy/i.test(stored ?? ""),
    bannedRefunds: lessons.bannedRefunds || /refund/i.test(stored ?? ""),
    bannedBeach: lessons.bannedBeach || /beach/i.test(stored ?? ""),
    answeredAreYouReal: lessons.answeredAreYouReal || /are-you-real|ofcourse/i.test(stored ?? ""),
    heWantsTease: lessons.heWantsTease || /teased|tease you/i.test(stored ?? ""),
    bans,
  };
}

export function shouldSextNotScript(opts: {
  subscriberText: string;
  lessons: ThreadLessons;
}): boolean {
  const last = opts.subscriberText;
  if (looksLikeTeaseAsk(last) || looksLikeSextAsk(last)) return true;
  if (opts.lessons.heWantsTease && !looksLikeAreYouReal(last) && !looksLikePetNamePushback(last)) {
    return /\b(hard|wet|horny|cock|dick|fuck|suck|mmm|show me|do it)\b/i.test(last);
  }
  return false;
}
