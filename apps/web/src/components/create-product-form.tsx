"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

export function CreateProductForm({ creators }: { creators: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    creatorId: creators[0]?.id ?? "",
    mediaType: "PHOTO",
    standardPrice: 25,
    minimumPrice: 20,
    tags: "tease, gfe",
    available: true,
    source: "MANUAL",
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <Card>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmit}>
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <Label>Creator</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={form.creatorId}
            onChange={(e) => setForm({ ...form, creatorId: e.target.value })}
          >
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Media</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-white/10 bg-ink-900 px-2 text-sm"
            value={form.mediaType}
            onChange={(e) => setForm({ ...form, mediaType: e.target.value })}
          >
            {["PHOTO", "VIDEO", "AUDIO", "TEXT", "BUNDLE", "CUSTOM"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Standard price</Label>
          <Input
            type="number"
            value={form.standardPrice}
            onChange={(e) => setForm({ ...form, standardPrice: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Minimum price</Label>
          <Input
            type="number"
            value={form.minimumPrice}
            onChange={(e) => setForm({ ...form, minimumPrice: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Tags</Label>
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => setForm({ ...form, available: e.target.checked })}
          />
          Available
        </label>
        <div className="md:col-span-3">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <Button type="submit" disabled={busy}>
          Add product
        </Button>
      </form>
    </Card>
  );
}
