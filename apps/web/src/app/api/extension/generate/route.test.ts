import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  generate: vi.fn(),
  conversation: vi.fn(),
  assignments: vi.fn(),
}));
vi.mock("@canopy/database", () => ({
  prisma: {
    conversation: { findFirst: mocks.conversation },
    chatterCreatorAssignment: { findMany: mocks.assignments },
  },
}));
vi.mock("@/server/security", () => ({ verifyExtensionToken: mocks.verify, rateLimit: () => true }));
vi.mock("@/server/generation", () => ({ generateForConversation: mocks.generate }));
vi.mock("@/lib/session", () => ({
  requirePerm: () => {},
  jsonError: () => new Response("Invalid request", { status: 400 }),
}));
import { POST } from "./route";
const request = () =>
  new Request("http://localhost/api/extension/generate", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ conversationId: "conversation" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({
    user: { id: "chatter", email: "a@example.com", name: "A", isPlatformAdmin: false },
    membership: { organizationId: "bound-org", role: "CHATTER" },
  });
  mocks.assignments.mockResolvedValue([{ creatorId: "assigned" }]);
  mocks.generate.mockResolvedValue({ replyOptions: [] });
});
it("denies generation for an unassigned creator even in the token's organization", async () => {
  mocks.conversation.mockResolvedValue({ id: "conversation", creatorId: "other" });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("uses the token-bound organization and permits an assigned creator", async () => {
  mocks.conversation.mockResolvedValue({ id: "conversation", creatorId: "assigned" });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.conversation).toHaveBeenCalledWith({
    where: { id: "conversation", organizationId: "bound-org" },
  });
  expect(mocks.generate).toHaveBeenCalledWith({
    organizationId: "bound-org",
    userId: "chatter",
    conversationId: "conversation",
  });
});
it("rejects an invalid or unscoped token", async () => {
  mocks.verify.mockResolvedValue(null);
  expect((await POST(request())).status).toBe(401);
});
