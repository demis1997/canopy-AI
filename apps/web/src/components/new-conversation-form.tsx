"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NewConversationForm({
  creators,
  subscribers,
}: {
  creators: { id: string; name: string }[];
  subscribers: { id: string; name: string; adultStatus: string }[];
}) {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState(creators[0]?.id ?? "");
  const [subscriberId, setSubscriberId] = useState(subscribers[0]?.id ?? "");
  const [pending, setPending] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creatorId, subscriberId }),
    });
    const json = await res.json();
    if (json.id) router.push(`/conversations/${json.id}`);
    setPending(false);
  }

  return (
    <Card>
      <form className="flex flex-wrap items-end gap-3" onSubmit={create}>
        <label className="text-xs text-white/50">
          Creator
          <select
            className="mt-1 block h-9 rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/50">
          Subscriber
          <select
            className="mt-1 block h-9 rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={subscriberId}
            onChange={(e) => setSubscriberId(e.target.value)}
          >
            {subscribers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.adultStatus})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending || !creatorId || !subscriberId}>
          Open conversation
        </Button>
      </form>
    </Card>
  );
}
