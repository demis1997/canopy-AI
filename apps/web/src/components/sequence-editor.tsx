"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SEQUENCE_KINDS, SEQUENCE_STEP_MEDIA, type SequenceKind } from "@canopy/shared";

type Step = {
  body: string;
  mediaHint: "TEXT" | "VOICE" | "PHOTO" | "PPV";
  delayMinutes: number;
  productId: string | null;
  priceTier: number;
};

type SequenceRow = {
  id: string;
  name: string;
  kind: SequenceKind;
  description: string;
  active: boolean;
  creatorId: string;
  steps: (Step & { id?: string })[];
};

const emptyStep = (): Step => ({
  body: "",
  mediaHint: "TEXT",
  delayMinutes: 0,
  productId: null,
  priceTier: 1,
});

export function SequenceEditor({
  creators,
  products,
  sequences,
  canEdit,
}: {
  creators: { id: string; name: string }[];
  products: { id: string; name: string; creatorId: string }[];
  sequences: SequenceRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({
    name: "",
    kind: "STARTER" as SequenceKind,
    description: "",
    active: true,
    steps: [emptyStep()],
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => sequences.filter((s) => !creatorId || s.creatorId === creatorId),
    [sequences, creatorId],
  );
  const creatorProducts = products.filter((p) => p.creatorId === creatorId);

  function startNew() {
    setEditing("new");
    setForm({ name: "", kind: "STARTER", description: "", active: true, steps: [emptyStep()] });
  }

  function startEdit(row: SequenceRow) {
    setEditing(row.id);
    setForm({
      name: row.name,
      kind: row.kind,
      description: row.description,
      active: row.active,
      steps: row.steps.map((s) => ({
        body: s.body,
        mediaHint: s.mediaHint,
        delayMinutes: s.delayMinutes,
        productId: s.productId,
        priceTier: s.priceTier,
      })),
    });
  }

  async function save() {
    setBusy(true);
    setStatus("");
    const payload = { ...form, creatorId, steps: form.steps.filter((s) => s.body.trim()) };
    const res = await fetch(editing === "new" ? "/api/sequences" : `/api/sequences/${editing}`, {
      method: editing === "new" ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    setStatus(res.ok ? "Saved." : "Save failed.");
    if (res.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/sequences/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  async function loadTemplates() {
    setBusy(true);
    const res = await fetch("/api/sequences/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creatorId }),
    });
    const json = await res.json();
    setBusy(false);
    setStatus(res.ok ? `Added ${json.created} templates.` : json.error || "Failed.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label>Creator</Label>
          <select
            className="mt-1 h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <>
            <Button onClick={startNew}>New sequence</Button>
            <Button variant="secondary" disabled={busy || !creatorId} onClick={() => void loadTemplates()}>
              Load Inflow-style templates
            </Button>
          </>
        ) : null}
      </div>
      {status ? <p className="text-xs text-canopy-300">{status}</p> : null}

      {editing ? (
        <Card className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Kind</Label>
              <select
                className="mt-1 h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as SequenceKind })}
              >
                {SEQUENCE_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
            <div className="md:col-span-3">
              <Label>When to use</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          {form.steps.map((step, index) => (
            <div key={index} className="rounded-[10px] border border-white/10 p-3 space-y-2">
              <div className="text-xs text-white/40">Step {index + 1}</div>
              <Textarea
                value={step.body}
                onChange={(e) => {
                  const steps = [...form.steps];
                  steps[index] = { ...step, body: e.target.value };
                  setForm({ ...form, steps });
                }}
              />
              <div className="grid gap-2 md:grid-cols-4">
                <select
                  className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
                  value={step.mediaHint}
                  onChange={(e) => {
                    const steps = [...form.steps];
                    steps[index] = { ...step, mediaHint: e.target.value as Step["mediaHint"] };
                    setForm({ ...form, steps });
                  }}
                >
                  {SEQUENCE_STEP_MEDIA.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={step.delayMinutes}
                  onChange={(e) => {
                    const steps = [...form.steps];
                    steps[index] = { ...step, delayMinutes: Number(e.target.value) };
                    setForm({ ...form, steps });
                  }}
                />
                <select
                  className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
                  value={step.priceTier}
                  onChange={(e) => {
                    const steps = [...form.steps];
                    steps[index] = { ...step, priceTier: Number(e.target.value) };
                    setForm({ ...form, steps });
                  }}
                >
                  <option value={1}>1st send · list</option>
                  <option value={2}>2nd send · mid</option>
                  <option value={3}>3rd send · min</option>
                </select>
                <select
                  className="h-9 rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
                  value={step.productId ?? ""}
                  onChange={(e) => {
                    const steps = [...form.steps];
                    steps[index] = { ...step, productId: e.target.value || null };
                    setForm({ ...form, steps });
                  }}
                >
                  <option value="">No product</option>
                  {creatorProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setForm({ ...form, steps: [...form.steps, emptyStep()] })}>
              Add step
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              Save sequence
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visible.map((row) => (
          <Card key={row.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">
                  {row.name} · {row.kind}
                </div>
                <div className="text-xs text-white/40">{row.description || `${row.steps.length} steps`}</div>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => void remove(row.id)}>
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-white/70">
              {row.steps.map((step, i) => (
                <li key={i}>
                  [{step.mediaHint}
                  {step.delayMinutes ? ` · ${step.delayMinutes}m` : ""}] {step.body}
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
