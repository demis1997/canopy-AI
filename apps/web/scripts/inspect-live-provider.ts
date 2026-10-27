import { prisma } from "@canopy/database";
import { resolveOrganizationProvider } from "../src/server/ai-provider.js";
async function main() {
  try {
    const organizations = await prisma.lLMProviderConfiguration.findMany({
      where: { organizationId: { not: null }, isActive: true },
      select: { organizationId: true },
    });
    const selectedIndex = process.argv.indexOf("--organization");
    const organizationId =
      selectedIndex >= 0
        ? process.argv[selectedIndex + 1]
        : organizations.length === 1
          ? organizations[0]?.organizationId
          : undefined;
    if (!organizationId)
      throw new Error("Select an organization with --organization before running a live test");
    const resolved = await resolveOrganizationProvider(organizationId);
    const models = await resolved.provider.listModels();
    const selected = models.find((m) => m.id === resolved.model);
    console.log(
      JSON.stringify(
        {
          provider: resolved.mode,
          endpoint: resolved.config?.baseUrl
            ? (() => {
                const url = new URL(resolved.config.baseUrl);
                return url.origin + url.pathname;
              })()
            : null,
          configuredModel: resolved.model,
          modelAvailable: Boolean(selected),
          selectedModel: selected,
        },
        null,
        2,
      ),
    );
    const personas = await prisma.creatorPersona.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        conversationControls: true,
        style: true,
        tone: true,
        personality: true,
        prohibitedWords: true,
        contentBoundaries: true,
        frequentlyUsedPhrases: true,
      },
    });
    console.log(
      JSON.stringify(
        {
          personaPolicyFacts: personas.map((p) => ({
            personaId: p.id,
            controls: p.conversationControls,
            style: p.style,
            toneRequestsTeasing: /teas/i.test(p.tone),
            prohibitedProfanity: p.prohibitedWords.filter((w) =>
              /^(fuck|fucking|damn|shit|bullshit|hell)$/i.test(w),
            ),
            cleanLanguageInstruction:
              /no (?:profanity|swearing)|never (?:swear|curse)|keep (?:it|language) clean/i.test(
                [p.tone, p.personality, ...p.contentBoundaries].join(" "),
              ),
            genericCatchphrases: p.frequentlyUsedPhrases.filter((w) =>
              /trouble|maybe.*not/i.test(w),
            ),
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        success: false,
        code: (error as { code?: string }).code ?? (error as Error).name,
        detail: "Live provider inspection failed; secret-bearing errors omitted.",
      }),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
void main();
