# Canopy

Canopy is an AI reply and sales copilot for adult-content creators and agencies. It keeps creator personas, fan conversations, approved training, and product catalogs within organizations. Operators can review, edit, reject, or insert suggestions. Model responses are checked against deterministic safety, product, price, and conversation rules.

The optional OnlyFansAPI connection imports vault media, paid posts, and paid outgoing messages as draft products, syncs the inbox, and delivers approved messages. New connections use COPILOT mode and require review. The provider is a third party; live account behavior requires separate verification. The browser adapter is an unverified prototype and is disabled by default.

## Architecture

```text
apps/
  web/                       Next.js App Router UI, HTTP routes, server services
    src/server/generation/   Generation orchestration, reply selection, edit distance
    src/server/jobs/         Validated job contracts, Redis transport, focused handlers
    src/server/automation/   Review, safety gates, action state and delivery persistence
    src/platform/            OnlyFansAPI/browser/mock adapters and persistent inbox worker
  extension/                 Chrome Manifest V3 extension and demo adapter
packages/
  ai/                        Model providers, prompts, validation, training retrieval and eval
  database/                  Prisma schema/migrations, tenant helpers and encryption
  shared/                    Zod schemas, permissions and pure conversation/catalog rules
  config/                    Optional shared TypeScript configuration
```

See [architecture and execution paths](docs/architecture.md) and [contributing](docs/contributing.md). HTTP routes handle authentication and request validation; server services perform orchestration. The database helpers provide scoped queries, but every new query and job still requires an explicit tenancy review.

## Requirements and setup

Use Node 22 (`.nvmrc`), pnpm 9.4.0 (`packageManager`), and Docker Compose for PostgreSQL with pgvector and Redis. Dependencies are locked in `pnpm-lock.yaml`.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` before continuing. Generate separate private values for `AUTH_SECRET` and the 64-character hex `APP_ENCRYPTION_KEY` with `openssl rand -hex 32`. Leave model API keys empty to use the mock provider. Copy the completed local configuration to the two processes that read it:

```bash
cp .env apps/web/.env
cp .env packages/database/.env
docker compose up -d --wait
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Seeding creates fictional demo adults and demo logins; use it on a development database. The local demo password is `CanopyDemo!2026`. Example accounts are `owner@demo.canopy`, `chatter1@demo.canopy`, and `admin@canopy.dev`. Do not expose a seeded development database as production.

Workers run separately on a persistent host:

```bash
pnpm worker             # BullMQ jobs; reads apps/web/.env
pnpm platform:worker    # Inbox polling, receipt sync and scheduled delivery
```

Without `REDIS_URL`, supported jobs run inline. Inline processing does not provide delayed execution or queue debounce. Catalog imports require Redis and the background worker. Keep Redis configured for production; producer errors are surfaced instead of silently switching transports.

## Model configuration

Set `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`, or configure the provider in **AI provider** as an authorized user. Supported provider names are `venice`, `openrouter`, and `openai` (OpenAI-compatible endpoints). Use an exact model ID returned by **Load models**. Credentials saved in the application are encrypted and never returned in full.

The older `LLM_*` variables are supported aliases; populated `AI_*` variables take precedence. Stored organization settings take precedence over global settings. Credentials are selected for the exact provider; a Venice environment key is not sent to an OpenRouter endpoint. No matching key means the mock provider is used. Mock generation is for development and review, not evidence that a live model or account works.

Conversation context, persona information, approved training excerpts, and selected memories are sent to the configured external model service. Training retrieval uses approved text and application rules; the presence of pgvector in the schema does not establish a deployed embedding/search pipeline. Never commit real credentials, exported private chats, browser profiles, or customer examples.

## Connect OnlyFansAPI

1. Configure the server encryption key, database, and Redis. Start both workers.
2. In **Products**, select a creator and enter the provider API key and connected `acct_...` account ID. Canopy verifies the platform creator identity.
3. Import the catalog. Vault media and priced offers appear as drafts. Reimports preserve operator prices; a completed scan can retire missing source items. An incomplete scan does not retire them.
4. Review media references, free previews, and prices before approving products. Review actions in **Automation**. COPILOT requires approval for every reply.

Automatic sending also requires the account mode and global flags to permit it. PPV sending defaults off. Verified provider receipts establish delivery; ambiguous sends fail for manual investigation and are not automatically resent. Transactions without a usable source message ID remain unreconciled.

`pnpm platform:worker -- --once` performs one polling iteration. Browser-only connection commands are `pnpm platform:connect -- --account <id>` and `pnpm platform:validate-selectors`. Browser login and challenges require the creator's manual participation. Remote browser endpoints must be dedicated to an account. Do not upload browser profiles or cookie data.

## Tests and checks

```bash
pnpm check                         # Lint, formatting, type checks and workspace tests
pnpm build                         # Shared/database/AI checks and Next.js production build
pnpm --filter @canopy/extension build
pnpm test:e2e                      # Full UI flows; requires seeded PostgreSQL and Chromium
pnpm eval                          # Synthetic mock evaluation; no live platform sends
```

Install Chromium with `pnpm --filter @canopy/web exec playwright install chromium`. Unit tests use mocks/fixtures. Database and browser fixture tests skip when local services are unavailable; with `CI=1`, unavailable services fail instead. CI supplies PostgreSQL and Chromium and runs the complete checks and UI tests with model keys empty. Live model tests require explicit opt-in and are excluded from routine checks.

Load `apps/extension/dist` as an unpacked Chrome extension after building. The extension has a demo adapter; issue a short-lived organization-bound token from a signed-in session using `POST /api/extension/token`. Tokens are stored in session storage. Legacy tokens issued before organization binding need to be reissued.

## Deployment

For Vercel, import the repository with **Root Directory** `apps/web`; `apps/web/vercel.json` defines installation and build commands. Set database, auth, encryption, app URL, and optional model credentials in the appropriate Vercel environment. Never copy development secrets into production.

Migrations run before the web build and failures block deployment. `DIRECT_URL` optionally supplies a migration-only direct PostgreSQL connection; application traffic keeps using `DATABASE_URL`. For Neon, the migration runner otherwise converts the pooled hostname to the direct counterpart, allows at least 30 seconds to connect, and retries only `P1001` up to three attempts. Persistent network, authentication, and SQL errors still fail. PostgreSQL must support pgvector.

Vercel hosts the web app. It does not run the persistent BullMQ or platform workers: deploy those separately with the same database, Redis, encryption key, and relevant configuration. Review migrations before deploying. No automatic production seed step is provided.

## Limitations

- Live OnlyFansAPI catalog/delivery and external model calls require credentials and authorized account testing.
- Rate limiting is currently process-local; it is not a distributed limit across Vercel instances.
- Delivery leases and idempotency reduce races but do not replace manual reconciliation of ambiguous sends.
- Embedding ingestion, retention deletion, and aggregate jobs are not implemented handlers. Unknown queue names fail explicitly rather than appearing successful.
- The main generation orchestrator remains substantial because its ordering coordinates safety, context, pricing, persistence, and review. Further changes should follow regression coverage rather than arbitrary file-length limits.
