"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

type Reply = { id: string; text: string; tone: string; internalReason: string };

type Generation = {
  id?: string;
  generationId?: string;
  status?: string;
  intent?: string | null;
  recommendedAction?: string | null;
  riskFlags?: string[];
  validationErrors?: string[];
  recommendedProductId?: string | null;
  approvedPrice?: number | null;
  approvedPriceCents?: number | null;
  replyOptions?: Reply[];
  chatterMessage?: string;
  blocked?: boolean;
  failed?: boolean;
  mockMode?: boolean;
  latencyMs?: number;
};

export function CopilotWorkspace(props: {
  conversation: {
    id: string;
    funnelStage: string;
    adultStatus: string;
    blocked: boolean;
    creatorName: string;
    subscriberName: string;
    personaName: string;
    explicitness: string;
    summary: string | null;
  };
  messages: { id: string; authorType: string; body: string; createdAt: string }[];
  memories: {
    id: string;
    category: string;
    key: string;
    value: string;
    confidence: number;
    verified: boolean;
  }[];
  products: { id: string; name: string; price: number; min: number }[];
  initialGeneration: Generation | null;
}) {
  const router = useRouter();
  const [fanText, setFanText] = useState("");
  const [generation, setGeneration] = useState<Generation | null>(props.initialGeneration);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function sendAsFan() {
    if (!fanText.trim()) return;
    setBusy(true);
    setNotice("");
    const res = await fetch(`/api/conversations/${props.conversation.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: fanText, autoReply: true }),
    });
    const json = await res.json();
    setFanText("");
    const gen = (json.generation ?? json) as Generation;
    setGeneration(gen);
    if (json.autoSent) {
      setNotice(`Sent as ${props.conversation.personaName}.`);
    } else if (gen.blocked) {
      setNotice(gen.chatterMessage || "Reply blocked.");
    } else if (gen.failed) {
      setNotice(gen.chatterMessage || "Provider failed.");
    } else if (gen.chatterMessage) {
      setNotice(gen.chatterMessage);
    }
    setBusy(false);
    router.refresh();
  }

  async function escalate() {
    setBusy(true);
    await fetch(`/api/conversations/${props.conversation.id}/escalate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "MANUAL" }),
    });
    setNotice("Escalation opened for a manager.");
    setBusy(false);
    router.refresh();
  }

  const ageBad =
    props.conversation.adultStatus === "UNCERTAIN" ||
    props.conversation.adultStatus.includes("MINOR");

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-canopy-400">
            Chat as the fan · {props.conversation.personaName} replies automatically
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {props.conversation.creatorName}
          </h1>
          <p className="mt-1 text-sm text-white/50">Fan: {props.conversation.subscriberName}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="accent">{props.conversation.funnelStage}</Badge>
            <Badge tone={ageBad ? "bad" : "good"}>{props.conversation.adultStatus}</Badge>
            <Badge>{props.conversation.explicitness}</Badge>
            {generation?.mockMode ? <Badge tone="warn">MOCK PROVIDER</Badge> : null}
          </div>
        </div>

        <Card className="max-h-[480px] space-y-3 overflow-y-auto">
          {props.messages.map((m) => {
            const fan = m.authorType === "SUBSCRIBER";
            return (
              <div key={m.id} className={fan ? "text-right" : "text-left"}>
                <div className="text-[11px] uppercase tracking-wide text-white/35">
                  {fan ? "You (fan)" : props.conversation.personaName}
                </div>
                <div
                  className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    fan ? "bg-white/10 text-white" : "bg-canopy-500/15 text-canopy-100"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-medium">Message as the subscriber</div>
          <Textarea
            value={fanText}
            onChange={(e) => setFanText(e.target.value)}
            placeholder="Type as the fan… she replies on her own"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendAsFan();
              }
            }}
          />
          <div className="flex gap-2">
            <Button onClick={() => void sendAsFan()} disabled={busy}>
              {busy ? "Replying…" : "Send"}
            </Button>
            <Button variant="danger" onClick={() => void escalate()} disabled={busy}>
              Escalate
            </Button>
          </div>
        </Card>

        {notice ? (
          <Card className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-100">{notice}</Card>
        ) : null}

        {generation?.blocked ? (
          <Card className="border-red-500/30 bg-red-500/10">
            <div className="text-sm font-medium text-red-200">Generation blocked</div>
            <p className="mt-2 text-sm text-red-100/80">{generation.chatterMessage}</p>
            <p className="mt-2 text-xs text-white/40">
              Flags: {(generation.riskFlags ?? []).join(", ") || "none"}
            </p>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <div className="text-xs text-white/40">Rolling summary</div>
          <p className="mt-2 text-sm text-white/70">{props.conversation.summary ?? "No summary yet."}</p>
        </Card>
        <Card>
          <div className="text-xs text-white/40">Subscriber memory</div>
          <ul className="mt-3 space-y-2 text-sm">
            {props.memories.length === 0 ? <li className="text-white/40">None stored.</li> : null}
            {props.memories.map((m) => (
              <li key={m.id}>
                <div className="text-[11px] text-white/40">
                  {m.category} · {m.verified ? "verified" : `guess ${m.confidence}`}
                </div>
                <div>
                  {m.key}: {m.value}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-xs text-white/40">Catalog (list first, min only after a no)</div>
          <ul className="mt-3 space-y-2 text-sm">
            {props.products.map((p) => (
              <li key={p.id}>
                {p.name} · ${p.price.toFixed(0)}
                <span className="text-white/40"> · floor ${p.min.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
