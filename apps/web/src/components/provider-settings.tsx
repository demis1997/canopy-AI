"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Model = {
  id: string;
  name: string;
  recommended?: boolean;
  uncensored?: boolean;
  parameterHint?: string | null;
};

export function ProviderSettings() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.venice.ai/api/v1");
  const [provider, setProvider] = useState("venice");
  const [models, setModels] = useState<Model[]>([]);
  const [generationModel, setGenerationModel] = useState("");
  const [classificationModel, setClassificationModel] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [health, setHealth] = useState("");
  const [test, setTest] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mockMode, setMockMode] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/provider")
      .then((r) => r.json())
      .then((j) => {
        setMasked(j.maskedKey);
        setMockMode(j.mockMode);
        if (j.generationModel || j.config?.generationModel) {
          setGenerationModel(j.generationModel || j.config.generationModel);
        }
        if (j.classificationModel || j.config?.classificationModel) {
          setClassificationModel(j.classificationModel || j.config.classificationModel);
        }
        if (j.baseUrl || j.config?.baseUrl) setBaseUrl(j.baseUrl || j.config.baseUrl);
        if (j.provider) setProvider(j.provider);
      })
      .catch(() => undefined);
  }, []);

  async function call(action: string) {
    const res = await fetch("/api/admin/provider", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        apiKey: apiKey || undefined,
        baseUrl,
        provider,
        generationModel,
        classificationModel,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || json.code || `Request failed (${res.status})`);
    }
    return json;
  }

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
          <span>
            Saved key: {masked ?? "none"} · provider {provider}
            {mockMode ? " · labelled mock mode" : " · live"}
          </span>
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-canopy-200">
            Using for generation: <code>{generationModel || "not selected"}</code>
          </span>
        </div>
        <div>
          <Label>New API key (never redisplayed)</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste key — it will be encrypted at rest"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Provider</Label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-ink-900 px-3 text-sm"
              value={provider}
              onChange={(e) => {
                const next = e.target.value;
                setProvider(next);
                if (next === "openrouter") setBaseUrl("https://openrouter.ai/api/v1");
                if (next === "venice") setBaseUrl("https://api.venice.ai/api/v1");
                if (next === "openai") setBaseUrl("https://api.openai.com/v1");
              }}
            >
              <option value="venice">Venice</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI-compatible</option>
            </select>
          </div>
          <div>
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Generation model ID</Label>
            <Input
              value={generationModel}
              onChange={(e) => setGenerationModel(e.target.value)}
              placeholder="Select a model below or paste an ID"
            />
          </div>
          <div>
            <Label>Classification model ID (optional cheaper)</Label>
            <Input
              value={classificationModel}
              onChange={(e) => setClassificationModel(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("list", async () => {
                const j = await call("list-models");
                setModels(j.models ?? []);
                setMockMode(Boolean(j.mockMode));
                setStatus(
                  j.mockMode
                    ? "Loaded labelled mock models."
                    : `Loaded ${j.models?.length ?? 0} models from ${j.provider ?? provider}.`,
                );
              })
            }
          >
            {busy === "list" ? "Loading…" : "Load models"}
          </Button>
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("health", async () => {
                const j = await call("health");
                setHealth(JSON.stringify(j));
                setStatus(j.ok ? `Health ok · ${j.latencyMs}ms` : `Health failed · ${j.error ?? "unknown"}`);
              })
            }
          >
            {busy === "health" ? "Checking…" : "Health check"}
          </Button>
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={() =>
              void run("test", async () => {
                const j = await call("test-generation");
                setTest(
                  `model ${(j.model ?? generationModel) || "—"} · latency ${j.latencyMs ?? "—"}ms · tokens ${j.promptTokens ?? "—"}+${j.completionTokens ?? "—"} · ${j.sample ?? ""}`,
                );
                setStatus("Private test generation completed.");
              })
            }
          >
            {busy === "test" ? "Generating…" : "Private test generation"}
          </Button>
          <Button
            disabled={Boolean(busy)}
            onClick={() =>
              void run("save", async () => {
                const j = await call("save");
                setStatus(`Saved · using ${j.generationModel || generationModel || "no model id"}`);
                if (j.keyLastFour) setMasked(`••••${j.keyLastFour}`);
                setApiKey("");
              })
            }
          >
            {busy === "save" ? "Saving…" : "Save selection"}
          </Button>
        </div>
        {status ? <p className="text-sm text-canopy-200">{status}</p> : null}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </Card>
      {models.length ? (
        <Card>
          <div className="text-sm font-medium">Available models</div>
          <p className="mt-1 text-xs text-white/40">
            Click “Use for generation”, then Save selection. The active model is highlighted.
          </p>
          <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
            {models.map((m) => {
              const selected = generationModel === m.id;
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2",
                    selected ? "border-canopy-500/40 bg-canopy-500/10" : "border-white/[0.06]",
                  )}
                >
                  <span>
                    <code className="text-canopy-300">{m.id}</code>
                    {m.recommended ? " · recommended uncensored Qwen-class" : ""}
                    {m.uncensored ? " · uncensored" : ""}
                    {m.parameterHint ? ` · ${m.parameterHint}` : ""}
                    {selected ? " · selected" : ""}
                  </span>
                  <Button
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => {
                      setGenerationModel(m.id);
                      setStatus(`Selected ${m.id}. Click Save selection to persist.`);
                    }}
                  >
                    {selected ? "Selected" : "Use for generation"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card className="text-sm text-white/45">
          Load models to browse the provider catalog. You can still paste a model ID above and save.
        </Card>
      )}
      {health ? <Card className="text-xs text-white/60">{health}</Card> : null}
      {test ? <Card className="text-sm">{test}</Card> : null}
    </div>
  );
}
