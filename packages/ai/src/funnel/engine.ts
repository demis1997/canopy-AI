import {
  canTransition,
  playbookFor,
  recommendedActionFor,
  type FunnelStage,
  type Intent,
} from "@canopy/shared";
import { OFFER_COOLDOWN_MS, MAX_OFFERS_PER_DAY } from "@canopy/shared";

export type FunnelState = {
  stage: FunnelStage;
  lastOfferAt: Date | null;
  offerCountToday: number;
  rapportPriority: boolean;
};

export function offerCooldownActive(state: FunnelState, now = new Date()): boolean {
  if (state.offerCountToday >= MAX_OFFERS_PER_DAY) return true;
  if (!state.lastOfferAt) return false;
  return now.getTime() - state.lastOfferAt.getTime() < OFFER_COOLDOWN_MS;
}

export function resolveFunnel(input: {
  state: FunnelState;
  intent: Intent;
  suggested: FunnelStage | null;
}): { stage: FunnelStage; playbook: string; action: ReturnType<typeof recommendedActionFor> } {
  const cooldown = offerCooldownActive(input.state);
  let stage = input.state.stage;
  if (input.suggested && canTransition(stage, input.suggested)) {
    stage = input.suggested;
  }
  const action = recommendedActionFor({
    intent: input.intent,
    stage,
    offerCooldownActive: cooldown,
    rapportPriority: input.state.rapportPriority,
  });
  return { stage, playbook: playbookFor(stage, input.intent), action };
}
