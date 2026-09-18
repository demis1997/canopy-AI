import type { GenerationOutput, OperatorRejection } from "@canopy/shared";
import {
  generationOutputSchema,
  ladderPrice,
  defaultSecondPrice,
  FIRST_PPV_MAX_DOLLARS,
  containsMeetSpeak,
  looksLikeOfflineAsk,
  looksLikePetNamePushback,
  looksLikeFanInvitesQuestions,
  looksLikeInvertedCuriosity,
  looksLikeAgeAsk,
  looksLikeAreYouReal,
  looksLikeConfirmedInventedAboutHimCallout,
  looksLikeMixupCalloutLanguage,
  looksLikeDirectCreatorQuestion,
  looksLikeMixupApology,
  looksLikeLocationAsk,
  looksLikeSexualPivot,
  looksLikePacingPushback,
  looksLikeTeaseAsk,
  looksLikeMetaTease,
  looksLikeRefundTalk,
  looksLikeRefundAsk,
  looksLikeRefundCallout,
  looksLikeInventedBeach,
  looksLikeWhatsWrongFollowup,
  looksLikeSextAsk,
  looksLikeStaleAreYouReal,
  looksLikeRelationshipAsk,
  answersRelationshipAsk,
  answersAgeAsk,
  answersLocationAsk,
  inventedAboutHimReplyVariants,
  MIXUP_CLARIFY_VARIANTS,
  petNamesAllowed,
  stripUnauthorizedPetNames,
  wantsNoPitch,
  bannedCatalogNames,
  catalogDisplayName,
  pitchIsTooEarly,
  rewriteDirectUnlockPitch,
  stripCatalogMentions,
  ageReplyVariants,
  locationReplyVariants,
  pickFreshVariants,
  tooSimilar,
  teaseReplyVariants,
  normalizeReplyBubbles,
  TOS_OFFLINE_VARIANTS,
  TOS_OFFLINE_FOLLOWUP_VARIANTS,
  PET_NAME_PUSHBACK_FALLBACK,
  PET_NAME_PUSHBACK_VARIANTS,
  ABOUT_HIM_VARIANTS,
  looksLikeAimlessRapport,
  looksLikeTellHook,
  looksLikeWaitingForReveal,
  looksLikeWrongDominanceFlip,
  looksLikePrematureVideoPitch,
  looksLikeProveYourselfAsk,
  looksLikeAffirm,
  repeatsRecentBubbles,
  RAPPORT_ONLY_VARIANTS,
  FAN_DOMINANT_FOLLOW_VARIANTS,
  FAN_SUBMISSIVE_FOLLOW_VARIANTS,
  SOFT_TEASE_VARIANTS,
  REFUND_CALLOUT_VARIANTS,
  relationshipReplyVariants,
  alreadySentObjectives,
  looksLikeStandaloneFiller,
  sequenceObjectiveOf,
  stripRepeatedObjectivesAndFiller,
  detectOperationalIntent,
  containsSexualLanguage,
  type FlowQuestion,
  type OperationalIntent,
  type ResponseMode,
} from "@canopy/shared";

function stripFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

export function extractJsonObject(text: string): string {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

export function parseGenerationOutput(
  text: string,
): { success: true; data: GenerationOutput } | { success: false; error: string } {
  const cleaned = extractJsonObject(text);
  try {
    const json = JSON.parse(cleaned);
    const parsed = generationOutputSchema.safeParse(json);
    if (!parsed.success) {
      return { success: false, error: parsed.error.message };
    }
    return { success: true, data: scrubOfflineAsks(parsed.data) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "invalid json" };
  }
}

function mapOptionTexts(
  output: GenerationOutput,
  fn: (text: string, index: number) => string,
): GenerationOutput {
  const options = output.replyOptions.map((o, i) => {
    const cleaned = normalizeReplyBubbles({ text: fn(o.text, i) });
    return {
      ...o,
      text: cleaned.text,
      messages: cleaned.messages,
    };
  });
  return { ...output, replyOptions: options };
}

function replaceAllOptions(
  output: GenerationOutput,
  texts: string[],
  seed?: string | null,
  recent: string[] = [],
): GenerationOutput {
  const pool = pickFreshVariants(texts, recent, seed);
  const next = mapOptionTexts(output, (_text, i) => pool[i] ?? pool[0]!);
  return {
    ...next,
    replyOptions: next.replyOptions.map((o) => ({
      ...o,
      internalReason: "guarded reply — no invented pitch or banned wording",
    })),
    recommendedProductId: null,
    approvedPrice: null,
  };
}

function scrubOfflineAsks(output: GenerationOutput): GenerationOutput {
  if (!output.replyOptions.some((o) => containsMeetSpeak(o.text) || o.messages.some(containsMeetSpeak))) {
    return output;
  }
  return replaceAllOptions(output, TOS_OFFLINE_VARIANTS);
}

export type AppliedGuard =
  | "safety"
  | "offline"
  | "refund"
  | "relationship"
  | "creator-age"
  | "creator-location"
  | "confirmed-mixup"
  | "tease"
  | "fan-flow"
  | null;

const LOCKED_GUARDS = new Set<AppliedGuard>([
  "safety",
  "offline",
  "refund",
  "relationship",
  "creator-age",
  "creator-location",
  "confirmed-mixup",
  "tease",
]);

function envFlag(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function isGuardDebug(): boolean {
  return envFlag("NODE_ENV") === "development" || envFlag("CANOPY_GUARD_LOG") === "1";
}

function logGuardDebug(payload: Record<string, unknown>): void {
  if (envFlag("NODE_ENV") === "production" || !isGuardDebug()) return;
  console.info("[canopy-guard]", JSON.stringify(payload));
}

export type ReplyGuardExtras = {
  rejections?: OperatorRejection[];
  catalog?: { id: string; name?: string }[];
  conversationId?: string;
  dominance?: string;
  creatorAge?: number | null;
  funnelStage?: string;
  fanMessageCount?: number;
  threadOnOffline?: boolean;
  fanIntake?: string[];
  flowPlan?: {
    mustAnswer?: "relationship" | "creator-age" | "creator-location" | "how-are-you" | "about-him" | "what-doing" | null;
    closer?: string | null;
    variants?: string[];
    phase?: string;
    step?: string;
    previousStep?: string;
    deviation?: string | null;
    facts?: Record<string, string>;
    askedObjectives?: FlowQuestion[];
    askPending?: boolean;
    pendingQuestion?: FlowQuestion;
    skipPitch?: boolean;
  };
  variantSeed?: string | null;
  creatorCity?: string | null;
  recentOutbound?: string[];
  recentMessages?: { authorType: string; body: string }[];
  transPersona?: boolean;
  threadBannedPetNames?: boolean;
  threadLessons?: {
    answeredAreYouReal?: boolean;
    bannedPetNames?: boolean;
    bannedRefunds?: boolean;
    bannedBeach?: boolean;
    heWantsTease?: boolean;
  };
  fanSentPics?: boolean;
  sellTarget?: { productId: string; name: string; price: number; reason?: "CONTEXT" | "DEFAULT" | "SEQUENCE" };
  operationalIntent?: OperationalIntent;
  responseMode?: ResponseMode;
};

function firstText(output: GenerationOutput): string {
  return output.replyOptions[0]?.text ?? "";
}

function ensureFlowCloser(
  output: GenerationOutput,
  closer: string | null | undefined,
  alreadySent: FlowQuestion[] = [],
): GenerationOutput {
  if (!closer) return output;
  const closerObjective = sequenceObjectiveOf(closer);
  if (closerObjective && alreadySent.includes(closerObjective)) return output;
  const needle = closer.split("\n").filter(Boolean).at(-1)?.toLowerCase() ?? "";
  if (!needle) return output;
  return mapOptionTexts(output, (text) => {
    if (text.toLowerCase().includes(needle.slice(0, Math.min(18, needle.length)))) return text;
    if (closerObjective && text.split("\n").some((bubble) => sequenceObjectiveOf(bubble) === closerObjective)) {
      return text;
    }
    const bubbles = text.split("\n").filter(Boolean);
    const closerBubbles = closer.split("\n").filter(Boolean);
    return [...bubbles.slice(0, Math.max(1, 3 - closerBubbles.length)), ...closerBubbles].slice(0, 3).join("\n");
  });
}

function sentObjectives(extras?: ReplyGuardExtras): FlowQuestion[] {
  if (extras?.flowPlan?.askedObjectives?.length) return extras.flowPlan.askedObjectives;
  return alreadySentObjectives(extras?.recentMessages ?? []);
}

function flowStripObjectives(extras?: ReplyGuardExtras): FlowQuestion[] {
  const asked = sentObjectives(extras);
  const askPending = extras?.flowPlan?.askPending !== false;
  const pending = extras?.flowPlan?.pendingQuestion;
  const step = extras?.flowPlan?.step;
  const extraStrip: FlowQuestion[] =
    step === "ASK_PERSONAL_PERMISSION" || pending === "PERSONAL_PERMISSION" ? ["SUB_DOM"] : [];
  return [
    ...asked,
    ...(!askPending && pending ? [pending] : []),
    ...extraStrip,
  ];
}

function pendingCloser(extras?: ReplyGuardExtras): string | null | undefined {
  if (extras?.flowPlan?.askPending === false) return null;
  const closer = extras?.flowPlan?.closer;
  if (!closer) return closer;
  return stripRepeatedObjectivesAndFiller(closer, flowStripObjectives(extras)) || null;
}

function applySequenceRecovery(output: GenerationOutput, extras?: ReplyGuardExtras): GenerationOutput {
  const askPending = extras?.flowPlan?.askPending !== false;
  const strip = flowStripObjectives(extras);
  const rawCloser = askPending ? extras?.flowPlan?.closer ?? null : null;
  const safeCloser = rawCloser ? stripRepeatedObjectivesAndFiller(rawCloser, strip) || null : null;
  const closerObjective = safeCloser ? sequenceObjectiveOf(safeCloser) : null;
  return mapOptionTexts(output, (text) => {
    const cleaned = stripRepeatedObjectivesAndFiller(text, strip);
    const bubbles = cleaned.split("\n").filter(Boolean);
    if (!safeCloser) return cleaned;
    if (closerObjective && bubbles.some((bubble) => sequenceObjectiveOf(bubble) === closerObjective)) return cleaned;
    const needle = safeCloser.split("\n").filter(Boolean).at(-1)?.toLowerCase() ?? "";
    if (needle && cleaned.toLowerCase().includes(needle.slice(0, Math.min(18, needle.length)))) return cleaned;
    const closerBubbles = safeCloser.split("\n").filter((line) => !looksLikeStandaloneFiller(line));
    return [...bubbles.slice(0, Math.max(0, 3 - closerBubbles.length)), ...closerBubbles].slice(0, 3).join("\n");
  });
}

function operationalReviewOutput(output: GenerationOutput, flag: string): GenerationOutput {
  return {
    ...output,
    replyOptions: [],
    recommendedAction: "REQUEST_HUMAN_REVIEW",
    recommendedProductId: null,
    approvedPrice: null,
    requiresHumanReview: true,
    riskFlags: Array.from(new Set([...output.riskFlags, flag, `GUARD:${flag}`])),
  };
}

export function applyReplyGuards(
  output: GenerationOutput,
  subscriberText = "",
  extras?: ReplyGuardExtras,
): GenerationOutput {
  const seed = extras?.variantSeed;
  const recent = extras?.recentOutbound ?? [];
  const rejectedDrafts = (extras?.rejections ?? []).map((row) => row.text).filter(Boolean);
  const bannedRepeats = [...recent, ...rejectedDrafts];
  const recentMessages =
    extras?.recentMessages ??
    recent.map((body) => ({ authorType: "CREATOR", body }));
  const teasePool = teaseReplyVariants(Boolean(extras?.transPersona));
  const swap = (current: GenerationOutput, pool: string[]) => replaceAllOptions(current, pool, seed, recent);

  const route = extras?.operationalIntent
    ? { intent: extras.operationalIntent }
    : detectOperationalIntent(subscriberText);
  if (route.intent === "HUMAN_REQUEST" || route.intent === "STOP_AUTOMATION") {
    return operationalReviewOutput(output, route.intent);
  }
  if (route.intent === "AI_SUSPICION") {
    return operationalReviewOutput(output, "AI_SUSPICION");
  }

  let next = scrubOfflineAsks(output);
  let applied: AppliedGuard = null;
  let replaced = false;
  let reason = "kept-model-output";

  const confirmMixup = looksLikeConfirmedInventedAboutHimCallout({
    subscriberText,
    recentMessages,
  });
  const hits: Record<string, boolean> = {
    offline: looksLikeOfflineAsk(subscriberText),
    "pet-name": looksLikePetNamePushback(subscriberText),
    refund: looksLikeRefundCallout(subscriberText),
    relationship: looksLikeRelationshipAsk(subscriberText),
    tease: looksLikeTeaseAsk(subscriberText),
    pacing: looksLikePacingPushback(subscriberText) && Boolean(extras?.fanIntake?.length),
    location: looksLikeLocationAsk(subscriberText),
    age: looksLikeAgeAsk(subscriberText),
    "about-him": looksLikeFanInvitesQuestions(subscriberText),
    "direct-creator-question": looksLikeDirectCreatorQuestion(subscriberText),
    "confirmed-mixup": confirmMixup.matched,
    "mixup-language": looksLikeMixupCalloutLanguage(subscriberText),
    "waiting-reveal": looksLikeWaitingForReveal(subscriberText),
  };
  const matched = Object.entries(hits)
    .filter(([, hit]) => hit)
    .map(([name]) => name);

  const flow = extras?.flowPlan;
  const repairPool = flow?.variants?.length ? flow.variants : extras?.fanIntake;
  const mode = extras?.responseMode;
  const noSexual =
    mode === "OPERATIONAL" ||
    mode === "SUPPORT" ||
    mode === "NATURAL" ||
    route.intent === "COMPLAINT" ||
    route.intent === "SUPPORT_REQUEST";

  if (hits.offline) {
    next = swap(next, TOS_OFFLINE_VARIANTS);
    applied = "offline";
    replaced = true;
    reason = "offline-tos";
  } else if (hits["pet-name"]) {
    next = swap(next, PET_NAME_PUSHBACK_VARIANTS);
    replaced = true;
    reason = "pet-name-pushback";
    applied = "safety";
  } else if (hits.refund) {
    next = swap(next, REFUND_CALLOUT_VARIANTS);
    applied = "refund";
    replaced = true;
    reason = "refund-callout";
  } else if (hits.relationship || flow?.mustAnswer === "relationship") {
    const pool =
      repairPool?.[0] && answersRelationshipAsk(repairPool[0])
        ? repairPool
        : relationshipReplyVariants(flow?.closer);
    if (!answersRelationshipAsk(firstText(next)) || looksLikeMixupApology(firstText(next))) {
      next = swap(next, pool);
      replaced = true;
      reason = "relationship-fallback";
    } else {
      next = ensureFlowCloser(next, pendingCloser(extras), flowStripObjectives(extras));
      reason = "relationship-kept";
    }
    applied = "relationship";
  } else if (hits.tease && !noSexual) {
    next = swap(next, teasePool);
    applied = "tease";
    replaced = true;
    reason = "tease-ask";
  } else if (hits.pacing && extras?.fanIntake?.length) {
    next = swap(next, extras.fanIntake);
    applied = "fan-flow";
    replaced = true;
    reason = "pacing-intake";
  } else if (hits.location || flow?.mustAnswer === "creator-location") {
    const pool =
      repairPool?.[0] && answersLocationAsk(repairPool[0])
        ? repairPool
        : locationReplyVariants(extras?.creatorCity ?? null);
    if (!answersLocationAsk(firstText(next)) || looksLikeMixupApology(firstText(next))) {
      next = swap(next, pool);
      replaced = true;
      reason = "location-fallback";
    } else {
      next = ensureFlowCloser(next, pendingCloser(extras), flowStripObjectives(extras));
      reason = "location-kept";
    }
    applied = "creator-location";
  } else if (hits.age || flow?.mustAnswer === "creator-age") {
    const pool =
      repairPool?.[0] && answersAgeAsk(repairPool[0], extras?.creatorAge ?? null)
        ? repairPool
        : ageReplyVariants(extras?.creatorAge ?? null);
    if (!answersAgeAsk(firstText(next), extras?.creatorAge ?? null) || looksLikeMixupApology(firstText(next))) {
      next = swap(next, pool);
      replaced = true;
      reason = "age-fallback";
    } else {
      next = ensureFlowCloser(next, pendingCloser(extras), flowStripObjectives(extras));
      reason = "age-kept";
    }
    applied = "creator-age";
  } else if (
    hits["about-him"] &&
    (looksLikeMixupApology(firstText(next)) ||
      next.replyOptions.some((o) => looksLikeInvertedCuriosity(o.text) || o.messages.some(looksLikeInvertedCuriosity)))
  ) {
    next = swap(next, ABOUT_HIM_VARIANTS);
    applied = "fan-flow";
    replaced = true;
    reason = "about-him-fallback";
  } else if (hits["about-him"]) {
    next = ensureFlowCloser(next, pendingCloser(extras), flowStripObjectives(extras));
    applied = "fan-flow";
    reason = "about-him-kept";
  } else if (hits["confirmed-mixup"]) {
    next = swap(next, inventedAboutHimReplyVariants(confirmMixup.aboutMe));
    applied = "confirmed-mixup";
    replaced = true;
    reason = confirmMixup.aboutMe ? "confirmed-mixup-was-me" : "confirmed-mixup";
  } else if (hits["mixup-language"] && !hits["direct-creator-question"]) {
    next = swap(next, MIXUP_CLARIFY_VARIANTS);
    applied = "confirmed-mixup";
    replaced = true;
    reason = "unconfirmed-mixup-clarify";
  } else if (hits["waiting-reveal"] && (looksLikeTellHook(firstText(next)) || !repairPool?.length)) {
    const pool = (repairPool ?? []).filter((text) => !looksLikeTellHook(text));
    next = swap(next, pool.length ? pool : teasePool);
    applied = "fan-flow";
    replaced = true;
    reason = "waiting-for-reveal";
  } else if (
    extras?.fanIntake?.length &&
    extras?.sellTarget?.reason !== "CONTEXT" &&
    (looksLikeAimlessRapport(firstText(next)) || looksLikeMixupApology(firstText(next)))
  ) {
    matched.push("fan-flow-repair");
    next = swap(next, extras.fanIntake);
    applied = "fan-flow";
    replaced = true;
    reason = "fan-flow-repair";
  } else if (extras?.threadOnOffline) {
    matched.push("offline-followup");
    next = swap(next, looksLikeSexualPivot(subscriberText) ? SOFT_TEASE_VARIANTS : TOS_OFFLINE_FOLLOWUP_VARIANTS);
    applied = "offline";
    replaced = true;
    reason = "offline-followup";
  } else if (flow?.closer) {
    next = ensureFlowCloser(next, pendingCloser(extras), flowStripObjectives(extras));
    applied = "fan-flow";
    reason = "fan-flow-closer";
  }

  const sextNow =
    looksLikeTeaseAsk(subscriberText) ||
    looksLikeSextAsk(subscriberText) ||
    Boolean(extras?.threadLessons?.heWantsTease && !looksLikeAreYouReal(subscriberText));
  const locked = LOCKED_GUARDS.has(applied);

  if (
    !locked &&
    !looksLikeAreYouReal(subscriberText) &&
    !looksLikeWhatsWrongFollowup(subscriberText) &&
    next.replyOptions.some((o) => looksLikeStaleAreYouReal(o.text) || o.messages.some(looksLikeStaleAreYouReal))
  ) {
    next = swap(
      next,
      sextNow ? teasePool : extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS,
    );
    replaced = true;
    reason = "stale-are-you-real";
  }

  if (
    !locked &&
    sextNow &&
    next.replyOptions.some((o) => looksLikeMetaTease(o.text) || o.messages.some(looksLikeMetaTease))
  ) {
    next = swap(next, teasePool);
    replaced = true;
    reason = "meta-tease";
  }

  if (
    !locked &&
    !looksLikeRefundAsk(subscriberText) &&
    !looksLikeRefundCallout(subscriberText) &&
    next.replyOptions.some((o) => looksLikeRefundTalk(o.text) || o.messages.some(looksLikeRefundTalk))
  ) {
    next = swap(
      next,
      REFUND_CALLOUT_VARIANTS,
    );
    replaced = true;
    reason = "refund-leak";
  }

  if (
    !locked &&
    next.replyOptions.some((o) => looksLikeInventedBeach(o.text) || o.messages.some(looksLikeInventedBeach))
  ) {
    next = swap(next, extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS);
    replaced = true;
    reason = "invented-beach-output";
  }

  next = applySequenceRecovery(next, extras);

  const draftRepeats =
    next.replyOptions.some((o) => bannedRepeats.some((r) => tooSimilar(o.text, r) || o.messages.some((m) => tooSimilar(m, r)))) ||
    next.replyOptions.some((o) => repeatsRecentBubbles(o.text, bannedRepeats));
  if (!applied && draftRepeats) {
    const repeatedRejected = next.replyOptions.some(
      (o) => rejectedDrafts.some((r) => tooSimilar(o.text, r) || o.messages.some((m) => tooSimilar(m, r))),
    );
    const tellLoop = next.replyOptions.some((o) => looksLikeTellHook(o.text)) || looksLikeWaitingForReveal(subscriberText);
    const fresh = pickFreshVariants(
      extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS,
      bannedRepeats,
      extras?.variantSeed,
    ).filter((text) => !looksLikeTellHook(text) || !tellLoop);
    const pool = looksLikeTeaseAsk(subscriberText) || tellLoop ? teasePool : fresh.length ? fresh : teasePool;
    next = swap(next, pool);
    replaced = true;
    reason = repeatedRejected ? "rejected-draft-repeat" : "duplicate-outbound";
    next = applySequenceRecovery(next, extras);
  }

  if (rejectedDrafts.length) {
    next = mapOptionTexts(next, (text, i) =>
      rejectedDrafts.some((draft) => tooSimilar(text, draft))
        ? RAPPORT_ONLY_VARIANTS[i % RAPPORT_ONLY_VARIANTS.length]!
        : text,
    );
  }

  const lastUs =
    [...recentMessages].reverse().find((message) => message.authorType !== "SUBSCRIBER")?.body ?? "";
  const dominance = extras?.dominance ?? extras?.flowPlan?.facts?.fan_dominance;
  const inferredDominant = (dominance ?? "").toUpperCase() === "DOMINANT" || (looksLikeProveYourselfAsk(lastUs) && looksLikeAffirm(subscriberText));
  if (
    !locked &&
    next.replyOptions.some(
      (o) =>
        looksLikeWrongDominanceFlip(o.text, inferredDominant ? "DOMINANT" : dominance) ||
        o.messages.some((m) => looksLikeWrongDominanceFlip(m, inferredDominant ? "DOMINANT" : dominance)),
    )
  ) {
    const pool =
      inferredDominant || (dominance ?? "").toUpperCase() === "DOMINANT"
        ? FAN_DOMINANT_FOLLOW_VARIANTS
        : FAN_SUBMISSIVE_FOLLOW_VARIANTS;
    next = swap(next, pool);
    replaced = true;
    reason = "dominance-flip";
  }

  if (extras?.flowPlan?.skipPitch) {
    const pitched = next.replyOptions.some(
      (o) => looksLikePrematureVideoPitch(o.text) || o.messages.some(looksLikePrematureVideoPitch),
    );
    if (pitched) {
      const pool = (repairPool ?? []).filter((text) => !looksLikeTellHook(text) && !looksLikePrematureVideoPitch(text));
      next = swap(next, pool.length ? pool : inferredDominant ? FAN_DOMINANT_FOLLOW_VARIANTS : teasePool);
      replaced = true;
      reason = "skip-pitch";
    }
    next = {
      ...next,
      recommendedProductId: null,
      approvedPrice: null,
      recommendedAction:
        next.recommendedAction === "PRESENT_OFFER" || next.recommendedAction === "ESCALATE_EXPLICITNESS"
          ? "REPLY"
          : next.recommendedAction,
    };
  }

  logGuardDebug({
    subscriberText: envFlag("NODE_ENV") === "development" ? subscriberText : undefined,
    subscriberLen: subscriberText.length,
    classifiers: matched,
    selectedGuard: applied,
    replaced,
    reason,
    phase: flow?.phase,
    step: flow?.step,
    previousStep: flow?.previousStep,
    deviation: flow?.deviation,
    facts: flow?.facts,
  });

  if (!petNamesAllowed({
    subscriberText,
    dominance: extras?.dominance,
    threadBanned: extras?.threadBannedPetNames || extras?.threadLessons?.bannedPetNames,
  })) {
    next = mapOptionTexts(next, (text) => stripUnauthorizedPetNames(text));
  }

  const rejections = extras?.rejections ?? [];
  const catalog = extras?.catalog ?? [];
  if (rejections.length) {
    const noPitch = wantsNoPitch(rejections, extras?.conversationId);
    const banned = bannedCatalogNames(rejections, catalog, extras?.conversationId);
    if (noPitch || banned.names.length) {
      const namesToStrip = noPitch
        ? catalog.map((p) => catalogDisplayName(p.name ?? "")).filter((n) => n.length >= 3)
        : banned.names;
      const idsToDrop = new Set(noPitch ? catalog.map((p) => p.id) : banned.ids);
      const dropProduct =
        noPitch || (next.recommendedProductId != null && idsToDrop.has(next.recommendedProductId));
      next = mapOptionTexts(next, (text, i) => {
        const stripped = stripCatalogMentions(text, namesToStrip);
        return stripped.trim() ? stripped : RAPPORT_ONLY_VARIANTS[i % RAPPORT_ONLY_VARIANTS.length]!;
      });
      if (dropProduct) {
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          recommendedAction:
            next.recommendedAction === "PRESENT_OFFER" || next.recommendedAction === "ESCALATE_EXPLICITNESS"
              ? "REPLY"
              : next.recommendedAction,
        };
      }
    }
  }

  const catalogNames = catalog.map((p) => catalogDisplayName(p.name ?? "")).filter((n) => n.length >= 3);
  if (
    pitchIsTooEarly({
      funnelStage: extras?.funnelStage,
      fanMessageCount: extras?.fanMessageCount,
      subscriberText,
      threadOnOffline: extras?.threadOnOffline,
    })
  ) {
    next = mapOptionTexts(next, (text, i) => {
      const stripped = stripCatalogMentions(text, catalogNames);
      return stripped.trim() ? stripped : RAPPORT_ONLY_VARIANTS[i % RAPPORT_ONLY_VARIANTS.length]!;
    });
    next = {
      ...next,
      recommendedProductId: null,
      approvedPrice: null,
      recommendedAction:
        next.recommendedAction === "PRESENT_OFFER" || next.recommendedAction === "ESCALATE_EXPLICITNESS"
          ? "REPLY"
          : next.recommendedAction,
    };
  }

  if (
    !locked &&
    !looksLikeAreYouReal(subscriberText) &&
    !looksLikeOfflineAsk(subscriberText) &&
    !looksLikeTeaseAsk(subscriberText) &&
    next.replyOptions.some((o) => looksLikeAimlessRapport(o.text) || o.messages.some(looksLikeAimlessRapport))
  ) {
    next = swap(
      next,
      sextNow ? teasePool : extras?.fanIntake?.length ? extras.fanIntake : RAPPORT_ONLY_VARIANTS,
    );
  }

  if (noSexual) {
    if (next.replyOptions.some((o) => containsSexualLanguage(o.text))) {
      return operationalReviewOutput(next, "SEXUAL_NOT_ALLOWED");
    }
    if (next.recommendedProductId || next.recommendedAction === "PRESENT_OFFER") {
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        recommendedAction: "REQUEST_HUMAN_REVIEW",
        requiresHumanReview: true,
        riskFlags: Array.from(new Set([...next.riskFlags, "PITCH_DISABLED"])),
      };
    }
  } else if (
    extras?.sellTarget &&
    next.recommendedProductId &&
    next.recommendedProductId !== extras.sellTarget.productId &&
    (extras.catalog ?? []).some((p) => p.id === extras.sellTarget!.productId)
  ) {
    const namesToStrip = (extras.catalog ?? [])
      .filter((p) => p.id !== extras.sellTarget!.productId)
      .map((p) => catalogDisplayName(p.name ?? ""))
      .filter((n) => n.length >= 3);
    next = mapOptionTexts(next, (text) => stripCatalogMentions(text, namesToStrip));
    next = {
      ...next,
      recommendedProductId: extras.sellTarget.productId,
      approvedPrice: extras.sellTarget.price,
    };
  }

  if (!next.replyOptions.length) return next;
  if (applied) {
    next = {
      ...next,
      riskFlags: Array.from(new Set([...next.riskFlags, `GUARD:${applied}`])),
    };
  }
  return mapOptionTexts(next, (text) => rewriteDirectUnlockPitch(text));
}

export function validateProductsAndPrices(
  output: GenerationOutput,
  catalog: {
    id: string;
    name?: string;
    standardPrice: number;
    minimumPrice: number;
    available: boolean;
    creatorId?: string;
    resaleAllowed?: boolean;
    secondPrice?: number | null;
    sendAttempt?: number;
    discountLimitPercent?: number;
  }[],
  discountLimitPercent = 10,
  concessionAllowed = false,
  opts?: {
    creatorId?: string;
    purchasedProductIds?: string[];
    subscriberText?: string;
    rejections?: OperatorRejection[];
    conversationId?: string;
    dominance?: string;
    creatorAge?: number | null;
    funnelStage?: string;
    fanMessageCount?: number;
    threadOnOffline?: boolean;
    fanIntake?: string[];
    flowPlan?: ReplyGuardExtras["flowPlan"];
    variantSeed?: string | null;
    creatorCity?: string | null;
    recentOutbound?: string[];
    recentMessages?: { authorType: string; body: string }[];
    transPersona?: boolean;
    threadBannedPetNames?: boolean;
    threadLessons?: ReplyGuardExtras["threadLessons"];
    fanSentPics?: boolean;
    sellTarget?: ReplyGuardExtras["sellTarget"];
    operationalIntent?: OperationalIntent;
    responseMode?: ResponseMode;
  },
): { ok: boolean; output: GenerationOutput; errors: string[] } {
  const errors: string[] = [];
  let next = applyReplyGuards({ ...output }, opts?.subscriberText ?? "", {
    rejections: opts?.rejections,
    catalog,
    conversationId: opts?.conversationId,
    dominance: opts?.dominance,
    creatorAge: opts?.creatorAge,
    funnelStage: opts?.funnelStage,
    fanMessageCount: opts?.fanMessageCount,
    threadOnOffline: opts?.threadOnOffline,
    fanIntake: opts?.fanIntake,
    flowPlan: opts?.flowPlan,
    variantSeed: opts?.variantSeed,
    creatorCity: opts?.creatorCity,
    recentOutbound: opts?.recentOutbound,
    recentMessages: opts?.recentMessages,
    transPersona: opts?.transPersona,
    threadBannedPetNames: opts?.threadBannedPetNames,
    threadLessons: opts?.threadLessons,
    fanSentPics: opts?.fanSentPics,
    sellTarget: opts?.sellTarget,
    operationalIntent: opts?.operationalIntent,
    responseMode: opts?.responseMode,
  });

  if (next.recommendedProductId) {
    const product = catalog.find((p) => p.id === next.recommendedProductId);
    if (!product || !product.available) {
      errors.push("INVENTED_OR_UNAVAILABLE_PRODUCT");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "INVALID_PRODUCT"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (opts?.creatorId && product.creatorId && product.creatorId !== opts.creatorId) {
      errors.push("WRONG_CREATOR");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "WRONG_CREATOR"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (
      opts?.purchasedProductIds?.includes(product.id) &&
      !product.resaleAllowed
    ) {
      errors.push("ALREADY_PURCHASED");
      next = {
        ...next,
        recommendedProductId: null,
        approvedPrice: null,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "ALREADY_PURCHASED"],
        recommendedAction: "REQUEST_HUMAN_REVIEW",
      };
    } else if (next.approvedPrice != null) {
      const intro = product.standardPrice <= FIRST_PPV_MAX_DOLLARS + 0.009;
      const attempt = intro ? 1 : (product.sendAttempt ?? 1);
      const limit = product.discountLimitPercent ?? discountLimitPercent;
      const minAllowed = ladderPrice({
        standardPrice: product.standardPrice,
        minimumPrice: product.minimumPrice,
        discountLimitPercent: limit,
        sendAttempt: attempt,
        secondPrice: product.secondPrice,
      }).price;
      const absoluteFloor = Math.max(
        product.minimumPrice,
        product.standardPrice * (1 - limit / 100),
      );
      if (next.approvedPrice > product.standardPrice + 0.009) {
        errors.push("UNAUTHORISED_PRICE");
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          requiresHumanReview: true,
          riskFlags: [...next.riskFlags, "INVALID_PRICE"],
          recommendedAction: "REQUEST_HUMAN_REVIEW",
        };
      } else if (next.approvedPrice < absoluteFloor - 0.009) {
        errors.push("UNAUTHORISED_PRICE");
        next = {
          ...next,
          recommendedProductId: null,
          approvedPrice: null,
          requiresHumanReview: true,
          riskFlags: [...next.riskFlags, "INVALID_PRICE"],
          recommendedAction: "REQUEST_HUMAN_REVIEW",
        };
      } else if (attempt <= 1 && next.approvedPrice < product.standardPrice - 0.009) {
        next = {
          ...next,
          approvedPrice: product.standardPrice,
          riskFlags: [...next.riskFlags, "EARLY_DISCOUNT_CLAMPED"],
        };
      } else if (attempt === 2 && next.approvedPrice < minAllowed - 0.009) {
        next = {
          ...next,
          approvedPrice: minAllowed,
          riskFlags: [...next.riskFlags, "LADDER_PRICE_CLAMPED"],
        };
      }
    }
  } else if (next.approvedPrice != null) {
    errors.push("PRICE_WITHOUT_PRODUCT");
    next = { ...next, approvedPrice: null, requiresHumanReview: true };
  }

  const inventedInText = next.replyOptions.some((opt) =>
    /\$\s*\d+/.test(opt.text) &&
    !catalog.some((p) => opt.text.includes(String(p.standardPrice))),
  );
  if (inventedInText && next.recommendedProductId === null && /\$\s*\d+/.test(next.replyOptions.map((o) => o.text).join(" "))) {
    const prices = next.replyOptions.flatMap((o) => [...o.text.matchAll(/\$\s*(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])));
    const allowed = new Set(
      catalog.flatMap((p) => [p.standardPrice, p.minimumPrice, p.secondPrice ?? defaultSecondPrice(p.standardPrice, p.minimumPrice)]),
    );
    if (prices.some((p) => ![...allowed].some((a) => Math.abs(a - p) < 0.05))) {
      errors.push("INVENTED_PRICE_IN_TEXT");
      next = {
        ...next,
        requiresHumanReview: true,
        riskFlags: [...next.riskFlags, "INVALID_PRICE_IN_TEXT"],
      };
    }
  }

  return { ok: errors.length === 0, output: next, errors };
}
