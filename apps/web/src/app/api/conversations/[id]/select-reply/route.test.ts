import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/access", () => ({ getConversationAccess: mocks.access }));
vi.mock("@/lib/session", () => ({
  requireOrgUser: async () => ({ userId: "user", tenant: { organizationId: "org" } }),
  requirePerm: vi.fn(),
  jsonError: vi.fn(),
}));
vi.mock("@/server/security", () => ({ rateLimit: () => true }));
vi.mock("@/server/generation", () => ({ selectReply: mocks.select }));
import { POST } from "./route";
it("rejects an unassigned creator before selecting or inserting a reply", async () => {
  mocks.access.mockResolvedValue({ ok: false, status: 403 });
  const response = await POST(
    new Request("http://localhost/api/conversations/synthetic/select-reply", {
      method: "POST",
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: "synthetic" }) },
  );
  expect(response.status).toBe(403);
  expect(mocks.select).not.toHaveBeenCalled();
});
