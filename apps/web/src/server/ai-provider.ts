import { prisma, decryptSecret, lastFour } from "@canopy/database";
import { createLLMProvider, readProviderEnv } from "@canopy/ai";

export async function getProviderConfiguration(organizationId: string | null) {
  if (organizationId) {
    const scoped = await prisma.lLMProviderConfiguration.findFirst({ where: { organizationId } });
    if (scoped) return scoped;
  }
  return prisma.lLMProviderConfiguration.findFirst({ where: { organizationId: null } });
}

/** Never pair one provider's key with another provider's endpoint. Tenant settings take precedence. */
export async function resolveProviderCredential(
  organizationId: string | null,
  provider: string,
  pastedKey?: string,
) {
  if (pastedKey)
    return { apiKey: pastedKey, keyLastFour: lastFour(pastedKey), source: "pasted" as const };
  const scoped = await prisma.apiCredential.findFirst({
    where: { organizationId, provider },
    orderBy: { createdAt: "desc" },
  });
  if (scoped)
    return {
      apiKey: decryptSecret(scoped.encryptedKey),
      keyLastFour: scoped.keyLastFour,
      source: "stored" as const,
    };
  const env = readProviderEnv();
  if (env.name === provider && env.apiKey)
    return {
      apiKey: env.apiKey,
      keyLastFour: lastFour(env.apiKey),
      source: "environment" as const,
    };
  if (organizationId) {
    const global = await prisma.apiCredential.findFirst({
      where: { organizationId: null, provider },
      orderBy: { createdAt: "desc" },
    });
    if (global)
      return {
        apiKey: decryptSecret(global.encryptedKey),
        keyLastFour: global.keyLastFour,
        source: "stored" as const,
      };
  }
  return { apiKey: "", keyLastFour: null, source: "mock" as const };
}

export async function resolveOrganizationProvider(organizationId: string) {
  const config = await getProviderConfiguration(organizationId);
  const env = readProviderEnv();
  const name = config?.provider || env.name;
  const credential = await resolveProviderCredential(organizationId, name);
  const model = config?.generationModel || (name === env.name ? env.model : "");
  return {
    ...createLLMProvider({
      apiKey: credential.apiKey,
      provider: name,
      baseURL: config?.baseUrl || (name === env.name ? env.baseURL : undefined),
      defaultModel: model,
    }),
    config,
    model,
  };
}
