/** Live model requests with synthetic text only. Database reads are configuration/schema only. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "@canopy/database";
import {
  evaluateSafety,
  evaluateReplyCandidates,
  PROMPT_VERSION,
  type GenerationInput,
  type SyntheticTraceEvent,
} from "@canopy/ai";
import {
  advanceProgression,
  decideConversationTurn,
  detectOperationalIntent,
  reduceConversationSession,
  resolvePersonaControls,
  splitReplyBubbles,
  casualProfanityPattern,
} from "@canopy/shared";
import { profanityFixtures } from "../../../packages/ai/src/eval/profanity-fixtures.js";
import { resolveOrganizationProvider } from "../src/server/ai-provider.js";

async function main() {
  const arg = (name: string) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const outputPath = resolve(arg("--output") ?? "apps/web/.canopy-diagnostics/profanity-live.json");
  const configs = await prisma.lLMProviderConfiguration.findMany({
    where: { organizationId: { not: null }, isActive: true },
    select: { organizationId: true },
  });
  const organizationId =
    arg("--organization") ?? (configs.length === 1 ? configs[0]?.organizationId : undefined);
  if (!organizationId) throw new Error("Select an organization with --organization");
  const columns = await prisma.$queryRaw<
    { column_name: string }[]
  >`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'CreatorPersona' AND column_name = 'conversationControls'`;
  if (!columns.length) throw new Error("Persona controls migration is not applied");
  const migrations = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = '20261026120000_persona_conversation_controls'`;
  const personas = await prisma.creatorPersona.findMany({
    where: { organizationId, isActive: true },
    select: { conversationControls: true },
  });
  if (!personas.length) throw new Error("No active creator persona configuration exists");
  const storedControls = resolvePersonaControls(personas[0]!.conversationControls);
  const runtime = await resolveOrganizationProvider(organizationId);
  if (runtime.mode === "mock" || !runtime.model)
    throw new Error("Live test refuses mock mode or an unspecified model");
  const models = await runtime.provider.listModels();
  const model = models.find((model) => model.id === runtime.model);
  if (!model) throw new Error("Configured model was not returned by provider catalog");
  const report: {
    environment: Record<string, unknown>;
    cases: Record<string, unknown>[];
    passed?: boolean;
  } = {
    environment: {
      provider: runtime.mode,
      endpoint: runtime.config?.baseUrl
        ? (() => {
            const url = new URL(runtime.config.baseUrl);
            return url.origin + url.pathname;
          })()
        : null,
      configuredModel: runtime.model,
      catalogModel: model,
      promptVersion: PROMPT_VERSION,
      databaseHost: new URL(process.env.DATABASE_URL!).hostname,
      migration: migrations,
      activePersonaControls: personas.map((p) => ({
        stored: p.conversationControls,
        resolvedCasualProfanity: resolvePersonaControls(p.conversationControls).casualProfanity,
      })),
      realSubscriberReads: false,
      externalDelivery: false,
      vendorSystemPrompt:
        "Provider default; Canopy does not disable it, and its hidden contents are not returned by the API",
    },
    cases: [],
  };
  let passed = true;
  const cases = arg("--case")
    ? profanityFixtures.filter((row) => row.id === arg("--case"))
    : profanityFixtures;
  if (!cases.length) throw new Error("Unknown fixture ID");
  for (const fixture of cases) {
    const started = Date.now();
    const controls = resolvePersonaControls({
      ...storedControls,
      ...(fixture.controls === "STORED" ? {} : { casualProfanity: fixture.controls }),
    });
    const history = [
      ...("history" in fixture ? fixture.history : []),
      { authorType: "SUBSCRIBER", body: fixture.turn },
    ];
    const operational = detectOperationalIntent(fixture.turn);
    const decision = decideConversationTurn({
      subscriberText: fixture.turn,
      operational,
      recentMessages: history,
    });
    const progression = advanceProgression({ text: fixture.turn, history, turnKey: fixture.id });
    const session = reduceConversationSession(
      undefined,
      { type: "FAN_TURN", key: fixture.id, text: fixture.turn, history },
      controls,
    );
    const events: unknown[] = [];
    const pre = evaluateSafety({ adultStatus: "VERIFIED_ADULT", subscriberText: fixture.turn });
    events.push({ stage: "pre-safety", result: pre });
    let finalOutput;
    const errors: string[] = pre.allowed ? [] : [...pre.flags];
    let failureCodes: string[] = [];
    for (let attempt = 0; pre.allowed && attempt < 2; attempt++) {
      const input: GenerationInput = {
        requestId: `synthetic-${fixture.id}-${attempt}`,
        persona: {
          displayName: "Synthetic adult creator",
          biography: "Adult creator in a synthetic test. No personal details.",
          authorisedBackstory: "Enjoys music and ordinary conversation.",
          personality: "warm, direct, attentive",
          tone: "casual",
          typicalMessageLength: "SHORT",
          preferredEmojis: [],
          frequentlyUsedPhrases: [],
          preferredExplicitVocabulary: [],
          prohibitedWords: [],
          preferredCompliments: [],
          allowedExplicitness: "FLIRTY",
          style: "DIRECT",
          interests: ["music"],
          contentBoundaries: ["Non-graphic conversation only"],
          claimsNeverToMake: ["Personal romantic exclusivity"],
          customContentRules: "No custom content",
          offlineMeetingPolicy: "No offline meetings",
          discountLimitPercent: 0,
          approvedExampleMessages: [],
          conversationControls: controls,
        },
        progression,
        conversationSession: session,
        model: runtime.model,
        promptVersionId: PROMPT_VERSION,
        recentMessages: history,
        memories: [],
        products: [],
        funnelStage: "RAPPORT",
        playbook: "BUILDING_RAPPORT",
        retrievedExamples: [],
        latestFanTurn: fixture.turn,
        responseMode: decision.responseMode,
        salesReadiness: decision.salesReadiness,
        latestTurnIntensity: decision.latestTurnIntensity,
        intakeOpportunity: false,
        allowPitch: false,
        correctiveRetry: attempt > 0,
        correctiveCodes: failureCodes,
        syntheticTrace: {
          kind: "SYNTHETIC_ONLY",
          emit(event: SyntheticTraceEvent) {
            events.push({ ...event, attempt });
          },
        },
      };
      let result;
      try {
        result = await runtime.provider.generateReplies(input);
      } catch (error) {
        failureCodes = [(error as { code?: string }).code ?? "PROVIDER_ERROR"];
        errors.push(...failureCodes);
        events.push({ stage: "provider-error", attempt, codes: failureCodes });
        continue;
      }
      const post = evaluateSafety({
        adultStatus: "VERIFIED_ADULT",
        subscriberText: fixture.turn,
        generatedTexts: result.output.replyOptions.map((option) => option.text),
      });
      events.push({ stage: "post-safety", attempt, result: post, parsedOutput: result.output });
      if (!post.allowed) {
        failureCodes = post.flags;
        errors.push(...post.flags);
        continue;
      }
      const evaluated = evaluateReplyCandidates(result.output, {
        turn: fixture.turn,
        history,
        intent: progression.intent,
        personaControls: controls,
        messageLength: "SHORT",
        session,
        operational,
        decision: {
          ...decision,
          intakeOpportunity: false,
          allowIntakeQuestion: false,
          allowPitch: false,
          allowPrice: false,
        },
        catalog: [],
        guardOptions: {
          contextualRecovery: true,
          subscriberText: fixture.turn,
          responseMode: decision.responseMode,
          operationalIntent: operational.intent,
          intakeOpportunity: false,
          recentMessages: history,
          recentOutbound: history.filter((m) => m.authorType === "CHATTER").map((m) => m.body),
          fanMessageCount: 3,
          funnelStage: "RAPPORT",
        },
      });
      events.push({
        stage: "candidate-evaluation",
        attempt,
        evaluations: evaluated.evaluations,
        guardErrors: evaluated.validation.errors,
        guardedOutput: evaluated.guardedOutput,
        finalOutput: evaluated.validation.output,
      });
      finalOutput = evaluated.validation.output;
      failureCodes = [...new Set([...evaluated.validation.errors, ...finalOutput.riskFlags])];
      errors.push(...failureCodes);
      if (evaluated.validation.ok && finalOutput.replyOptions.length) break;
    }
    const selected = finalOutput?.replyOptions[0];
    const delivery = selected
      ? splitReplyBubbles(selected.text, { splitSentences: true }).join("\n")
      : null;
    const expectedPhrase = "expectedPhrase" in fixture ? fixture.expectedPhrase : undefined;
    const casePassed =
      Boolean(delivery) &&
      (!expectedPhrase || delivery!.toLowerCase().includes(expectedPhrase)) &&
      (fixture.controls !== "AVOID" || !casualProfanityPattern.test(delivery!));
    passed &&= casePassed;
    const row = {
      fixture: fixture.id,
      turn: fixture.turn,
      controlsSource:
        fixture.controls === "STORED" ? "stored-creator-controls" : "synthetic-override-only",
      casualProfanityLoaded: controls.casualProfanity,
      responseMode: decision.responseMode,
      events,
      allRejectionReasons: [...new Set(errors)],
      delivery: {
        sink: "synthetic-memory-only",
        externalDelivery: false,
        selectedText: selected?.text ?? null,
        finalDeliveredText: delivery,
      },
      elapsedMs: Date.now() - started,
      passed: casePassed,
    };
    report.cases.push(row);
    mkdirSync(resolve(outputPath, ".."), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(
      JSON.stringify({
        fixture: fixture.id,
        casualProfanityLoaded: controls.casualProfanity,
        responseMode: decision.responseMode,
        rejectionReasons: row.allRejectionReasons,
        finalDeliveredText: delivery,
        passed: casePassed,
      }),
    );
  }
  report.passed = passed;
  writeFileSync(outputPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ output: outputPath, passed, cases: report.cases.length }));
  if (process.argv.includes("--assert") && !passed) process.exitCode = 1;
}
void main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        success: false,
        code: error.code ?? error.name,
        detail: "Synthetic probe failed; secret-bearing errors omitted.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
