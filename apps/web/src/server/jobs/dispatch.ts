import { parseJob } from "./contracts";
import { processConversationJob } from "./handlers/conversation";
import { processPlatformJob } from "./handlers/platform";
import { processProviderJob } from "./handlers/provider";

export async function processJob(name: unknown, payload: unknown) {
  const job = parseJob(name, payload);
  switch (job.name) {
    case "summarize-conversation":
    case "extract-memories":
      return processConversationJob(job);
    case "provider-health":
      return processProviderJob(job);
    case "sync-platform-catalog": {
      const { syncPlatformCatalog } = await import("../platform-catalog");
      return syncPlatformCatalog({
        organizationId: job.payload.organizationId,
        platformAccountId: job.payload.platformAccountId,
        syncRunId: job.payload.syncRunId,
      });
    }
    case "sync-platform-receipts": {
      const { syncPlatformReceipts } = await import("../platform-catalog");
      return syncPlatformReceipts({
        organizationId: job.payload.organizationId,
        platformAccountId: job.payload.platformAccountId,
      });
    }
    default:
      return processPlatformJob(job);
  }
}
