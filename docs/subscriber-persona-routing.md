# Subscriber persona routing

Implemented on top of the existing conversation engine; no UI or approval/auto-send redesign.

## References and diagnosis

The originals in Downloads were available; the requested `(1)` copies were not. Both five-page PDFs were inspected structurally. `docs/reference/conversation-script-structures.json` records the six paid checkpoints, free-preview branches, purchase/ignore branches, endings and tone differences without dialogue. The softer reference uses more self-disclosure and reassurance; the assertive reference uses shorter, more directive delivery. Their opening role-routing instructions conflict. The application follows the requested subscriber preference mapping instead of copying those instructions. Mandatory messages, pressure around spending, and the reference prices are not imported into generation.

The existing engine already removes generic teasing from preferred phrases, scores repetition against recent assistant messages, and retries failed candidates. Missing pieces were a subscriber-scoped dynamic preference, routing shared by prompt construction and evaluation, and state carried into a new conversation. Legacy `ASK_SUB_DOM`/`ASK_PERSONAL_PERMISSION` intake could also contradict a known preference. That intake is now suppressed in production generation; the prompt explicitly prioritizes the new delivery variation over legacy dynamic labels. Existing age verification is independent.

## Detection and routing

`packages/shared/src/subscriber-persona.ts` exposes a deterministic, reusable detector and state reducer. It accepts only current conversational text and sent-message context, not demographics, identity fields, spending or the legacy dominance label. Explicit preferences receive a heuristic confidence score of 0.98; short unambiguous answers to a preceding preference question receive 0.85. These are rule strengths, not calibrated probabilities. Uncertain statements and occupational leadership are ignored. Unrelated preferences about a playlist or pizza do not replace an established conversational dynamic. The most recent explicit correction wins. Evidence stores bounded turn IDs, the detected preference and evidence source; it does not duplicate subscriber dialogue.

- `PREFERS_LEADING`: `SOFT_PLAYFUL`, softer characterization and subscriber-led pacing.
- `PREFERS_FOLLOWING`: `CONFIDENT_ASSERTIVE`, direct characterization and respectful conversational leadership.
- `UNKNOWN`, `NEUTRAL`, `FLEXIBLE`: default creator voice. Flexible does not imply a fixed role.

The overlay preserves profanity, casing, vocabulary, emoji/question limits, sales settings, creator identity and content boundaries. A preference never establishes consent. Existing non-graphic, age, consent, truthfulness and coercion safeguards still apply. `AVOID`, `MIRROR` and `ALLOW` retain their existing behavior; routing adds no profanity sanitization.

Unknown subscribers may receive one relevant, optional preference question during discovery/flirting. Observed sent questions are remembered, including recent messages in other conversations with the same creator/subscriber. Candidate evaluation rejects preference rediscovery after an answer or an observed question. Topic changes and ordinary conversation carry no mandatory discovery objective. Drafts alone do not count as sent questions.

## Persistence and commerce

Production generation reads and writes `FanNote.extra`, already unique to `(creatorId, subscriberId)` behind an organization-scoped conversation lookup:

- `subscriber_persona_v1`: preference, confidence, bounded evidence, active persona, observed question marker, latest turn/timestamp, explicit boundaries and objective.
- `subscriber_session_v1`: current stage/intent, last offered product/offer and status, confirmed purchased IDs, declined IDs, follow-up count/stage and sales opt-out.
- Existing conversation-specific session and progression keys remain intact.

A new conversation restores the subscriber session and routes from retained preference. A gap over three days reopens rapport without resetting preference. Turn IDs prevent duplicate evidence. Older sessions parse with defaults and backfill their last offer from recorded backend events without counting another offer. No database migration is needed: existing JSON storage supports these versioned records. The live probe confirmed the earlier `conversationControls` migration is applied.

Offers are replayed from real conversation offer records, purchases from backend purchase records. A conversational claim of payment does not confirm purchase. Declining an outstanding offer also remembers its product locally; unavailable, wrong-creator, already purchased and declined content remain blocked by existing catalog guards. Production content selection and prices still come from eligible creator catalog data and approved pricing. No reference-script content or price ladder is inserted into runtime requests. A purchase goes through confirmation and post-purchase conversation; another offer requires a fresh shopping request. Topic changes and opt-outs stop pitching. Existing follow-up and delivery permissions remain authoritative.

The same routing state is passed to prompt composition, candidate evaluation, generation diagnostics and analytics. Reply selection, approval, platform delivery and auto-send gates are unchanged.

## Verification

Full workspace suite: **466 passed, 7 skipped**. Shared, AI and web typechecks passed; ESLint and formatting checked on changed files. Existing price tests validate all reference price points only when supplied as catalog metadata, reject caption/price mismatches, wrong-creator/unavailable products and declined offers. New tests cover preference correction, contextual answers, uncertainty, unrelated topic preferences, state isolation, persistence, all profanity settings, boundaries, decline, backend-confirmed purchase, topic change, returning sessions, legacy-state compatibility, prompt routing and repeated-question rejection. A production generation test verifies persisted routing is restored and corrected while ignoring a conflicting legacy dominance label.

Live synthetic probe:

```sh
pnpm --filter @canopy/web exec node \
  --env-file=/Users/demis/canopy/.env.worker.local --import tsx \
  /Users/demis/canopy/apps/web/scripts/trace-synthetic-generation.ts \
  --routing --output /Users/demis/canopy/apps/web/.canopy-diagnostics/subscriber-routing-live-final.json --assert
```

Provider: Venice, endpoint `https://api.venice.ai/api/v1`. Configured and API-reported model: **venice-uncensored-1-2**. **11/11 cases passed**, covering the ten requested scenarios plus refusal to repeat preference discovery. Ten passed without corrective regeneration; the topic-change case passed after the existing question-limit guard rejected its first draft. The ALLOW fixture delivered the ordinary phrase “what the fuck” unchanged through production validation and bubble formatting.

The local diagnostic JSON includes exact system prompts, raw responses, evaluation results/rejection codes, routing/session facts and final synthetic delivery. It is git-ignored. No subscriber records were read, no preferences or purchases were written to production, and no messages were sent. Commerce events in this probe are explicitly synthetic backend fixtures; live payment processing was not exercised. Existing configured creator settings were preserved; the stored profiles resolve to MIRROR, and ALLOW cases use clearly labelled in-memory overrides.

## Limits

Detection currently targets conservative English patterns; ambiguous or unsupported phrasing stays unknown or preserves the existing preference. It is not a semantic classifier for every language. Persona consistency beyond explicit controls remains model-dependent. Follow-up events are reusable backend state transitions; this change does not add unsolicited follow-up scheduling. The observed-question marker is reconciled during generation from sent history; drafts are not delivery receipts. Concurrent updates to the same FanNote continue to use the existing application persistence behavior rather than introducing a new transactional memory store.

## Changed files

- `packages/shared/src/subscriber-persona.ts`: preference detector, routing overlay, subscriber memory and preference-question checks.
- `packages/shared/src/conversation-session.ts`: persisted intent, last offer/status, conversational declines and compatible hydration.
- `packages/shared/src/index.ts`: shared exports.
- `packages/ai/src/provider/types.ts`: routing state on generation input.
- `packages/ai/src/prompts/compose.ts`: route/objective injection and precedence over legacy dynamic intake; prompt v32.
- `packages/ai/src/pipeline/rank-responses.ts`: repeated preference-question rejection.
- `apps/web/src/server/generation/generate.ts`: scoped persistence, session restoration, backend-event reconciliation, routed controls, diagnostics and legacy-intake suppression.
- `packages/ai/src/eval/subscriber-routing-fixtures.ts`: eleven synthetic live scenarios.
- `apps/web/scripts/trace-synthetic-generation.ts`: `--routing` probe using production evaluation and the configured live provider.
- `packages/shared/tests/subscriber-persona.test.ts`: detector, overlay and state regressions.
- `packages/ai/tests/live-trace-regression.test.ts`: routed prompt/policy/profanity tests.
- `packages/ai/tests/session-integrity.test.ts`: preference rediscovery rejection with review preserved.
- `apps/web/src/server/generation/generate.progression.test.ts`: production persistence and preference-correction integration.
- `docs/subscriber-persona-routing.md`: implementation, reference findings, validation and limits.
