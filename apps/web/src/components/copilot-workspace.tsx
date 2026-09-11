"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FanNotesCard, type FanNoteValue } from "@/components/fan-notes-card";
import { splitReplyBubbles } from "@canopy/shared";

type Reply = { id: string; text: string; tone: string; internalReason: string; messages?: string[] };

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
  confidence?: number;
  funnelStage?: string;
};

export type InboxItem = {
  id: string;
  creatorName: string;
  fanName: string;
  unreadCount: number;
  intent?: string | null;
  spendTier: string;
  lastActivity: string;
  funnelStage: string;
};

const REWRITES = [
  { id: "SHORTER", label: "Shorter" },
  { id: "WARMER", label: "Warmer" },
  { id: "PLAYFUL", label: "More playful" },
  { id: "SALES", label: "More sales-focused" },
] as const;

function originLabel(message: { authorType: string; aiAssisted?: boolean; edited?: boolean }) {
  if (message.authorType === "SUBSCRIBER") return "Fan";
  if (message.authorType === "SYSTEM") return "System";
  if (message.edited) return "AI edited";
  if (message.aiAssisted) return "AI approved";
  if (message.authorType === "CHATTER") return "Manual";
  return "Creator";
}

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
    mutedAi: boolean;
    creatorId: string;
    subscriberId: string;
    activeSequenceId: string | null;
    activeSequenceStep: number;
    unansweredFollowUps: number;
    purchasedPpvCount: number;
  };
  messages: {
    id: string;
    authorType: string;
    body: string;
    createdAt: string;
    aiAssisted?: boolean;
    isPaid?: boolean;
    priceCents?: number | null;
    purchased?: boolean;
  }[];
  memories: {
    id: string;
    category: string;
    key: string;
    value: string;
    confidence: number;
    verified: boolean;
  }[];
  products: { id: string; name: string; price: number; min: number; second?: number | null }[];
  sequences: {
    id: string;
    name: string;
    kind: string;
    steps: { body: string; mediaHint: string; priceTier: number }[];
  }[];
  fanNote: FanNoteValue | null;
  spend: number;
  initialGeneration: Generation | null;
  inbox?: InboxItem[];
}) {
  const router = useRouter();
  const [fanText, setFanText] = useState("");
  const [generation, setGeneration] = useState<Generation | null>(props.initialGeneration);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [mutedAi, setMutedAi] = useState(props.conversation.mutedAi);
  const [sequenceId, setSequenceId] = useState(props.conversation.activeSequenceId ?? "");
  const [sequenceStep, setSequenceStep] = useState(props.conversation.activeSequenceStep);
  const [followUps, setFollowUps] = useState(props.conversation.unansweredFollowUps);
  const [purchasedPpvCount, setPurchasedPpvCount] = useState(props.conversation.purchasedPpvCount);

  const activeSequence = props.sequences.find((s) => s.id === sequenceId);
  const currentStep = activeSequence?.steps[sequenceStep];

  const replies = generation?.replyOptions ?? [];
  const generationId = generation?.generationId || generation?.id;
  const recommended = props.products.find((p) => p.id === generation?.recommendedProductId);
  const approvedPrice =
    generation?.approvedPrice ??
    (generation?.approvedPriceCents != null ? generation.approvedPriceCents / 100 : null);

  const inbox = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.inbox ?? [];
    return (props.inbox ?? []).filter(
      (item) =>
        item.fanName.toLowerCase().includes(q) ||
        item.creatorName.toLowerCase().includes(q) ||
        (item.intent ?? "").toLowerCase().includes(q),
    );
  }, [props.inbox, query]);

  async function sendAsFan() {
    if (!fanText.trim()) return;
    setBusy(true);
    setNotice("");
    const res = await fetch(`/api/conversations/${props.conversation.id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: fanText, autoReply: !mutedAi }),
    });
    const json = await res.json();
    setFanText("");
    setFollowUps(0);
    if (json.error) setNotice(json.error);
    else if (json.autoSent) {
      const gen = (json.generation ?? json) as Generation;
      setGeneration(gen);
      setDrafts(Object.fromEntries((gen.replyOptions ?? []).map((o) => [o.id, o.text])));
      setNotice("Autonomous reply sent in this chat.");
    } else if (json.muted || mutedAi) {
      setNotice("This chat is paused. Generate a suggestion, then insert if you want to reply.");
    } else {
      setNotice("Fan message saved. Generate suggestions in the copilot panel.");
    }
    setBusy(false);
    router.refresh();
  }

  async function patchConversation(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    const res = await fetch(`/api/conversations/${props.conversation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.error) setNotice(json.error);
    if (json.activeSequenceId !== undefined) setSequenceId(json.activeSequenceId ?? "");
    if (json.activeSequenceStep != null) setSequenceStep(json.activeSequenceStep);
    if (json.unansweredFollowUps != null) setFollowUps(json.unansweredFollowUps);
    if (json.purchasedPpvCount != null) setPurchasedPpvCount(json.purchasedPpvCount);
    if (json.inserted) setNotice("Sequence step inserted into the thread.");
    if (payload.markPurchased && json.purchasedPpvCount === 1) {
      setNotice("First PPV unlocked. Keep selling — no aftercare yet.");
    }
    if (payload.markPurchased && json.purchasedPpvCount >= 2) {
      setNotice("Second PPV unlocked. Aftercare is on.");
    }
    setBusy(false);
    router.refresh();
    return json;
  }

  async function generate(rewriteStyle?: (typeof REWRITES)[number]["id"]) {
    setBusy(true);
    setNotice("");
    const res = await fetch(`/api/conversations/${props.conversation.id}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: props.conversation.id, rewriteStyle, regenerate: true }),
    });
    const gen = (await res.json()) as Generation;
    setGeneration(gen);
    setDrafts(Object.fromEntries((gen.replyOptions ?? []).map((o) => [o.id, o.text])));
    if (gen.blocked) setNotice(gen.chatterMessage || "Reply blocked.");
    else if (gen.failed) setNotice(gen.chatterMessage || "Provider failed.");
    else if (gen.chatterMessage) setNotice(gen.chatterMessage);
    else setNotice(rewriteStyle ? `Rewritten (${rewriteStyle.toLowerCase()}).` : "Three suggestions ready. Approve before insert.");
    setBusy(false);
    router.refresh();
  }

  async function approve(option: Reply, inserted: boolean) {
    if (!generationId) return;
    setBusy(true);
    const res = await fetch(`/api/conversations/${props.conversation.id}/select-reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: props.conversation.id,
        generationId,
        replyOptionId: option.id,
        editedText: drafts[option.id] ?? option.text,
        inserted,
      }),
    });
    const json = await res.json();
    setNotice(inserted ? "Approved and inserted into the thread. Human still sends on the live platform." : "Approved.");
    if (json.error) setNotice(json.error);
    setBusy(false);
    router.refresh();
  }

  async function reject(option: Reply) {
    if (!generationId) return;
    setBusy(true);
    await fetch(`/api/conversations/${props.conversation.id}/select-reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: props.conversation.id,
        generationId,
        replyOptionId: option.id,
        discard: true,
        rejectReason: rejectReason || "Not a fit",
      }),
    });
    setNotice(`Rejected: ${rejectReason || "Not a fit"}`);
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
    props.conversation.adultStatus === "UNCERTAIN" || props.conversation.adultStatus.includes("MINOR");

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
      <aside className="space-y-3 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search inbox"
          className="h-9 w-full rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3 text-sm"
        />
        <div className="space-y-1">
          {inbox.map((item) => (
            <Link
              key={item.id}
              href={`/conversations/${item.id}`}
              className={cn(
                "block rounded-[10px] border border-transparent px-3 py-2 text-sm hover:bg-white/[0.04]",
                item.id === props.conversation.id && "border-canopy-500/30 bg-canopy-500/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.fanName}</span>
                {item.unreadCount ? <Badge tone="accent">{item.unreadCount}</Badge> : null}
              </div>
              <div className="truncate text-[11px] text-white/40">
                {item.creatorName} · {item.spendTier}
              </div>
              <div className="truncate text-[11px] text-white/35">
                {item.intent ?? item.funnelStage} · {new Date(item.lastActivity).toLocaleTimeString()}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-canopy-400">
            {props.conversation.personaName}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{props.conversation.creatorName}</h1>
          <p className="mt-1 text-sm text-white/50">Fan: {props.conversation.subscriberName}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="accent">{props.conversation.funnelStage}</Badge>
            <Badge tone={ageBad ? "bad" : "good"}>{props.conversation.adultStatus}</Badge>
            <Badge>{props.conversation.explicitness}</Badge>
            {generation?.mockMode ? <Badge tone="warn">MOCK PROVIDER</Badge> : null}
            <Badge tone={mutedAi ? "warn" : "good"}>{mutedAi ? "This chat paused" : "Autonomous on"}</Badge>
            {purchasedPpvCount > 0 ? (
              <Badge tone={purchasedPpvCount >= 2 ? "good" : "accent"}>
                {purchasedPpvCount >= 2 ? "Aftercare (2nd PPV)" : "1st PPV unlocked"}
              </Badge>
            ) : null}
            {followUps > 0 && purchasedPpvCount < 2 ? (
              <Badge tone="warn">
                {followUps === 1 ? "Follow-up · still list" : `Follow-up ${followUps} · discount ok`}
              </Badge>
            ) : null}
          </div>
        </div>

        <Card className="max-h-[560px] space-y-3 overflow-y-auto">
          {props.messages.map((m) => {
            const fan = m.authorType === "SUBSCRIBER";
            return (
              <div key={m.id} className={fan ? "text-right" : "text-left"}>
                <div className="text-[11px] uppercase tracking-wide text-white/35">
                  {originLabel(m)}
                </div>
                <div
                  className={cn(
                    "inline-block max-w-[85%] rounded-[12px] px-3 py-2 text-sm leading-relaxed",
                    fan ? "bg-white/10 text-white" : "bg-canopy-500/15 text-canopy-100",
                  )}
                >
                  {m.body}
                  {m.isPaid ? (
                    <div className="mt-2 rounded-[10px] border border-white/10 px-2 py-1 text-xs">
                      PPV {m.priceCents != null ? `$${(m.priceCents / 100).toFixed(0)}` : ""} ·{" "}
                      {m.purchased ? "unlocked" : "locked"}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="space-y-3">
          <div className="text-sm font-medium">Simulate fan (demo thread)</div>
          <Textarea
            value={fanText}
            onChange={(e) => setFanText(e.target.value)}
            placeholder="Type as the fan to add a message, then generate suggestions"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void sendAsFan()} disabled={busy}>
              Add fan message
            </Button>
            <Button variant="danger" onClick={() => void escalate()} disabled={busy}>
              Escalate to manager
            </Button>
            <Button
              variant={mutedAi ? "secondary" : "outline"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const next = !mutedAi;
                const res = await fetch(`/api/conversations/${props.conversation.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ mutedAi: next }),
                });
                const json = await res.json();
                if (json.error) setNotice(json.error);
                else {
                  setMutedAi(next);
                  setNotice(
                    next
                      ? "Autonomous replies off for this chat only."
                      : "Autonomous replies on for this chat.",
                  );
                }
                setBusy(false);
                router.refresh();
              }}
            >
              {mutedAi ? "Resume this chat" : "Pause this chat"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void patchConversation({ noReplyFollowUp: true })}
            >
              No reply — next follow-up
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void patchConversation({ markPurchased: true })}
            >
              Fan unlocked PPV
            </Button>
          </div>
        </Card>
        {notice ? <Card className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-100">{notice}</Card> : null}
      </section>

      <aside className="space-y-3 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Canopy copilot</div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void generate()}>
              {busy ? "Generating…" : replies.length ? "Regenerate" : "Generate"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {REWRITES.map((r) => (
              <Button key={r.id} size="sm" variant="outline" disabled={busy} onClick={() => void generate(r.id)}>
                {r.label}
              </Button>
            ))}
          </div>
          {generation?.blocked ? (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              Safety warning: {generation.chatterMessage}
              <div className="mt-1 text-xs">{(generation.riskFlags ?? []).join(", ") || "blocked"}</div>
            </div>
          ) : null}
          {replies.length ? (
            <ul className="space-y-3">
              {replies.map((option, index) => (
                <li key={option.id} className="rounded-[10px] border border-white/[0.06] p-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-white/40">
                    <span>
                      Suggestion {index + 1} · {option.tone}
                    </span>
                    <span>AI-generated</span>
                  </div>
                  <div className="mb-2 space-y-1">
                    {splitReplyBubbles(drafts[option.id] ?? option.text, { splitSentences: true }).map(
                      (bubble, bi) => (
                        <div
                          key={`${option.id}-b${bi}`}
                          className="block w-fit max-w-[95%] rounded-[12px] bg-canopy-500/15 px-3 py-1.5 text-sm text-canopy-100"
                        >
                          {bubble}
                        </div>
                      ),
                    )}
                  </div>
                  <Textarea
                    value={drafts[option.id] ?? option.text}
                    onChange={(e) => setDrafts((d) => ({ ...d, [option.id]: e.target.value }))}
                    className="min-h-[96px] whitespace-pre-wrap"
                  />
                  <p className="mt-1 text-[11px] text-white/35">
                    One bubble per line. Insert sends each line as its own message. {option.internalReason}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" disabled={busy} onClick={() => void approve(option, true)}>
                      Approve and insert
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void reject(option)}>
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/40">No suggestions yet. Generate after the latest fan message.</p>
          )}
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reject reason"
            className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-3 text-sm"
          />
        </Card>
        <Card className="space-y-3">
          <div className="text-sm font-medium">Sequence</div>
          <select
            className="h-9 w-full rounded-[10px] border border-white/10 bg-ink-900 px-2 text-sm"
            value={sequenceId}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value;
              setSequenceId(next);
              void patchConversation({ activeSequenceId: next || null });
            }}
          >
            <option value="">No sequence</option>
            {props.sequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kind}: {s.name}
              </option>
            ))}
          </select>
          {currentStep ? (
            <div className="space-y-2">
              <div className="rounded-[10px] border border-white/10 p-2 text-sm text-white/70">
                <div className="text-[11px] uppercase tracking-wide text-white/35">
                  Step {sequenceStep + 1}/{activeSequence?.steps.length} · {currentStep.mediaHint} · price tier{" "}
                  {currentStep.priceTier}
                </div>
                {currentStep.body}
              </div>
              <p className="text-xs text-white/40">
                Stay on this beat. If he goes off-script, the AI acks once then continues this step.
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/40">Pick a sequence to pin the next script beat for this chat.</p>
          )}
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !currentStep}
              onClick={() => void patchConversation({ insertSequenceStep: true })}
            >
              Insert this step
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !sequenceId}
              onClick={() => void patchConversation({ advanceSequence: true })}
            >
              Next step
            </Button>
          </div>
        </Card>
        <FanNotesCard
          creatorId={props.conversation.creatorId}
          subscriberId={props.conversation.subscriberId}
          creatorName={props.conversation.creatorName}
          fanName={props.conversation.subscriberName}
          spend={props.spend}
          initial={props.fanNote}
        />
        <Card className="space-y-2 text-sm">
          <div>Detected intent: {generation?.intent ?? "—"}</div>
          <div>Funnel stage: {generation?.funnelStage ?? props.conversation.funnelStage}</div>
          <div>Recommended next action: {generation?.recommendedAction ?? "—"}</div>
          <div>
            Recommended product:{" "}
            {recommended ? `${recommended.name} · $${approvedPrice ?? recommended.price}` : "none"}
          </div>
          <div>Confidence: {generation?.confidence != null ? generation.confidence.toFixed(2) : "not scored"}</div>
        </Card>
        <Card>
          <div className="text-xs text-white/40">Relevant memory</div>
          <ul className="mt-2 space-y-2 text-sm">
            {props.memories.length === 0 ? <li className="text-white/40">None stored.</li> : null}
            {props.memories.map((m) => (
              <li key={m.id}>
                <div className="text-[11px] text-white/40">
                  {m.category} · {m.verified ? "verified" : `guess ${m.confidence}`}
                </div>
                {m.key}: {m.value}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="text-xs text-white/40">Rolling summary</div>
          <p className="mt-2 text-sm text-white/70">{props.conversation.summary ?? "No summary yet."}</p>
        </Card>
      </aside>
    </div>
  );
}
