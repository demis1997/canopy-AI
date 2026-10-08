import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import { processJob } from "./dispatch";
import { parseJob, type JobName, type JobPayload, type PayloadFor } from "./contracts";

let producerConnection: IORedis | null = null;
let workerConnection: IORedis | null = null;
let queue: Queue<JobPayload, void, JobName> | null = null;

function getRedis(role: "producer" | "worker"): IORedis | null {
  if (!process.env.REDIS_URL) return null;
  const existing = role === "producer" ? producerConnection : workerConnection;
  if (existing) return existing;
  const redis = new IORedis(
    process.env.REDIS_URL,
    role === "worker"
      ? { maxRetriesPerRequest: null }
      : {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 10_000,
          retryStrategy: (attempt) => (attempt <= 2 ? attempt * 250 : null),
        },
  );
  redis.on("error", () => console.error("redis_connection_error", { role }));
  if (role === "producer") producerConnection = redis;
  else workerConnection = redis;
  return redis;
}

export async function closeQueueConnections() {
  await queue?.close();
  queue = null;
  for (const redis of [producerConnection, workerConnection]) redis?.disconnect();
  producerConnection = null;
  workerConnection = null;
}

export function getQueue() {
  const redis = getRedis("producer");
  if (!redis) return null;
  if (!queue) {
    queue = new Queue<JobPayload, void, JobName>("canopy", { connection: redis });
  }
  return queue;
}

export async function enqueueJob<N extends JobName>(
  name: N,
  payload: PayloadFor<N>,
  opts?: { delayMs?: number; debounceKey?: string },
) {
  const job = parseJob(name, payload);
  const q = getQueue();
  if (!q) {
    await processJob(job.name, job.payload);
    return;
  }
  let jobId =
    opts?.debounceKey ??
    (job.name === "generate-automation-decision"
      ? `${name}-${job.payload.platformAccountId}-${job.payload.platformConversationId}-${job.payload.triggerExternalMessageId}`
      : job.name === "deliver-automation-action"
        ? `${name}-${job.payload.actionId}`
        : job.name === "process-incoming-message"
          ? `${name}-${job.payload.platformConversationId}-${job.payload.triggerExternalMessageId}`
          : `${name}-${randomUUID()}`);
  if (opts?.debounceKey) {
    const existing = await q.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (
        state === "delayed" ||
        state === "waiting" ||
        state === "completed" ||
        state === "failed"
      ) {
        await existing.remove();
      } else {
        // Never remove a locked active job. Queue the new turn under a distinct stable ID.
        jobId = `${jobId}-${"triggerExternalMessageId" in job.payload ? job.payload.triggerExternalMessageId : randomUUID()}`;
      }
    }
  }
  await q.add(job.name, job.payload, {
    jobId,
    delay: opts?.delayMs,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
  });
}

export function startWorker() {
  const redis = getRedis("worker");
  if (!redis) {
    console.log("Canopy worker: REDIS_URL missing, jobs run inline");
    return;
  }
  const worker = new Worker<JobPayload, void, JobName>(
    "canopy",
    async (job: Job<JobPayload, void, JobName>) => {
      await processJob(job.name, job.data);
    },
    { connection: redis, concurrency: 4 },
  );
  worker.on("failed", (job, err) => {
    console.error("background_job_failed", { name: job?.name, errorType: err.name });
  });
  worker.on("error", (err) => console.error("background_worker_error", { errorType: err.name }));
  return worker;
}
