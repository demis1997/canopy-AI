import {
  analyzePacing,
  applyPersonaCasing,
  resolvePersonaControls,
  validateQualityGrounding,
  validateReplyGrounding,
  type GenerationOutput,
  type OperationalRoute,
  type TurnDecision,
} from "@canopy/shared";
import { rankConversationResponses } from "./rank-responses.js";
import { validateProductsAndPrices } from "./validate-output.js";

type RankContext = Parameters<typeof rankConversationResponses>[1];
export type ReplyEvaluationContext = Omit<RankContext, "groundingCodes"> & {
  operational: OperationalRoute;
  decision: TurnDecision;
  catalog: Parameters<typeof validateProductsAndPrices>[1];
  guardOptions?: Parameters<typeof validateProductsAndPrices>[4];
  discountLimitPercent?: number;
  concessionAllowed?: boolean;
};

// Used by production generation and the live synthetic probe. No network or storage.
export function evaluateReplyCandidates(output: GenerationOutput, context: ReplyEvaluationContext) {
  const evaluations: {
    stage: "before-guards" | "after-guards";
    candidates: ReturnType<typeof rankConversationResponses>["evaluations"];
  }[] = [];
  const rank = (draft: GenerationOutput, stage: "before-guards" | "after-guards") => {
    const ranked = rankConversationResponses(draft, {
      ...context,
      groundingCodes: (reply) => {
        const grounding = validateReplyGrounding({
          reply,
          turn: context.turn,
          operational: context.operational,
          mode: context.decision.responseMode,
          recommendedProductId: draft.recommendedProductId,
        });
        const quality = validateQualityGrounding({
          reply,
          turn: context.turn,
          decision: context.decision,
          recommendedProductId: draft.recommendedProductId,
          pacing: analyzePacing(context.history),
        });
        return [...(grounding.ok ? [] : [grounding.code]), ...(quality.ok ? [] : [quality.code])];
      },
    });
    evaluations.push({ stage, candidates: ranked.evaluations });
    const controls = resolvePersonaControls(context.personaControls);
    ranked.output.replyOptions = ranked.output.replyOptions.map((option) => ({
      ...option,
      text: applyPersonaCasing(option.text, controls),
      messages: option.messages.map((message) => applyPersonaCasing(message, controls)),
    }));
    return ranked.output;
  };
  const beforeGuards = rank(output, "before-guards");
  const validation = validateProductsAndPrices(
    beforeGuards,
    context.catalog,
    context.discountLimitPercent ?? 10,
    context.concessionAllowed ?? false,
    context.guardOptions,
  );
  const guardedOutput = validation.output;
  validation.output = rank(validation.output, "after-guards");
  if (!validation.output.replyOptions.length) {
    validation.ok = false;
    validation.errors = [
      ...new Set([...validation.errors, ...validation.output.riskFlags, "NO_QUALITY_CANDIDATE"]),
    ];
  }
  return { validation, evaluations, beforeGuards, guardedOutput };
}
