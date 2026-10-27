# Qwen conversation pipeline: implementation audit and changes

This is an engineering trace for the non-graphic conversation path, inspected on 2026-10-26. Reference documents contribute structural observations only; their dialogue, mandatory steps, coercive ignore branches and price ladders do not become runtime instructions or catalog entries.

## Root causes confirmed in code

The earlier implementation already corrected mandatory teasing in the system prompt and stopped production guard fallbacks from inserting stock replies. The remaining failures were spread across application layers:

- `packages/shared/src/replies.ts` lowercased the first character of every generated bubble during schema normalization. This destroyed creator-specific casing before persona-aware evaluation.
- `looksLikeSextAsk` and `containsSexualLanguage` treated standalone `fuck` as sexual intent/language. A casual complaint could enter the wrong response mode or have an otherwise permitted reply rejected.
- `packages/ai/src/safety/index.ts` used `traffic(?:k)?(?:ing)?` for exploitation detection. It matched ordinary road traffic and blocked generation before the model was called. The pattern now distinguishes traffic from trafficking and retains exploitation checks.
- Romantic progression did not remember declined product IDs, persist a sales opt-out, distinguish a backend purchase from a model recommendation, or represent conclusion/follow-up objectives.
- Price validation checked limits but could clamp an offer amount while leaving a conflicting price in its caption. Production validation now rejects mismatches, missing offer prices, and previously declined items.
- Generation sent temperature but no explicit top-p, diversity penalty or output-token limit. The model's actual serving defaults and capabilities could not be inferred from its name.
- The prompt's short history window could omit some of the last ten creator messages even though evaluation queried them separately. The prompt now receives that explicit reference list as well as a bounded contiguous recent context.

These are demonstrated application bugs. The work does not establish Qwen as the cause, claim that higher temperature is better, or claim that all semantic repetition is detected.

## Complete request, response and delivery trace

1. **Entry and tenant scope.** Web/extension API routes call `generation/generate.ts`; subscriber-message handling also enters through `generation/messages.ts` and `handleFanTurn` in `generation/replies.ts`. `requireTenant`, tenant-scoped conversation lookup, active persona lookup, organization suspension and missing-input checks run first. `collectPendingFanTurn` combines consecutive subscriber messages and refuses answered triggers. Origin: tenancy, authorization and conversation integrity.
2. **Pre-generation policy.** `packages/ai/src/safety/index.ts` checks age status, minor language, exploitation, threats, self-harm, credentials and private-address requests. Prompt-injection handling and operational routing can stop generation. `operational-handoff.ts` persists human requests/AI suspicion and automation pauses. These are policy/operational restrictions, not voice preferences.
3. **Backend context and commerce.** `generate.ts` loads verified/unverified memory, fan notes, approved training, eligible creator products, ownership, purchases, open offers, price ladders, sequence position, operator rejections and thread lessons. Unverified memories remain labelled as guesses. `eligibleProducts`, `pricing/concession.ts`, `matchSellTarget`, `nextLockedDropPolicy`, and existing intake/funnel functions influence available actions. Origin: catalog, creator configuration, purchase records and business rules. Reference PDF prices are absent from this path.
4. **Persistent conversational state.** Romantic state remains separate from intake. `conversation-session.ts` now synchronizes actual sent offers, declined products and confirmed purchases, then handles the complete fan turn. Voice controls and a persistent opt-out constrain pitching. A model cannot confirm a purchase, unlock content or deliver media through a response field.
5. **Prompt construction and retrieval.** `training/retrieve.ts` ranks approved examples and excludes incompatible legacy scripts. `prompts/compose.ts` constructs system instructions, independent non-graphic/age/consent rules, creator persona and style controls, turn mode, current state objective, memories, summary, operator feedback and catalog/pricing context only when permitted. `prompts/context.ts` selects a contiguous recent history up to 32 messages/16,000 characters; the complete pending turn and ten recent creator lines are also supplied separately. History selection does not claim a token-exact model budget. Persona fields and fan messages are data, not authority to disable safeguards.
6. **Provider and HTTP request.** `server/ai-provider.ts` resolves tenant provider configuration and matching credentials. `provider/factory.ts` selects Venice, OpenRouter, OpenAI-compatible transport or mock mode. `openai-compatible.ts` re-exports `VeniceLLMProvider`; there is no separate hidden Qwen client. `venice.ts` sends Chat Completions JSON requests with model, roles, temperature, top-p, frequency/presence penalties, token limit and optional explicitly enabled repetition penalty. Circuit breaking, transport retries and configured fallback models can repeat requests, but do not insert conversation copy. Origins: deployment configuration and endpoint capabilities.
7. **Response parsing and repair.** `extractJsonObject` strips fences and extracts the outer object. `generationOutputSchema` coerces enums/booleans/prices, keeps up to three options, and normalizes bubbles. The transport contract still caps three bubbles at 280 characters each; this can truncate excessive output. Normalization now preserves case. Invalid JSON causes a repair request with original context and the failed output; exhausted parse errors follow the provider error path. Origins: response schema and transport contract. Repair is formatting recovery, not permission to change policy.
8. **Post-generation policy and candidate selection.** Safety checks run on returned options and again after corrective generation. `rank-responses.ts` applies `safety/conversation-policy.ts` independently of persona preferences, then quality scoring, prohibited vocabulary, style limits and existing grounding checks. Non-graphic/truthful/coercion rules cannot be relaxed by allowing casual profanity. Repetition includes the last ten actual creator messages; rhetorical loops, generic deflections, emoji saturation, unanswered interest and consent pacing are evaluated. These are bounded heuristics, not a semantic guarantee.
9. **Guards and sanitizers.** `pipeline/validate-output.ts` contains offline/TOS, pet-name pushback, refund, creator relationship/age/location, about-fan speaker inversion, confirmed/unconfirmed mixup, waiting/reveal, intake/sequence closer, stale AI-suspicion copy, meta-tease, invented-location, repeated/rejected draft, dominance consistency, premature-pitch and aimless-rapport branches. Other transformations strip repeated intake objectives and filler, unauthorized pet names, operator-banned catalog mentions, early-pitch/catalog/price text, wrong sell-target names, and direct-unlock phrasing. Parsing also scrubs offline meeting wording. Origins differ: safety/platform assumptions, creator/fan boundaries, operator corrections and legacy agency sales style. Production `contextualRecovery` requests regeneration instead of replacing a rejected candidate with canned pools; legacy callers retain compatibility behavior. Any surviving transformations are checked again by ranking.
10. **Price and product integrity.** `validateProductsAndPrices` checks creator ownership, availability, previous ownership/resale rules, configured floors, ceilings, discount ladder and caption amounts. The production path requires an approved amount matching the backend price and every dollar quote matching that amount. A rejected product/price returns no sendable candidate and supplies corrective codes. Origins: authoritative catalog and pricing configuration. The old concession behavior remains available to legacy callers.
11. **Corrective retry, staleness and persistence.** One context-aware corrective generation receives the actual failure codes. If it still fails, no option is returned and human review is required. A newer fan or creator message causes stale handling. Generation diagnostics record state, sampling, individual candidate evaluations, provider attempts and elapsed pipeline time; these are observations, not purchase forecasts. Approval-required generation records and operator acceptance/edit/rejection handling remain intact. `generation/replies.ts` can split accepted text into bubbles, record message/reply outcomes, create offers, move the legacy funnel and enqueue summary/memory jobs. Operator rejections persist as thread lessons. Manual edits are operator input, not model-approved policy output.
12. **Final platform sending.** `automation/service.ts` evaluates autonomy mode, policy, human takeover, stale triggers, confidence, rate limits, product approval, ownership and price restrictions. It repeats delivery preflight before execution. `platform/runner.ts` checks account/fan identity, locks and ownership, rechecks gates between bubbles, attaches paid media only to the last bubble, requires verified API delivery for PPV and persists each delivered bubble. `onlyfans-api-adapter.ts`/`onlyfans-api-client.ts` provide API transport; browser adapter paths verify sends separately. The extension inserts text in the platform composer; insertion is not proof of external delivery. This change does not grant auto-send permission or change payment/access execution.
13. **Longer-term memory.** `jobs/handlers/conversation.ts` summarizes up to 30 recent messages and extracts facts from up to 12. Extraction accepts fan source IDs and known categories, rejects low-confidence facts and labels new memories unverified. Generated summaries can still be imperfect and are background context. Session opt-out/decline/purchase state uses explicit structured backend state instead of relying on that summary.

## Configurable creator controls

The new `CreatorPersona.conversationControls` JSON column has defaults for existing records. `personaControlsSchema` validates directness, neutral/confident/soft/assertive characterization, playfulness, casual profanity (avoid/mirror/allow), casing (preserve/lowercase), emoji frequency, preferred/avoided vocabulary, pacing, question limit, sales enablement and bounded offer/follow-up limits. Existing personality/tone, dominant/submissive style, message-length and boundary fields remain available. No UI redesign is necessary: settings are accepted by the existing authorized creator-persona API and carried through the existing form's initial state. Partial PATCH requests preserve other settings, and old dashboard payloads do not erase the new controls.

For example, PATCH `/api/creators/<creator-id>/persona` in an authenticated session with:

```json
{
  "conversationControls": {
    "directness": "DIRECT",
    "characterization": "CONFIDENT",
    "casualProfanity": "ALLOW",
    "casing": "PRESERVE",
    "pacing": "RESPONSIVE",
    "emojiFrequency": "OCCASIONAL",
    "preferredVocabulary": ["lovely"],
    "maxQuestions": 1
  }
}
```

Directness, emotional tone and vocabulary preference guide generation; they are not permissions for graphic content, deception, age bypasses or coercion. Profanity/emoji/question/vocabulary limits are checked against each candidate. Response length follows SHORT/MEDIUM/LONG word budgets within the unchanged transport cap. Casing is the sole intentional style transform; other voice violations request regeneration rather than euphemism substitution. Semantic persona consistency still needs live model evaluation and creator review.

## Reusable session states and event authority

The state machine supports opening, preference discovery, rapport, flirting, approved free-content discussion, PPV offer, backend purchase confirmation, post-purchase engagement, optional additional offers, conclusion and follow-up. Each has a distinct prompt objective. Negative responses, topic changes, explicit boundaries and disengagement interrupt the commercial flow. A sales opt-out persists until an explicit new shopping request; a short agreement does not reset it. Previously declined products are excluded and validated again.

Actual sent offers and confirmed purchases synchronize from tenant-scoped application records during generation. `FREE_CONTENT_SENT`, `NO_RESPONSE` and `RETURNING_SUBSCRIBER` are explicit reusable backend events; free media and silence never come from a model's recommendation. Returning state is initialized from existing conversation activity. These changes do not add new autonomous timers or schedule unsolicited follow-ups: existing jobs/send policies remain responsible. The reducer tracks a bounded follow-up sequence when invoked with a no-response event, and normal generation still skips without a pending fan turn. Free-content events require a delivery integration to call them after verified approved-media delivery; no delivery is fabricated.

The implementation deliberately does not convert free text into payment state or replay the reference scripts' mandatory steps. Controls limit offers and follow-ups, and casual conversation does not need to reach a sale.

## Generation settings and comparison

Validated deployment settings are documented in `.env.example`: `AI_TEMPERATURE`, `AI_TOP_P`, `AI_FREQUENCY_PENALTY`, `AI_PRESENCE_PENALTY`, `AI_MAX_OUTPUT_TOKENS`. The nonstandard `AI_REPETITION_PENALTY` is sent only after explicit `AI_REPETITION_PENALTY_SUPPORTED=true`; endpoint support is not inferred from a Qwen model name. The generic extension is supported by [vLLM's server API](https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/), but that does not establish support for a particular hosted Venice/OpenRouter model. JSON repair retains configured limits; classification and memory calls keep their own behavior. Defaults are initial settings to evaluate, not measured optimal values.

Run `pnpm --filter @canopy/ai eval:architecture` for a reproducible comparison against commit `e842ca09`. It loads baseline code from Git and executes baseline/current functions on the same non-graphic fixtures. It verifies preservation of casing, separation of casual profanity from sexual language/request detection, and the traffic false-positive fix; it also exercises four authored voice fixtures and six session scenarios. Its elapsed time is local deterministic evaluation time, not Qwen inference latency. The test fixtures are not represented as model-generated conversations.

Observed before/after examples:

- Model draft fixture: `Damn, that sounds awful.` Before normalization: `damn, that sounds awful.` After: original casing preserved unless the creator selected lowercase.
- Fan turn: `Fuck this traffic`. Before: sexual-request and sexual-language detectors matched; the complete pipeline also blocked it because of the traffic pattern. After: ordinary conversation; permitted casual vocabulary stays intact when configured.
- Shopping fixture: offer amount `$15`, caption `$200`. Before: caption/amount disagreement could pass product validation. After: `PRICE_TEXT_MISMATCH`, contextual retry, and no sendable draft if unresolved.
- Fan: `No more offers, just want to chat`, then `yes`. Before: no durable session opt-out. After: persistent opt-out with a rapport objective and pitching disabled.
- Soft versus assertive voice fixtures differ in wording while taking the same state transition. This proves style-preserving processing, not that a live model will always maintain a nuanced persona.

## Local validation and deployment

1. Install the repository's dependencies and configure the normal development environment.
2. Apply the new additive migration to the intended development database: `pnpm db:migrate`. Do not point a development check at a production database.
3. Generate Prisma types: `pnpm db:generate`.
4. Run `pnpm test`, the workspace typechecks, and targeted ESLint/Prettier checks. Database/browser/platform tests remain conditional on their configured services.
5. Run `pnpm --filter @canopy/ai eval:architecture`. A shallow clone needs the baseline commit available; override `CANOPY_EVAL_BASELINE` deliberately when comparing another known baseline.
6. Configure a test creator's persona controls and exercise ordinary chat, clear interest, an explicit boundary, a shopping request, a declined offer and a confirmed purchase with the existing approval workflow.

The new database migration was authored and Prisma client generation/validation was run. Applying it to a running database and live Qwen/vendor latency evaluation are deployment/integration steps, not claims made by the deterministic suite. No live messages, content purchases or platform sends are part of the evaluation.
