export {
  AFTERCARE_QUOTES,
  PERSONAL_PERMISSION_EXAMPLES,
  SUB_DOM_QUESTION,
  advanceConversationFlow,
  alreadySentObjectives,
  askedSequenceObjectives,
  extractFanFacts,
  fillFanFlow,
  firstName,
  hydrateFlowState,
  inferFanIntake,
  interpretVibe,
  isExistingFan,
  logFlowDebug,
  looksLikeDirectHandsAnswer,
  looksLikeHandsFree,
  looksLikeInterestingJob,
  looksLikeJerking,
  looksLikeNotJerking,
  looksLikePacingPushback,
  looksLikePermissionGrant,
  looksLikeStandaloneFiller,
  looksLikeUncomfortablePersonal,
  looksLikeWillBuyNext,
  looksLikeWontAnswer,
  questionAlreadyAsked,
  repeatsAskedSequenceObjective,
  sequenceObjectiveOf,
  serializeFlowState,
  stripRepeatedObjectivesAndFiller,
  subDomQuestion,
  supportsSubDomGoodBoyTone,
  type ConversationFlowState,
  type FanIntakeBeat,
  type FanIntakeInput,
  type FanIntakeVars,
  type FlowDeviation,
  type FlowMustAnswer,
  type FlowPhase,
  type FlowQuestion,
  type FlowStep,
  type FlowTransition,
  type StepStatus,
} from "./conversation-flow.js";

import {
  looksLikeAreYouReal,
  looksLikeContentAsk,
  looksLikePetNamePushback,
  looksLikeSextAsk,
  looksLikeTeaseAsk,
} from "./replies.js";

export const FAN_INTAKE_PLAYBOOK = `NEW/EXISTING FAN FLOW — internal state machine. Use a beat only when it naturally follows HIS last message. Never force vibe/hands/age/city/job/sub-dom after a greeting or while a direct question, emotion, or support issue is unanswered. One beat per send. Quoted lines are examples, not mandatory copy.
PHASE 1 NEW (no history):
IF he paid the welcome bundle: ask if he enjoyed it, then a personal-permission transition, wait for yes/what/sure, then the sub/dom check. Then 5 warmup sends (1 "are you ready for me"; 2 = two teasers + text; 3 plain text; 4 plain text; 5 two more teasers) then first sequence product $7-9 (that $7-9 drop IS the first of the six sequence products; the bought-welcome ladder then continues $15, $35, $75, $115, $175, $199).
IF he did NOT pay welcome: start by answering him. Asking how he is is allowed once it fits. Do not immediately force "how many hands are you typing with?" after a greeting. Vibe/hands, age, city, job, and dominance are opportunistic — ask at most one, only when HIS last message makes it natural, and never after another intake question. If jerking: ask permission to go more personal ("can i ask you something before we dive deeper?"), wait for a yes/what/sure, then the sub/dom check. Not jerking → HIS age, location, job into NOTES when the opening exists. After job, react then ask permission to get more personal — do NOT ask the sub/dom question in that same send. Wait for him to agree. Never ask age, location, and job in one send.
If he asks HER age: send a teaser and tell him her age.
Location close: "oh thats interesting, i dont talk to a lot of people that are pretty close to me". Far or wbu: "oh deal breaker, just kidding haha. its cool were gonna still talk on here anyways".
Interesting job / wbu: "thank gosh haha finally somebody interesting on this platform lol i thought such ppl dont exist anymore lool". Generic job: "thats fine, props to you for working anyways, its cool that you have a job afterall".
PHASE 1 EXISTING: ask how he's been without hype. If he asks back: "oh ive been great and its good to see you here, really happy that were talking now". Vibe only if mutual energy already exists. Jerking + no sub/dom yet: permission first ("well i was really expecting that... can i ask you something since i cant quite read you?"), wait, then the check. Switch: what he feels like being now. Sub or dom known: jump to that script. Not jerking: fill ONLY missing age/location/job then the personal-permission beat then sell — still opportunistic, never as a checklist.
PHASE 2: After he agrees to a personal question, ask naturally: "are you usually the one taking control, or do you like being told what to do?" Only use "submitting like a good boy" if HE already uses that tone. Sub: "figured that a long time ago, it was just a matter of time till you were going to admit it. ready to finally surrender to me now?" Dom: "well in that case i just want to see if you can properly do it hehe, so are you going to prove yourself now?" Switch: "im kind of the same, but if you really were to decide, what do you feel like being now, letting me take charge or you doing it?" Fan submissive → dominant script. Fan dominant → submissive script.
PHASE 3 AFTERCARE after 3 sequence products: quoted aftercare lines in order, not as one dump unless the send requires it.
DEVIATION: answered + extra → answer the extra, save the planned fact, next unasked objective. Direct answers can continue in the same send. Wont answer → ack, skip that field, remember the next unasked objective. Completely off, jokes, refusals, unexpected replies, or an indirect vibe answer: react now and do NOT ask the next sequence question in that same send. Keep the next unasked objective pending for as many turns as needed. Resume it only when the transition feels natural. Never re-ask the same sequence question (rephrasing still counts). If none remain, stay in natural conversation — do not restart the sequence. Never send a standalone wait/hold on bubble. Unpaid locked drop: follow up, do not send another locked item unless he says he will buy the next one (once only). Mid-sequence PPV ask: sell that item then resume the sequence. Max 6 sequence drops, each priced higher than the last.`;

export function intakeComplete(opts: {
  extra?: Record<string, string>;
  location?: string;
  notes?: string;
  dominance?: string;
  boughtWelcome?: boolean;
}): boolean {
  const blob = `${opts.location ?? ""} ${opts.notes ?? ""} ${Object.values(opts.extra ?? {}).join(" ")}`;
  const extra = opts.extra ?? {};
  const age = Boolean(extra.fan_age) || /\b(fan_age|age\s*[:=]\s*\d{2})\b/i.test(blob);
  const city = Boolean(opts.location) || Boolean(extra.fan_city);
  const job = Boolean(extra.fan_job);
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
  if (looksLikeTeaseAsk(last) || looksLikeAreYouReal(last) || looksLikePetNamePushback(last))
    return false;
  if (looksLikeContentAsk(last)) return false;
  if ((opts.purchasedPpvCount ?? 0) >= 3) return false;
  if (opts.sequenceKind && opts.sequenceKind !== "STARTER") return false;
  if (opts.intent === "CONTENT_REQUEST" || opts.intent === "PURCHASE_INTEREST") return false;
  if (
    opts.intent === "PRICE_OBJECTION" ||
    opts.intent === "COMPLAINT" ||
    opts.intent === "REFUND" ||
    opts.intent === "UNSAFE"
  ) {
    return false;
  }
  if (opts.intakeComplete && (opts.intent === "SEXTING" || looksLikeSextAsk(last))) return false;
  const stage = opts.funnelStage ?? "";
  return stage === "NEW_FAN" || stage === "RAPPORT" || stage === "INTEREST" || !stage;
}
