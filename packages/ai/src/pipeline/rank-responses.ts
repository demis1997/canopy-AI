import { conversationPolicyCodes } from "../safety/conversation-policy.js";
import {
  evaluateConversationResponse,
  type ConversationIntent,
  type GenerationOutput,
  resolvePersonaControls,
  personaStyleCodes,
  type PersonaControls,
  type ConversationSession,
} from "@canopy/shared";

export function rankConversationResponses(
  output: GenerationOutput,
  context: {
    turn: string;
    history: { authorType: string; body: string }[];
    intent?: ConversationIntent;
    prohibitedWords?: string[];
    personaControls?: Partial<PersonaControls>;
    session?: ConversationSession;
    messageLength?: string;
    groundingCodes?: (reply: string) => string[];
  },
) {
  const evaluations = output.replyOptions.map((option, index) => ({
    index,
    ...evaluateConversationResponse({ reply: option.text, ...context }),
  }));
  for (const evaluation of evaluations) {
    const text = output.replyOptions[evaluation.index]!.text.toLowerCase();
    if (
      context.session?.stage === "CONCLUSION" &&
      /\?/.test(output.replyOptions[evaluation.index]!.text)
    ) {
      evaluation.codes.push("QUESTION_AFTER_CONCLUSION");
      evaluation.score = 0;
    }
    const wordLimit =
      context.messageLength === "SHORT" ? 35 : context.messageLength === "MEDIUM" ? 70 : 110;
    if (context.messageLength && text.split(/\s+/).filter(Boolean).length > wordLimit) {
      evaluation.codes.push("PERSONA_MESSAGE_LENGTH");
      evaluation.score = 0;
    }
    const policyCodes = conversationPolicyCodes(text);
    const styleCodes = personaStyleCodes(
      output.replyOptions[evaluation.index]!.text,
      context.turn,
      resolvePersonaControls(context.personaControls),
    );
    if (policyCodes.length || styleCodes.length) {
      evaluation.codes.push(...policyCodes, ...styleCodes);
      evaluation.score = 0;
    }
    const groundingCodes =
      context.groundingCodes?.(output.replyOptions[evaluation.index]!.text) ?? [];
    if (groundingCodes.length) {
      evaluation.codes.push(...groundingCodes);
      evaluation.score = 0;
      evaluation.relevance = 0;
    }
    if (context.prohibitedWords?.some((word) => word.trim() && text.includes(word.toLowerCase()))) {
      evaluation.codes.push("PERSONA_PROHIBITED_WORD");
      evaluation.score = 0;
    }
  }
  const ranked = evaluations
    .filter((e) => e.score >= 60 && !e.codes.includes("GRAPHIC_CONTENT"))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const replyOptions = ranked.map((e) => output.replyOptions[e.index]!);
  return {
    evaluations,
    output: replyOptions.length
      ? { ...output, replyOptions }
      : {
          ...output,
          replyOptions: [],
          recommendedProductId: null,
          approvedPrice: null,
          recommendedAction: "REQUEST_HUMAN_REVIEW" as const,
          requiresHumanReview: true,
          riskFlags: [
            ...new Set([
              ...output.riskFlags,
              "CONTEXT_REGEN_REQUIRED",
              ...evaluations.flatMap((e) => e.codes),
            ]),
          ],
        },
  };
}
