"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

export function CreateCreatorForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [personality, setPersonality] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/creators", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        handle,
        persona: { displayName, personality, allowedExplicitness: "EXPLICIT", style: "PLAYFUL" },
      }),
    });
    const json = await res.json();
    if (json.id) router.push(`/creators/${json.id}`);
    setBusy(false);
  }

  return (
    <Card>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <div>
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <Label>Handle</Label>
          <Input value={handle} onChange={(e) => setHandle(e.target.value)} required />
        </div>
        <div className="md:col-span-2">
          <Label>Personality</Label>
          <Textarea value={personality} onChange={(e) => setPersonality(e.target.value)} />
        </div>
        <Button type="submit" disabled={busy}>
          Create creator
        </Button>
      </form>
    </Card>
  );
}
