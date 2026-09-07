"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

export function TrainingInbox({
  chunks,
}: {
  chunks: { id: string; title: string; content: string; status: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("New training note");
  const [text, setText] = useState("");

  async function ingest(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/training", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, text, documentType: "CHATTER_TRAINING" }),
    });
    router.refresh();
  }

  async function decide(chunkId: string, status: "APPROVED" | "REJECTED") {
    await fetch("/api/training", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chunkId, status }),
    });
    router.refresh();
  }

  return (
    <Card className="space-y-4">
      <form className="space-y-3" onSubmit={ingest}>
        <Label>Ingest TXT / pasted training</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste chapter text…" />
        <Button type="submit">Split into pending chunks</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {chunks
          .filter((c) => c.status === "PENDING")
          .map((c) => (
            <div key={c.id} className="flex gap-2">
              <Button size="sm" onClick={() => decide(c.id, "APPROVED")}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decide(c.id, "REJECTED")}>
                Reject
              </Button>
            </div>
          ))}
      </div>
    </Card>
  );
}
