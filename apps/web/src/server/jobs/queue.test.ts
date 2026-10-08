import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
  close: vi.fn(),
  redis: vi.fn(),
  process: vi.fn(),
  worker: vi.fn(),
}));
vi.mock("./dispatch", () => ({ processJob: mocks.process }));
vi.mock("ioredis", () => ({ default: mocks.redis }));
vi.mock("bullmq", () => ({
  Queue: vi.fn(function () {
    return { add: mocks.add, getJob: mocks.getJob, close: mocks.close };
  }),
  Worker: mocks.worker,
}));
import { closeQueueConnections, enqueueJob, startWorker } from "./queue";
const payload = {
  organizationId: "org",
  platformAccountId: "account",
  platformConversationId: "thread",
  triggerExternalMessageId: "turn-2",
};
beforeEach(async () => {
  await closeQueueConnections();
  vi.clearAllMocks();
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
  mocks.redis.mockImplementation(function () {
    return { on: vi.fn(), disconnect: vi.fn() };
  });
  mocks.worker.mockImplementation(function () {
    return { on: vi.fn() };
  });
});
afterEach(async () => {
  await closeQueueConnections();
  vi.unstubAllEnvs();
});
describe("queue lifecycle and debounce", () => {
  it.each(["waiting", "delayed", "completed", "failed"])(
    "replaces a %s job so a later fan turn is not lost",
    async (state) => {
      const remove = vi.fn();
      mocks.getJob.mockResolvedValue({ getState: async () => state, remove });
      await enqueueJob("generate-automation-decision", payload, { debounceKey: "thread-decision" });
      expect(remove).toHaveBeenCalledOnce();
      expect(mocks.add).toHaveBeenCalledWith(
        "generate-automation-decision",
        payload,
        expect.objectContaining({ jobId: "thread-decision", attempts: 3 }),
      );
    },
  );
  it("preserves an active job and queues the new trigger with a distinct stable ID", async () => {
    const remove = vi.fn();
    mocks.getJob.mockResolvedValue({ getState: async () => "active", remove });
    await enqueueJob("generate-automation-decision", payload, { debounceKey: "thread-decision" });
    expect(remove).not.toHaveBeenCalled();
    expect(mocks.add).toHaveBeenCalledWith(
      "generate-automation-decision",
      payload,
      expect.objectContaining({ jobId: "thread-decision-turn-2" }),
    );
  });
  it("fails web producers promptly but lets workers wait for Redis recovery", async () => {
    startWorker();
    mocks.getJob.mockResolvedValue(null);
    await enqueueJob("provider-health", { organizationId: "org" });
    expect(mocks.redis.mock.calls[0]?.[1]).toEqual({ maxRetriesPerRequest: null });
    expect(mocks.redis.mock.calls[1]?.[1]).toMatchObject({
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  });
  it("uses the same validated dispatcher for inline jobs", async () => {
    vi.stubEnv("REDIS_URL", "");
    await enqueueJob("provider-health", { organizationId: "org" });
    expect(mocks.process).toHaveBeenCalledWith("provider-health", { organizationId: "org" });
    expect(mocks.add).not.toHaveBeenCalled();
  });
});
