import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock("@canopy/database", () => ({
  prisma: {
    creator: { findFirst: mocks.find },
    creatorPersona: { updateMany: mocks.update, create: mocks.create },
  },
}));
vi.mock("@/lib/session", () => ({
  requireOrgUser: async () => ({
    userId: "operator",
    role: "AGENCY_OWNER",
    tenant: { organizationId: "org" },
  }),
  jsonError: () => new Response("Invalid request", { status: 400 }),
}));
import { PATCH } from "./route";
import { personaInputSchema } from "@canopy/shared";
const update = (body: unknown) =>
  PATCH(
    new Request("http://localhost/api/creators/creator/persona", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "creator" }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({
    id: "creator",
    userId: "operator",
    personas: [
      {
        ...personaInputSchema.parse({
          displayName: "Maya",
          biography: "Likes music",
          conversationControls: { casualProfanity: "ALLOW", casing: "LOWERCASE" },
        }),
        version: 2,
      },
    ],
  });
});
it("saves independent creator controls without resetting other preferences on a partial patch", async () => {
  expect((await update({ conversationControls: { directness: "DIRECT" } })).status).toBe(200);
  expect(mocks.create.mock.calls[0]?.[0].data).toMatchObject({
    organizationId: "org",
    creatorId: "creator",
    biography: "Likes music",
    version: 3,
    conversationControls: expect.objectContaining({
      directness: "DIRECT",
      casualProfanity: "ALLOW",
      casing: "LOWERCASE",
    }),
  });
});
it("preserves new controls when an older dashboard payload omits them", async () => {
  expect((await update({ displayName: "Maya edited" })).status).toBe(200);
  expect(mocks.create.mock.calls[0]?.[0].data.conversationControls.casualProfanity).toBe("ALLOW");
});
it("rejects a policy bypass or malformed style settings before writes", async () => {
  expect((await update({ conversationControls: { disableSafety: true } })).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("uses the tenant-scoped creator lookup and refuses a missing creator", async () => {
  mocks.find.mockResolvedValue(null);
  expect((await update({ displayName: "Maya" })).status).toBe(404);
  expect(mocks.find).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "creator", organizationId: "org" } }),
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
