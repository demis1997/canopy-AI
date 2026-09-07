"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { PersonaInput } from "@canopy/shared";

export function PersonaForm({
  creatorId,
  initial,
}: {
  creatorId: string;
  initial: PersonaInput;
}) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");

  function set<K extends keyof PersonaInput>(key: K, value: PersonaInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const res = await fetch(`/api/creators/${creatorId}/persona`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setStatus(res.ok ? "Saved a new persona version." : "Save failed.");
  }

  return (
    <Card className="space-y-4">
      <div className="text-sm font-medium">Active persona</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Display name</Label>
          <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </div>
        <div>
          <Label>Explicitness</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={form.allowedExplicitness}
            onChange={(e) => set("allowedExplicitness", e.target.value as PersonaInput["allowedExplicitness"])}
          >
            {["FLIRTY", "SUGGESTIVE", "EXPLICIT", "VERY_EXPLICIT"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Style</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={form.style}
            onChange={(e) => set("style", e.target.value as PersonaInput["style"])}
          >
            {["PLAYFUL", "ROMANTIC", "DOMINANT", "SUBMISSIVE", "DIRECT"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Discount limit %</Label>
          <Input
            type="number"
            value={form.discountLimitPercent}
            onChange={(e) => set("discountLimitPercent", Number(e.target.value))}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Biography</Label>
          <Textarea value={form.biography} onChange={(e) => set("biography", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Authorised backstory</Label>
          <Textarea value={form.authorisedBackstory} onChange={(e) => set("authorisedBackstory", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Personality / tone</Label>
          <Textarea
            value={`${form.personality}\n${form.tone}`}
            onChange={(e) => {
              const [p, ...rest] = e.target.value.split("\n");
              set("personality", p ?? "");
              set("tone", rest.join("\n"));
            }}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Preferred compliments (comma separated)</Label>
          <Input
            value={form.preferredCompliments.join(", ")}
            onChange={(e) =>
              set(
                "preferredCompliments",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label>Preferred explicit vocabulary (comma separated)</Label>
          <Input
            value={form.preferredExplicitVocabulary.join(", ")}
            onChange={(e) =>
              set(
                "preferredExplicitVocabulary",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label>Claims the AI must never make</Label>
          <Input
            value={form.claimsNeverToMake.join(", ")}
            onChange={(e) =>
              set(
                "claimsNeverToMake",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label>Offline meeting policy</Label>
          <Input value={form.offlineMeetingPolicy} onChange={(e) => set("offlineMeetingPolicy", e.target.value)} />
        </div>
      </div>
      <Button onClick={save}>Save persona version</Button>
      {status ? <p className="text-xs text-canopy-300">{status}</p> : null}
    </Card>
  );
}
