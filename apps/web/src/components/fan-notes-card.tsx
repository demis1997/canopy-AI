"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { FAN_DOMINANCE, type FanDominance } from "@canopy/shared";

export type FanNoteValue = {
  realName: string;
  location: string;
  dominance: FanDominance;
  preferredTone: string;
  notes: string;
  extra: Record<string, string>;
};

export function FanNotesCard({
  creatorId,
  subscriberId,
  creatorName,
  fanName,
  spend,
  initial,
}: {
  creatorId: string;
  subscriberId: string;
  creatorName: string;
  fanName: string;
  spend: number;
  initial: FanNoteValue | null;
}) {
  const [form, setForm] = useState<FanNoteValue>(
    initial ?? {
      realName: "",
      location: "",
      dominance: "UNKNOWN",
      preferredTone: "",
      notes: "",
      extra: {},
    },
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/fan-notes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creatorId, subscriberId, ...form }),
    });
    setBusy(false);
    setStatus(res.ok ? "Notes saved for this fan on this model." : "Save failed.");
  }

  return (
    <Card className="space-y-3">
      <div>
        <div className="text-sm font-medium">Creator notes</div>
        <p className="text-xs text-white/40">
          {fanName} talking with {creatorName}. Other fans on this model have their own notes. Spend on{" "}
          {creatorName}: ${spend.toFixed(0)}.
        </p>
      </div>
      <div className="grid gap-2">
        <div>
          <Label>Real name</Label>
          <Input value={form.realName} onChange={(e) => setForm({ ...form, realName: e.target.value })} />
        </div>
        <div>
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div>
          <Label>His dynamic</Label>
          <select
            className="mt-1 h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
            value={form.dominance}
            onChange={(e) => setForm({ ...form, dominance: e.target.value as FanDominance })}
          >
            {FAN_DOMINANCE.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Preferred tone from her</Label>
          <Input
            value={form.preferredTone}
            onChange={(e) => setForm({ ...form, preferredTone: e.target.value })}
            placeholder="e.g. dominant, girlfriend, teasing"
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Kids, job, kinks he stated, what already worked…"
          />
        </div>
      </div>
      <Button size="sm" disabled={busy} onClick={() => void save()}>
        Save notes
      </Button>
      {status ? <p className="text-xs text-canopy-300">{status}</p> : null}
    </Card>
  );
}
