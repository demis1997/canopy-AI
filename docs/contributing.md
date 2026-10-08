# Contributing

Use Node 22 and pnpm 9.4.0. Follow the README setup and keep local `.env` files untracked. Install with `pnpm install --frozen-lockfile`; dependency changes must include `pnpm-lock.yaml`. PostgreSQL needs pgvector. Redis and workers are needed to verify queued catalog imports and delayed execution.

## Before changing behavior

Check Git status, read the relevant feature and tests, then run `pnpm check` and `pnpm build`. Note skipped local service tests separately from passing tests. `CI=1 pnpm test` requires database/browser fixtures to run; it intentionally fails if their services are unavailable. Do not provide real model API keys during ordinary checks. UI tests require a seeded development database and Chromium (`pnpm --filter @canopy/web exec playwright install chromium`).

Run `pnpm format` after edits and `pnpm lint` before handing over changes. Type checking includes workspace tests, web scripts and browser UI tests, not only production sources. CI also builds the Chrome extension and runs UI flows. The shared root TypeScript configuration is strict; package configurations add only their runtime-specific settings.

## Keep changes focused

Routes are transport boundaries. Keep model/service orchestration in the server modules, pure rules in `packages/shared`, and provider-specific protocol code in `packages/ai` or `platform`. Add a new abstraction only when it removes a real coupling or makes an existing contract explicit. Preserve service exports, source sender roles, pricing/media validation, review gates and delivery locks when moving code.

Every job needs a supported name and payload schema in `server/jobs/contracts.ts`. A handler must verify tenant ownership before reading or writing related data. Do not silently ignore malformed jobs. Do not put API keys, private chat text, cookie data, or provider response bodies in logs. Use synthetic examples and IDs in tests and documentation.

Use fixtures or mocks for model and provider calls. Add regression tests for changed decisions, tenancy boundaries and state transitions. For a performance change, compare results against the previous behavior and record input sizes, time/space complexity, and a reproducible measurement; do not assert noisy wall-clock timing in unit tests.

## Deployment review

The Vercel root is `apps/web`; build commands in `apps/web/vercel.json` generate Prisma, apply migrations and build Next.js. The separate background-worker entry is `src/server/jobs/worker.ts`; the platform entry is `src/platform/cli.ts`. Update these script paths when moving files. No Docker application image exists: `docker-compose.yml` supplies development services only.

Review migrations and production environment configuration before deploying. Do not seed production with demo credentials. Worker and web encryption keys must match. Do not automatically resend ambiguous external deliveries or bypass live identity/safety checks to make tests pass.
