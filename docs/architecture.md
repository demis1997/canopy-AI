# Architecture and execution boundaries

Canopy is a private pnpm monorepo with a Next.js web app, a Chrome extension, and three runtime packages. It does not need microservices or a general plugin framework. The web process and two workers share the database; Redis transports background jobs.

## Ownership

- `apps/web/src/app` owns framework routes and pages. Routes authenticate, authorize, validate input, call a server service, and translate the result into HTTP.
- `server/generation` coordinates fan-turn generation and reply selection. `generate.ts` preserves ordering of safety/handoff checks, bounded recent history, product eligibility, retrieval, provider calls, validation, and persistence. `replies.ts` handles selection/editing and subsequent summary/memory jobs. `messages.ts` records incoming fan messages. The index exposes the existing service function names without an extra factory or class hierarchy.
- `server/ai-provider.ts` resolves organization configuration and exact-provider credentials for both request and background paths. No HTTP concerns belong here. Tenant-owned configuration wins over global configuration; tenant credentials, matching environment credentials, then matching global credentials are considered. It never searches all providers for the newest key.
- `server/jobs/contracts.ts` validates tenant IDs and fields required by each supported job. `queue.ts` owns transport, IDs, debounce replacement, retries, Redis connection lifecycle, and worker creation. `dispatch.ts` routes validated jobs. Handlers own conversation, platform, or provider-health side effects. Both inline and Redis execution use the same dispatcher.
- `server/automation` owns action state, operator review and delivery gates. `platform/runner.ts` owns inbox synchronization and external sends through an adapter; it verifies account/fan identity and retains account leases. `platform-catalog.ts` imports source metadata and reconciles explicit receipts without guessing purchases from prices.
- `packages/ai` owns provider protocols, model prompts, output validation, training retrieval and synthetic evaluation. `packages/shared` owns pure domain rules and contracts. `packages/database` owns schema, migrations, encryption and query-scoping helpers. None of these packages imports the Next.js application.

## Important execution paths

**Fan turn:** HTTP route checks user permissions → tenant conversation lookup → fan message persistence → generation safety and handoff checks → pending fan-turn context → organization provider → validated suggestions → operator selection or configured demo flow → outgoing messages → summary and memory jobs. User/assistant roles are preserved in model context. An already answered trigger exits before provider setup.

**Platform inbox:** platform worker selects an authorized account → adapter verifies account identity → source messages are sorted and imported with authoritative sender IDs → outgoing messages close the pending fan turn → generation is queued only after the complete imported turn → automation action is reviewed/scheduled → due action is atomically claimed → account/fan/gates/lease are rechecked → provider send uses a stable bubble idempotency key → verified outgoing bubbles are persisted → action is marked sent. Lost lease ownership prevents the next external send; ambiguous delivery is not automatically retried.

**Catalog:** authenticated product route validates account ownership → a persistent sync run is queued → account sync lease is acquired → paginated vault/posts/paid-message offers are imported as drafts → only a successful complete scan retires unseen items. Source prices and references remain separate from operator settings. Catalog/worker queries must retain organization and account scope.

## State and reliability tradeoffs

The queue remains BullMQ rather than introducing another service. Web producers use bounded connection retries and fail promptly; workers use reconnecting connections. Redis errors never cause a production request to silently process a job inline. Inline mode exists only when Redis is not configured and deliberately has no queue scheduling semantics. On shutdown, the background worker finishes active jobs before closing Redis and Prisma connections.

A completed/failed debounce job must be removed before its ID can represent a later fan turn. Waiting/delayed jobs are replaceable. An active job must retain its lock; a new trigger gets a distinct stable ID. Database action idempotency and stale-turn checks remain necessary because queue debounce is not an exactly-once guarantee.

Provider transport retries belong to the provider. Application generation retries only malformed JSON once, rather than multiplying an exhausted network retry budget. Retry and timeout configuration is bounded and rejects malformed numeric values. Unknown model provider names fail explicitly. Model keys are never logged.

Tenant helpers are useful but do not make direct Prisma queries automatically safe. Workers must validate organization scope before reading summaries, resolving a conversation, following an account/thread link, or updating health. Platform-global AI configuration is an explicit fallback; a tenant health job cannot modify it or other tenants' rows. Existing schemas and HTTP response contracts are unchanged by this refactor.

## Performance verification

Reply edit distance retains exact UTF-16 Levenshtein results. Its time complexity remains `O(m*n)`; working memory changes from `O(m*n)` matrix cells to `O(min(m,n))` cells in two reusable rows. An equality fast path avoids all matrix work for unedited replies. Tests compare the implementation against the former matrix algorithm across empty, unequal, accented and surrogate-pair inputs.

Reproduce the synthetic benchmark with `pnpm --filter @canopy/web benchmark:edit-distance`. On the local Node 24.19.0 runtime, median of five runs at 2,000 characters per input measured approximately 120.84 ms / 32,799,272 allocated heap bytes for the matrix, and 19.92 ms / 32,728 bytes for two rows. The two implementations returned distance 625. These are local synthetic measurements, not production latency or resident-memory guarantees. Garbage collection and warm-up affect timings; the complexity change is the reason for the refactor.

## Remaining boundaries

Generation remains a substantial ordered workflow; splitting individual conditionals into classes would obscure its sequencing. Database catalogs and conversation offers can still grow large. Follow-on performance work should profile real catalog sizes and preserve purchase/media eligibility semantics. Schema changes, distributed rate limits, transaction-wide reply selection, and full ambiguous-delivery reconciliation are separate behavioral projects, not implied by this structure.
