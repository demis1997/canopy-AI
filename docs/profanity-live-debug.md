# Live ordinary-profanity investigation, 2026-10-27

## Runtime facts checked

- GitHub reports successful production deployments of commit `5e012d0a` to both web projects. This was the deployed code baseline inspected before the fix.
- The database selected by the worker's existing remote environment contains the completed `20261026120000_persona_conversation_controls` migration and the actual `conversationControls` column. No migration was applied by this investigation.
- The active tenant provider configuration selects `venice-uncensored-1-2` at `https://api.venice.ai/api/v1`. The real provider catalog includes it, and all eight final live responses reported that same model ID. The service does not expose a verified Qwen base-model identity here; the model must not be described as confirmed Qwen solely because this repository calls the engine Qwen-compatible.
- All five active personas have stored `conversationControls: {}`, resolving to `casualProfanity: "MIRROR"`. No active persona was actually configured as `ALLOW`. The synthetic ALLOW fixtures explicitly override that setting only in memory. Real creator settings were not changed.
- One stored persona preferred the phrase `you're trouble`, contradicting the global anti-deflection instruction. No tested persona had a banned-profanity list or an explicit clean-language instruction.
- Vercel production environment-variable inspection returned HTTP 403. Database-selected model/endpoint and completed deployment state were verified, but a direct comparison of the hosted web process's environment against the worker profile was not possible. Sampling in the live probe comes from the existing worker environment plus the provider factory defaults, not a claim to have read inaccessible Vercel variables.

## Exact sources and fixes

`packages/shared/src/replies.ts::looksLikeSextAsk` and `operational-intent.ts::containsSexualLanguage` still matched ordinary `fuck` idioms. The previous narrow exceptions handled `fuck this` and some modifiers, but not `what the fuck`, `oh fuck`, or `for fuck's sake`. Live baseline traces show these fan turns entering EXPLICIT mode. The same detector is also used by grounding, natural-mode quality validation, and reply guards, so it could reject an otherwise permitted natural response with `SEXUAL_NOT_ALLOWED`.

The shared `casual-language.ts::maskCasualProfanity` now masks clearly non-sexual idioms only for classification/policy inspection, never in delivered text. Directed sexual targets are excluded from masking. Both detectors and the non-graphic policy share this interpretation. Regression tests verify ordinary idioms stay NATURAL and directed sexual requests remain restricted. Age, exploitation, consent and product checks were not removed.

`prompts/compose.ts` had two additional conflicts: an unconditional commercial objective in ordinary conversation, and repeated preferred catchphrases that the evaluator would reject. Ordinary turns now have no commercial objective and banned generic deflections are omitted from preferred phrases. No stored persona record was edited.

The baseline live context fixture exhausted both generation attempts because the provider kept asking questions after two question-led creator turns. Simply adding a zero-question constraint to the system prompt still failed once. Repeating the current turn's constraint in the final generation instruction succeeded; the final full suite passed the same context fixture. The constraint is derived from conversation pacing and creator limits. No canned replacement response was inserted and no model response was altered to remove profanity.

The creator form now exposes the existing casual-profanity setting, so an authorized operator can deliberately choose ALLOW/MIRROR/AVOID instead of having the setting exist only in an API payload.

Venice documents an additional provider system prompt enabled by default. Canopy does not explicitly disable it, and the API does not return its contents. The trace captures the exact application request, not an unverifiable reconstruction of Venice's internal prompt. This investigation did not disable the provider's prompt or attribute any specific refusal to that hidden content. See [the official Venice API specification](https://github.com/veniceai/api-docs/blob/main/api-reference/api-spec.mdx).

## Actual model integration results

The before run used seven synthetic cases and the real configured provider. Six delivered a valid response. The context fixture failed after both attempts were rejected for repeated questions. Several non-sexual fan turns were incorrectly routed EXPLICIT. The provider did produce ordinary profanity, disproving a blanket provider ban in those tested cases.

The final run used eight synthetic cases, including an extra natural-mode response test without a full swear word in the fan turn. All eight passed, all entered NATURAL mode, and all used `venice-uncensored-1-2`. There were eight actual generation responses and no corrective generation in that final run. AVOID remained a separate control case. ALLOW means profanity is permitted, not required on every turn.

Examples from the actual final responses, unchanged by profanity substitution:

- Requested ordinary blunt reaction: `What the fuck! That's really annoying.`
- Requested ordinary adjective: `That was fucking exhausting, huh?`
- Context after repetitive questions: `Sorry to hear that. That's frustrating.`

The final text was delivered to a synthetic memory sink after the same shared candidate evaluator and bubble splitting used by production. No subscriber data was read, no database fixtures or messages were written, and no external platform send occurred. These tests verify real model requests plus production response evaluation, not end-to-end platform delivery to a real account.

## Logs and reproduction

Full local traces live under the git-ignored `apps/web/.canopy-diagnostics/` directory:

- `profanity-before.json`: complete app system prompts, raw responses, parsing, safety and rejection details before the fix.
- `profanity-after.json`: intermediate run that still failed the context case; retained as evidence of that failed approach.
- `profanity-context-retest.json`: focused successful context retest.
- `profanity-final.json`: eight final passing cases with grouped quality, policy, persona, grounding and constraint results, guard outputs and final synthetic delivery.
- `profanity-live-report.md`: readable rendering of the final full prompts, raw responses and validation results.

Tracing is explicitly enabled per synthetic call. There is no production environment switch that dumps live subscriber prompts or completions. Keys, authorization headers and database URLs are excluded. The diagnostic callback cannot alter generation if logging fails.

From the repository root, with an authorized environment profile configured:

```sh
pnpm --filter @canopy/web exec node --env-file=../../.env.worker.local --import tsx scripts/trace-synthetic-generation.ts --output .canopy-diagnostics/profanity-live.json --assert
```

The script refuses mock mode and an absent/unavailable configured model. With multiple organization configurations, provide `--organization <authorized-organization-id>`. The synthetic trace uses only stored creator controls; persona biography, subscriber history, memories and purchased content are not used. `--case ordinary-follow-up` runs just that regression.

`packages/ai/src/pipeline/evaluate-replies.ts` is shared by production generation and the live probe. Each candidate logs independent code groups for quality, content policy, persona, grounding and turn constraints. Provider tracing records the outbound system/messages, unparsed text, reported model, finish reason and parse outcome, including JSON repair attempts.

Run `pnpm test` and workspace typechecks for deterministic regression coverage. Network-dependent live tests are opt-in and are not run against subscriber accounts.
