import { z } from "zod";

const identifier = z.string().trim().min(1).max(200);
const tenant = z.object({ organizationId: identifier });
const conversation = tenant.extend({ conversationId: identifier });
const account = tenant.extend({ platformAccountId: identifier });
const trigger = account.extend({
  platformConversationId: identifier,
  triggerExternalMessageId: identifier,
});

const payloadSchemas = {
  "summarize-conversation": conversation,
  "extract-memories": conversation,
  "provider-health": tenant,
  "sync-platform-catalog": account.extend({ syncRunId: identifier }),
  "sync-platform-receipts": account,
  "sync-platform-inbox": account,
  "process-incoming-message": trigger,
  "generate-automation-decision": trigger,
  "deliver-automation-action": account.extend({ actionId: identifier }),
  "reconcile-delivery": tenant,
  "detect-purchase": account,
  "send-follow-up": account.extend({ platformConversationId: identifier }),
  "browser-heartbeat": account,
} as const;

export type JobName = keyof typeof payloadSchemas;
export type PayloadFor<N extends JobName> = z.infer<(typeof payloadSchemas)[N]>;
export type BackgroundJob = { [N in JobName]: { name: N; payload: PayloadFor<N> } }[JobName];
export type JobPayload = BackgroundJob["payload"];

export function parseJob(name: unknown, payload: unknown): BackgroundJob {
  if (typeof name !== "string" || !Object.hasOwn(payloadSchemas, name))
    throw new Error("Unknown background job");
  const jobName = name as JobName;
  // This is the single runtime boundary linking a validated name to its payload schema.
  return { name: jobName, payload: payloadSchemas[jobName].parse(payload) } as BackgroundJob;
}
