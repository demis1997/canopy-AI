"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

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
  const [models, setModels] = useState<Model[]>([]);
  const [generationModel, setGenerationModel] = useState("");
  const [classificationModel, setClassificationModel] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [health, setHealth] = useState("");
  const [test, setTest] = useState("");
  const [mockMode, setMockMode] = useState(true);

  useEffect(() => {
    fetch("/api/admin/provider")
      .then((r) => r.json())
      .then((j) => {
        setMasked(j.maskedKey);
        setMockMode(j.mockMode);
        if (j.config?.generationModel) setGenerationModel(j.config.generationModel);
        if (j.config?.classificationModel) setClassificationModel(j.config.classificationModel);
        if (j.config?.baseUrl) setBaseUrl(j.config.baseUrl);
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
        generationModel,
        classificationModel,
      }),
    });
    return res.json();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="text-xs text-white/40">
          Saved key: {masked ?? "none"} {mockMode ? "(labelled mock mode)" : ""}
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
        <div>
          <Label>Base URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              const j = await call("list-models");
              setModels(j.models ?? []);
              setMockMode(Boolean(j.mockMode));
            }}
          >
            Load models
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const j = await call("health");
              setHealth(JSON.stringify(j));
            }}
          >
            Health check
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              const j = await call("test-generation");
              if (j.error) {
                setTest(`Test failed: ${j.error}${j.code ? ` (${j.code})` : ""}`);
                return;
              }
              setTest(
                `latency ${j.latencyMs ?? "—"}ms · tokens ${j.promptTokens ?? "—"}+${j.completionTokens ?? "—"} · ${j.sample ?? ""}`,
              );
            }}
          >
            Private test generation
          </Button>
          <Button onClick={async () => call("save")}>Save selection</Button>
        </div>
      </Card>
      {models.length ? (
        <Card>
          <div className="text-sm font-medium">Available models</div>
          <ul className="mt-3 space-y-2 text-sm">
            {models.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <span>
                  <code className="text-canopy-300">{m.id}</code>
                  {m.recommended ? " · recommended uncensored Qwen-class" : ""}
                  {m.uncensored ? " · uncensored" : ""}
                  {m.parameterHint ? ` · ${m.parameterHint}` : ""}
                </span>
                <Button size="sm" variant="outline" onClick={() => setGenerationModel(m.id)}>
                  Use for generation
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>Generation model ID</Label>
              <Input value={generationModel} onChange={(e) => setGenerationModel(e.target.value)} />
            </div>
            <div>
              <Label>Classification model ID (optional cheaper)</Label>
              <Input
                value={classificationModel}
                onChange={(e) => setClassificationModel(e.target.value)}
              />
            </div>
          </div>
        </Card>
      ) : null}
      {health ? <Card className="text-xs text-white/60">{health}</Card> : null}
      {test ? <Card className="text-sm">{test}</Card> : null}
    </div>
  );
}
