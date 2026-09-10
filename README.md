# Canopy

Human-in-the-loop AI chatting and sales copilot for adult-content creators and agencies.

The model **suggests** replies. A human chatter **reviews, edits, and sends**. Canopy never logs into OnlyFans, never bypasses CAPTCHA, never reads platform cookies, and never sends messages on a creator’s behalf.

Conversations may be processed by the configured **external Venice AI provider**. Canopy does not train a general model on client chats.

## Repository audit

This repository was empty at the start of the project. The architecture below is the initial implementation.

## Architecture

```text
/apps/web            Next.js App Router (UI + API)
/apps/extension      Manifest V3 side panel + demo adapter
/packages/database   Prisma schema, tenant helpers, encryption, seed
/packages/ai         LLMProvider, Venice + mock, safety, prompts, eval
/packages/shared     Enums, Zod schemas, RBAC, funnel rules
/packages/config     Shared TypeScript config
```

Tenant isolation is enforced in `packages/database` (`requireTenant` / `tenantDb`). Role checks run on the server. The Venice API key never enters browser or extension bundles.

### Database models

User, Organization, OrganizationMembership, Creator, CreatorPersona, CreatorBoundary, ChatterCreatorAssignment, Subscriber, SubscriberMemory, Conversation, Message, ConversationSummary, Product, Offer, Purchase, TrainingDocument, TrainingChunk, PromptTemplate, PromptVersion, Generation, ReplyOption, Escalation, AnalyticsEvent, LLMProviderConfiguration, AuditLog, ApiCredential, DataRetentionPolicy, ExtensionToken.

## Local development

```bash
cp .env.example .env
cp .env.example apps/web/.env
cp .env.example packages/database/.env

pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

This is a pnpm monorepo. In the Vercel project:

1. Import the GitHub repo.
2. Set **Root Directory** to `apps/web`.
3. Framework: Next.js (detected from `apps/web/vercel.json`).
4. Add a Postgres database that supports the `vector` extension (Neon / Vercel Postgres). Enable `CREATE EXTENSION IF NOT EXISTS vector;`.
5. Set the environment variables from `.env.example` (at least `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `APP_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL`). Point `AUTH_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` at the Vercel URL.
6. After the first deploy, run migrations against that database: `DATABASE_URL=... pnpm db:migrate && DATABASE_URL=... pnpm db:seed`.
7. Add `LLM_API_KEY` (Venice) and a model ID, or paste the key in **Admin → AI provider** after login.

The OnlyFans browser worker cannot run on Vercel serverless. Leave `ONLYFANS_BROWSER_INTEGRATION=false` in production. Redis is optional; jobs run inline when `REDIS_URL` is unset.

Demo password for every seeded user: `CanopyDemo!2026`

| Role | Email |
| --- | --- |
| Platform admin | admin@canopy.dev |
| Agency owner | owner@demo.canopy |
| Manager | manager@demo.canopy |
| Chatter | chatter1@demo.canopy |
| Chatter | chatter2@demo.canopy |
| Creator | maya@demo.canopy |
| Creator | elena@demo.canopy |

All seed records are labelled **DEMO** and use fictional adults only.

### Venice API key

1. Create a key in the Venice dashboard.
2. Set `LLM_API_KEY` and optionally `LLM_BASE_URL` (default `https://api.venice.ai/api/v1`).
3. Sign in as `admin@canopy.dev` → **Admin** or **AI provider**.
4. Paste the key (it is encrypted at rest and never redisplayed in full).
5. Click **Load models**. Prefer a listed uncensored Qwen around 24B–35B; store the **exact ID** Venice returned.
6. Optionally pick a cheaper classification model.
7. Run **Health check** and **Private test generation**.

If `LLM_API_KEY` is empty, Canopy uses a clearly labelled **mock provider** so the full human-approval workflow still works offline.

### Agency training corpus

Canopy does **not** fine-tune a model. It retrieves approved manuals into the prompt:

- Sexting Script Master Guidelines (20–30 word messages, no time-of-day, tease then PPV)
- Trans model terminology (only when the creator persona is trans)
- Chatter training chapters 1–6 (prices, lists, vault/PPV, first chat, ladder, shift)

`AI Chatting FA.pdf` is a founders’ agreement, not chatter training, and is **not** sent to the model.

Mark/Lukas message dashboards contain real fan IDs. Do not commit them. After they are anonymized, paste example pairs into **Training** for manager approval. Re-seed to load the manuals:

```bash
pnpm db:seed
```

Live Venice tests:

```bash
VENICE_LIVE_TEST=true pnpm --filter @canopy/ai test
```

### Browser extension

```bash
pnpm --filter @canopy/extension build
```

Load `apps/extension/dist` as an unpacked Chrome extension. Open `/demo` for the local messenger adapter. Issue a token from a signed-in session via `POST /api/extension/token`. The extension stores that token in session storage only.

### Evaluation suite

```bash
pnpm eval
```

Never sends messages to a live platform.

## Scripts

```bash
pnpm test
pnpm build
pnpm worker          # BullMQ worker (jobs also run inline without Redis)
pnpm platform:mock-demo
pnpm platform:worker
pnpm platform:connect -- --account <platformAccountId>
pnpm platform:validate-selectors
```

The OnlyFans browser worker is an unofficial prototype. It is disabled by default (`ONLYFANS_BROWSER_INTEGRATION=false`). Live selectors are unverified. See **Platform automation** below.

## Safeguards

A deterministic safety layer outside the LLM blocks minors, uncertain age, exploitation, non-consent involving real harm, bestiality, sextortion, threats, credential harvesting, and similar cases. Agencies cannot disable it. Ordinary explicit adult language between verified adults is not blocked merely for being explicit.

## Implementation status

- **Phase 1** — working authenticated web MVP (this tree).
- **Phase 2** — summaries, memories, funnel, ingestion, pgvector, jobs, eval (schema + workers present; embeddings fill in when an embedding model is configured).
- **Phase 3** — Manifest V3 extension with demo adapter and isolated production adapter contract.
- **Phase 4** — CSP, rate limits, audit logs, retention, encryption, Playwright coverage.
- **Platform automation prototype** — unofficial OnlyFans browser worker. Live selectors are unverified. Autonomous send is off by default.

## Platform automation

This is an unofficial browser integration. It is **not** supported by OnlyFans and can stop working if the site changes. Canopy never stores the creator password. Login, 2FA, CAPTCHA and identity checks must be completed by the creator in a local headed browser.

### Flags

```bash
ONLYFANS_BROWSER_INTEGRATION=false
ONLYFANS_AUTONOMOUS_TEXT=true
ONLYFANS_AUTONOMOUS_PPV=false
ONLYFANS_MOCK_PLATFORM=true
CANOPY_BROWSER_PROFILE_ROOT=.canopy-profiles
```

Autonomous text defaults on. Pause a single conversation from the chat page. Set `ONLYFANS_AUTONOMOUS_TEXT=false` to force suggestions-only globally. PPV send stays off unless `ONLYFANS_AUTONOMOUS_PPV=true`.

### Commands

```bash
pnpm dev
pnpm worker
pnpm platform:mock-demo
pnpm platform:worker
pnpm platform:validate-selectors
pnpm platform:connect -- --account <platformAccountId>
```

### Manual connect (authorized test account only)

1. Seed or create a `PlatformAccount` for the creator (`pnpm db:seed` creates Maya’s mock account).
2. Confirm the creator/agency authorized Canopy. Do not connect anyone else’s account.
3. Set `ONLYFANS_BROWSER_INTEGRATION=true` on the worker machine only.
4. Run `pnpm platform:connect -- --account <id>` in headed mode.
5. The creator completes OnlyFans login and 2FA themselves. Canopy does not read or export cookies.
6. If a challenge appears, automation pauses (`CHALLENGE_REQUIRED`) until the creator finishes it.
7. Emergency stop is on `/platform`. Pause one chat with **Pause this chat** on the conversation page.
8. Review actions on `/automation`. Set `ONLYFANS_AUTONOMOUS_TEXT=false` only if you want suggestions-only globally.

Profiles stay under `.canopy-profiles` with mode `0700`. Do not upload them. Prefer OS disk encryption (FileVault). Never put cookies or profile paths in the API or frontend.
