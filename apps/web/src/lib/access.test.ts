import { beforeEach, expect, it, vi } from "vitest";
import type { SessionContext } from "./session";
const mocks = vi.hoisted(() => ({ conversation: vi.fn(), assignments: vi.fn() }));
vi.mock("@canopy/database", () => ({
  prisma: {
    conversation: { findFirst: mocks.conversation },
    chatterCreatorAssignment: { findMany: mocks.assignments },
  },
}));
import { getConversationAccess } from "./access";
const ctx: SessionContext = {
  userId: "user",
  organizationId: "org-a",
  role: "CHATTER",
  email: "synthetic@example.invalid",
  name: "Synthetic",
  isPlatformAdmin: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.conversation.mockResolvedValue({ id: "conversation", creatorId: "creator" });
});
it("denies a same-organization conversation belonging to an unassigned creator", async () => {
  mocks.assignments.mockResolvedValue([{ creatorId: "other-creator" }]);
  expect(await getConversationAccess(ctx, "conversation")).toEqual({ ok: false, status: 403 });
});
it("does not reveal cross-organization conversations or query assignments for them", async () => {
  mocks.conversation.mockResolvedValue(null);
  expect(await getConversationAccess(ctx, "foreign")).toEqual({ ok: false, status: 404 });
  expect(mocks.conversation).toHaveBeenCalledWith({
    where: { id: "foreign", organizationId: "org-a" },
  });
  expect(mocks.assignments).not.toHaveBeenCalled();
});
it("allows assigned creators and organization managers", async () => {
  mocks.assignments.mockResolvedValue([{ creatorId: "creator" }]);
  expect(await getConversationAccess(ctx, "conversation")).toMatchObject({ ok: true });
  vi.clearAllMocks();
  expect(await getConversationAccess({ ...ctx, role: "MANAGER" }, "conversation")).toMatchObject({
    ok: true,
  });
  expect(mocks.assignments).not.toHaveBeenCalled();
});
