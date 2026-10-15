import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: vi.fn(),
  config: vi.fn(),
  resolve: vi.fn(),
  createProvider: vi.fn(),
  health: vi.fn(),
  createCredential: vi.fn(),
  audit: vi.fn(),
  encrypt: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        apiCredential: { create: mocks.createCredential },
        auditLog: { create: mocks.audit },
      }),
  },
  encryptSecret: mocks.encrypt,
  lastFour: (key: string) => key.slice(-4),
}));
vi.mock("@canopy/ai", () => ({
  readProviderEnv: mocks.env,
  createLLMProvider: mocks.createProvider,
  ProviderError: class extends Error {},
}));
vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ organizationId: "org", userId: "owner" }),
  requirePerm: mocks.permission,
  jsonError: () => Response.json({ error: "Request failed" }, { status: 500 }),
}));
vi.mock("@/server/ai-provider", () => ({
  getProviderConfiguration: mocks.config,
  resolveProviderCredential: mocks.resolve,
}));
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.mockReturnValue({
    name: "venice",
    apiKey: "server-secret-1234",
    baseURL: "https://api.venice.ai/api/v1",
    model: "test-model",
  });
  mocks.config.mockResolvedValue({ provider: "venice" });
  mocks.createProvider.mockReturnValue({ provider: { healthCheck: mocks.health } });
  mocks.health.mockResolvedValue({ ok: true });
  mocks.encrypt.mockReturnValue("encrypted-with-current-key");
  mocks.createCredential.mockResolvedValue({ id: "credential", keyLastFour: "1234" });
});
const request = (provider = "venice") =>
  new Request("http://localhost/api/admin/provider", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "restore-server-key",
      provider,
      baseUrl: "https://untrusted.example/api",
    }),
  });
it("restores a healthy server credential without exposing it or sending it to the request URL", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.permission).toHaveBeenCalledWith(expect.anything(), "settings.ai_provider");
  expect(mocks.createProvider).toHaveBeenCalledWith({
    apiKey: "server-secret-1234",
    provider: "venice",
    baseURL: "https://api.venice.ai/api/v1",
  });
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.createCredential).toHaveBeenCalledWith({
    data: {
      organizationId: "org",
      provider: "venice",
      encryptedKey: "encrypted-with-current-key",
      keyLastFour: "1234",
    },
  });
  expect(mocks.audit).toHaveBeenCalled();
  expect(await response.json()).toEqual({ saved: true, provider: "venice", keyLastFour: "1234" });
});
it("does not overwrite credentials when provider health fails", async () => {
  mocks.health.mockResolvedValue({ ok: false });
  expect((await POST(request())).status).toBe(502);
  expect(mocks.createCredential).not.toHaveBeenCalled();
});
it("cannot use a different provider's server key", async () => {
  expect((await POST(request("openrouter"))).status).toBe(409);
  expect(mocks.createProvider).not.toHaveBeenCalled();
});
it("does not fall back to mock credentials when the server key is missing", async () => {
  mocks.env.mockReturnValue({ name: "venice", apiKey: "" });
  expect((await POST(request())).status).toBe(409);
  expect(mocks.createCredential).not.toHaveBeenCalled();
});
it("enforces provider settings permission before attempting recovery", async () => {
  mocks.permission.mockImplementation(() => {
    throw new Error("Forbidden");
  });
  await POST(request());
  expect(mocks.createProvider).not.toHaveBeenCalled();
  expect(mocks.createCredential).not.toHaveBeenCalled();
});
