import { ProviderSettings } from "@/components/provider-settings";
import { guardOrgPage } from "@/lib/page-guard";
import { AccessDenied, PageHeader } from "@/components/page-chrome";

export default async function AiProviderPage() {
  const { allowed } = await guardOrgPage("settings.ai_provider");
  if (!allowed) return <AccessDenied />;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configure"
        title="AI provider"
        description="OpenAI-compatible chat APIs only. Keys are encrypted at rest and never shown in full. Prefer an uncensored Qwen 24B–35B when the provider lists one."
      />
      <ProviderSettings />
    </div>
  );
}
