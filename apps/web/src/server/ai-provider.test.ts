import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  credential: vi.fn(),
  config: vi.fn(),
  env: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  prisma: {
    apiCredential: { findFirst: mocks.credential },
    lLMProviderConfiguration: { findFirst: mocks.config },
  },
  decryptSecret: (value: string) => `decrypted-${value}`,
  lastFour: (value: string) => value.slice(-4),
}));
vi.mock("@canopy/ai", () => ({ readProviderEnv: mocks.env, createLLMProvider: mocks.create }));
import { resolveOrganizationProvider, resolveProviderCredential } from "./ai-provider";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.credential.mockResolvedValue(null);
  mocks.env.mockReturnValue({
    name: "venice",
    apiKey: "environment-key",
    model: "env-model",
    baseURL: "https://api.venice.ai/api/v1",
  });
});
it("selects credentials from the exact provider in the exact tenant", async () => {
  mocks.credential.mockResolvedValue({ encryptedKey: "tenant-key", keyLastFour: "-key" });
  const result = await resolveProviderCredential("org-a", "openrouter");
  expect(mocks.credential).toHaveBeenCalledWith({
    where: { organizationId: "org-a", provider: "openrouter" },
    orderBy: { createdAt: "desc" },
  });
  expect(result.apiKey).toBe("decrypted-tenant-key");
});
it("never sends an environment key to a different provider", async () => {
  expect((await resolveProviderCredential("org-a", "openrouter")).apiKey).toBe("");
  expect(mocks.credential.mock.calls[1]?.[0].where).toEqual({
    organizationId: null,
    provider: "openrouter",
  });
});
it("prefers scoped configuration and does not reuse another provider's endpoint or model", async () => {
  mocks.config.mockResolvedValue({ provider: "openrouter", baseUrl: "", generationModel: "" });
  mocks.create.mockReturnValue({ mode: "mock" });
  await resolveOrganizationProvider("org-a");
  expect(mocks.config).toHaveBeenCalledTimes(1);
  expect(mocks.create).toHaveBeenCalledWith({
    provider: "openrouter",
    apiKey: "",
    baseURL: undefined,
    defaultModel: "",
  });
});
