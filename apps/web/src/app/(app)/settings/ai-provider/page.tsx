import { ProviderSettings } from "@/components/provider-settings";

export default function AiProviderPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">AI provider</h1>
      <p className="max-w-2xl text-sm text-white/50">
        Canopy talks to Venice through an OpenAI-compatible API. The key never ships to the browser
        or the extension. Prefer an uncensored Qwen around 24B–35B when Venice lists one; the stored
        ID is always the exact model string returned by Venice.
      </p>
      <ProviderSettings />
    </div>
  );
}
