import { prisma } from "@canopy/database";
import { resolveOrganizationProvider } from "../../ai-provider";
import type { BackgroundJob } from "../contracts";

export async function processProviderJob(job: Extract<BackgroundJob, { name: "provider-health" }>) {
  const { name, payload } = job;
  if (name === "provider-health") {
    const { provider } = await resolveOrganizationProvider(payload.organizationId);
    const health = await provider.healthCheck();
    await prisma.lLMProviderConfiguration.updateMany({
      where: { organizationId: payload.organizationId },
      data: {
        lastHealthCheckAt: new Date(),
        lastHealthOk: health.ok,
        lastLatencyMs: health.latencyMs,
        lastError: health.error,
      },
    });
  }
}
