"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Send,
  Smile,
  ImagePlus,
  FolderOpen,
  Mic,
  Tag,
  DollarSign,
  Eye,
  Bookmark,
  Sparkles,
  MoreHorizontal,
  Play,
  LayoutGrid,
  List,
  Lock,
  Unlock,
} from "lucide-react";
import { Avatar, MediaThumb } from "./media-thumb";
import {
  DEMO_CHATTER,
  demoConversations,
  demoCreators,
  demoProducts,
  demoSubscribers,
  demoVault,
} from "./seed";
import type {
  DemoAttachment,
  DemoConversation,
  DemoLineage,
  DemoMemory,
  DemoMessage,
  DemoProduct,
  DemoSubscriber,
  DemoSuggestion,
  DemoVaultItem,
} from "./types";
import { eligibleProducts } from "@canopy/shared";

const FILTERS = ["All", "Unread", "High value", "Follow-up", "Escalated"] as const;
const INTEL_TABS = ["AI Copilot", "Subscriber", "Products", "Vault", "Activity", "Debug"] as const;

function cloneConvos() {
  return demoConversations.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, attachments: [...m.attachments] })), tags: [...c.tags] }));
}

export function DemoWorkspace() {
  const [creatorId, setCreatorId] = useState("creator_maya");
  const [conversations, setConversations] = useState(cloneConvos);
  const [subscribers, setSubscribers] = useState(() => demoSubscribers.map((s) => ({ ...s, memories: [...s.memories] })));
  const [products, setProducts] = useState(demoProducts);
  const [vault] = useState(demoVault);
  const [activeId, setActiveId] = useState("conv_alex");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "spend">("recent");
  const [tab, setTab] = useState<(typeof INTEL_TABS)[number]>("AI Copilot");
  const [draft, setDraft] = useState("");
  const [enterToSend, setEnterToSend] = useState(false);
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState<number | "">("");
  const [attached, setAttached] = useState<DemoAttachment[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DemoSuggestion[]>([]);
  const [sugIndex, setSugIndex] = useState(0);
  const [originalSuggestion, setOriginalSuggestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [intent, setIntent] = useState("CONTENT_REQUEST");
  const [action, setAction] = useState("PRESENT_OFFER");
  const [risk, setRisk] = useState<string[]>([]);
  const [lineage, setLineage] = useState<DemoLineage | null>(null);
  const [drawer, setDrawer] = useState<"vault" | "saved" | "emoji" | "price" | "more" | null>(null);
  const [vaultMode, setVaultMode] = useState<"grid" | "list">("grid");
  const [vaultQuery, setVaultQuery] = useState("");
  const [vaultType, setVaultType] = useState("ALL");
  const [selectedVault, setSelectedVault] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("ALL");
  const [demoStep, setDemoStep] = useState(0);
  const [tip, setTip] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(["mmm you caught me between sets", "that's $25 if you actually want it"]);

  const creator = demoCreators.find((c) => c.id === creatorId)!;
  const convo = conversations.find((c) => c.id === activeId)!;
  const sub = subscribers.find((s) => s.id === convo.subscriberId)!;

  const list = useMemo(() => {
    return conversations
      .filter((c) => c.creatorId === creatorId)
      .filter((c) => {
        const s = subscribers.find((x) => x.id === c.subscriberId)!;
        if (query && !`${s.displayName} ${s.username} ${c.lastMessage}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (filter === "Unread") return c.unreadCount > 0;
        if (filter === "High value") return c.highValue;
        if (filter === "Follow-up") return c.followUp;
        if (filter === "Escalated") return c.escalated;
        return true;
      })
      .sort((a, b) => (sort === "spend" ? b.spend - a.spend : b.lastMessageAt.localeCompare(a.lastMessageAt)));
  }, [conversations, creatorId, filter, query, sort, subscribers]);

  const creatorProducts = products.filter((p) => p.creatorId === creatorId);
  const eligible = eligibleProducts({
    products: creatorProducts.map((p) => ({ ...p, organizationId: "demo" })),
    creatorId,
    purchasedProductIds: sub.purchasedProductIds,
  });

  const updateConvo = (id: string, patch: Partial<DemoConversation> | ((c: DemoConversation) => DemoConversation)) => {
    setConversations((rows) =>
      rows.map((c) => (c.id !== id ? c : typeof patch === "function" ? patch(c) : { ...c, ...patch })),
    );
  };

  const selectConvo = (id: string) => {
    setActiveId(id);
    setSuggestions([]);
    setDrawer(null);
    setAttached([]);
    setProductId(null);
    setPaid(false);
    setPrice("");
    setDraft("");
    updateConvo(id, (c) => ({
      ...c,
      unreadCount: 0,
      messages: c.messages.map((m) => ({ ...m, read: true })),
    }));
  };

  const generate = useCallback(
    async (toneOverride?: DemoSuggestion["tone"]) => {
      if (convo.mutedAi) {
        setTip("AI suggestions are muted for this thread.");
        return;
      }
      setGenerating(true);
      setTab("AI Copilot");
      const last = [...convo.messages].reverse().find((m) => m.authorType === "SUBSCRIBER")?.body ?? "";
      const res = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          creatorId,
          subscriberMessage: last,
          recentMessages: convo.messages.map((m) => ({ authorType: m.authorType, body: m.body })),
          funnelStage: convo.funnelStage,
          purchasedProductIds: sub.purchasedProductIds,
          products: creatorProducts,
          persona: { displayName: creator.displayName, style: creator.style },
          toneOverride,
          concessionAllowed: convo.funnelStage === "OBJECTION",
        }),
      });
      const json = await res.json();
      setGenerating(false);
      setIntent(json.intent ?? "UNCERTAIN");
      setAction(json.recommendedAction ?? "REPLY");
      setRisk(json.riskFlags ?? []);
      setSuggestions(json.suggestions ?? []);
      setSugIndex(0);
      setOriginalSuggestion("");
      const rec = json.product;
      setLineage({
        subscriberMessage: last,
        intent: json.intent,
        funnelStage: json.funnelStage,
        productQuery: `organization=demo creator=${creatorId} available=true notPurchased`,
        eligibleProductIds: json.eligibleProductIds ?? [],
        retrievedExamples: ["Tease then name a real catalog item at list price."],
        model: "Demo model",
        validation: json.validationErrors?.length ? json.validationErrors : ["ok"],
        chatterApproval: "pending",
        finalMessage: "",
        product: rec
          ? {
              id: rec.id,
              externalId: rec.externalId ?? "",
              source: rec.source,
              creatorId: rec.creatorId,
              standardPrice: rec.standardPrice,
              minimumPrice: rec.minimumPrice,
              recommendedPrice: rec.recommendedPrice,
              checks: rec.checks
                ? Object.entries(rec.checks)
                    .filter(([, v]) => v)
                    .map(([k]) => k)
                : json.validationErrors?.length
                  ? json.validationErrors
                  : ["exists", "correct creator", "available", "price in range"],
              mediaIds: rec.mediaIds,
              previewIds: rec.previewIds,
              previouslyPurchased: sub.purchasedProductIds.includes(rec.id),
              whyEligible: "Same creator, available, not already purchased.",
              whySelected: "Matched fan request / funnel offer.",
            }
          : undefined,
      });
    },
    [convo, creator, creatorId, creatorProducts, sub.purchasedProductIds],
  );

  function insertSuggestion(s: DemoSuggestion) {
    setDraft(s.text);
    setOriginalSuggestion(s.text);
    if (s.productId) {
      const p = products.find((x) => x.id === s.productId);
      if (p) attachProduct(p, true, s.price ?? p.standardPrice);
    }
    setLineage((l) =>
      l
        ? {
            ...l,
            chatterApproval: "inserted into composer",
            finalMessage: s.text,
            originalSuggestion: s.text,
            editedText: s.text,
            chatterIdentity: DEMO_CHATTER,
          }
        : l,
    );
  }

  function attachProduct(p: DemoProduct, asPaid: boolean, offerPrice?: number) {
    const item = vault.find((v) => v.productId === p.id && v.placeholderKind !== "FREE_PREVIEW") ?? vault.find((v) => v.id === p.mediaIds[0]);
    const preview = vault.find((v) => p.previewIds.includes(v.id));
    setProductId(p.id);
    setPaid(asPaid);
    setPrice(asPaid ? offerPrice ?? p.standardPrice : 0);
    const atts: DemoAttachment[] = [];
    if (preview) {
      atts.push({ id: preview.id, kind: "FREE_PREVIEW", label: "Free preview", paid: false, purchased: true, preview: true });
      setPreviewId(preview.id);
    }
    if (item) {
      atts.push({
        id: item.id,
        kind: item.placeholderKind,
        label: item.title,
        paid: asPaid,
        purchased: false,
        price: asPaid ? offerPrice ?? p.standardPrice : undefined,
      });
    }
    setAttached(atts);
    setDrawer(null);
  }

  function send() {
    const text = draft.trim();
    if (!text && attached.length === 0) return;
    const p = products.find((x) => x.id === productId);
    if (paid && p && typeof price === "number") {
      if (price < p.minimumPrice || price > p.standardPrice) {
        setTip(`Price must be between $${p.minimumPrice} and $${p.standardPrice}.`);
        return;
      }
    }
    const message: DemoMessage = {
      id: `out_${Date.now()}`,
      authorType: "CHATTER",
      body: text,
      createdAt: new Date().toISOString(),
      read: true,
      aiAssisted: suggestions.some((s) => s.text === text || draft.includes(s.text.slice(0, 18))),
      chatterName: DEMO_CHATTER,
      attachments: attached,
    };
    updateConvo(activeId, (c) => ({
      ...c,
      lastMessage: text || "Paid message",
      lastMessageAt: message.createdAt,
      messages: [...c.messages, message],
    }));
    setLineage((l) =>
      l
        ? {
            ...l,
            chatterApproval: `${DEMO_CHATTER} sent`,
            finalMessage: text,
            originalSuggestion: originalSuggestion || l.originalSuggestion,
            editedText: text,
            chatterIdentity: DEMO_CHATTER,
            approvedAt: new Date().toISOString(),
          }
        : l,
    );
    const sentPaid = paid && typeof price === "number" && price > 0;
    const sentProductId = productId;
    const sentPrice = typeof price === "number" ? price : 0;
    setDraft("");
    setAttached([]);
    setPaid(false);
    setPrice("");
    setProductId(null);
    setPreviewId(null);
    setDrawer(null);
    if (sentPaid && sentProductId) {
      window.setTimeout(() => {
        const sys: DemoMessage = {
          id: `sys_${Date.now()}`,
          authorType: "SYSTEM",
          body: `${sub.displayName} purchased ${p?.name ?? "content"} · $${sentPrice}`,
          createdAt: new Date().toISOString(),
          read: true,
          attachments: [],
        };
        updateConvo(activeId, (c) => ({
          ...c,
          spend: c.spend + sentPrice,
          funnelStage: "PURCHASE",
          messages: c.messages.map((m) =>
            m.id === message.id
              ? { ...m, attachments: m.attachments.map((a) => ({ ...a, purchased: true })) }
              : m,
          ).concat(sys),
        }));
        setSubscribers((rows) =>
          rows.map((s) =>
            s.id === sub.id
              ? {
                  ...s,
                  spend: s.spend + sentPrice,
                  lastPurchase: new Date().toISOString().slice(0, 10),
                  purchasedProductIds: [...s.purchasedProductIds, sentProductId],
                }
              : s,
          ),
        );
        setProducts((rows) =>
          rows.map((p) =>
            p.id === sentProductId
              ? { ...p, timesSold: p.timesSold + 1, conversionRate: Math.min(0.99, p.conversionRate + 0.02) }
              : p,
          ),
        );
        setTip("Purchase simulated. Spend and catalog history updated.");
      }, 1200);
    }
  }

  async function runDemo() {
    setCreatorId("creator_maya");
    selectConvo("conv_alex");
    setDemoStep(1);
    setTip("1–2. Alex is selected with the girlcock request waiting.");
    setTab("AI Copilot");
    await new Promise((r) => setTimeout(r, 350));
    setDemoStep(4);
    setTip("3–6. Intent, funnel and eligible vault products are queried…");
    await generate();
    setDemoStep(7);
    setTip("7–12. Pick a suggestion, attach paid media + preview, then click Send yourself.");
    setTab("Debug");
    await new Promise((r) => setTimeout(r, 600));
    setTab("AI Copilot");
  }

  const savedResponses = saved;

  return (
    <div className="demo-shell flex h-screen flex-col bg-[#f3f5f7] text-slate-800">
      <header className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-500 text-xs font-bold text-white">C</div>
          <span className="text-sm font-semibold tracking-tight">Canopy</span>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200">
            Demo environment
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            className="inline-flex h-8 items-center gap-1 rounded-md bg-teal-600 px-3 font-medium text-white hover:bg-teal-500"
            onClick={() => void runDemo()}
          >
            <Play size={12} /> Run demo
          </button>
          <Link className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" href="/demo/products">
            Products
          </Link>
          <Link className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" href="/demo/automations/welcome-message">
            Welcome
          </Link>
          <Link className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" href="/login">
            Sign in
          </Link>
        </div>
      </header>
      {tip ? (
        <div className="border-b border-teal-100 bg-teal-50 px-4 py-1.5 text-xs text-teal-900">
          {tip} {demoStep ? `· step ${demoStep}` : ""}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-3">
            <label className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Creator</label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
              value={creatorId}
              onChange={(e) => {
                const next = e.target.value;
                setCreatorId(next);
                const first = conversations.find((c) => c.creatorId === next);
                if (first) selectConvo(first.id);
              }}
            >
              {demoCreators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <div className="relative mt-2">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm"
                placeholder="Search chats"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    filter === f ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              className="mt-2 h-8 w-full rounded-md border border-slate-200 text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value as "recent" | "spend")}
            >
              <option value="recent">Sort: recent</option>
              <option value="spend">Sort: spend</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.map((c) => {
              const s = subscribers.find((x) => x.id === c.subscriberId)!;
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => selectConvo(c.id)}
                  className={`flex w-full gap-2 border-b border-slate-100 px-3 py-2.5 text-left ${
                    active ? "bg-teal-50" : "hover:bg-slate-50"
                  }`}
                >
                  <Avatar initials={s.initials} hue={s.hue} online={c.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-medium">{s.displayName}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-400">@{s.username}</div>
                    <div className="truncate text-xs text-slate-500">{c.lastMessage}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">${c.spend}</span>
                      <span className="rounded bg-teal-50 px-1.5 text-[10px] text-teal-700">{c.funnelStage}</span>
                      {c.escalated ? <span className="rounded bg-red-50 px-1.5 text-[10px] text-red-600">Escalated</span> : null}
                      {c.unreadCount ? (
                        <span className="rounded-full bg-teal-600 px-1.5 text-[10px] text-white">{c.unreadCount}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#eef1f4]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
            <div className="flex items-center gap-3">
              <Avatar initials={sub.initials} hue={sub.hue} online={convo.online} size={40} />
              <div>
                <div className="text-sm font-semibold">
                  {sub.displayName} <span className="font-normal text-slate-400">@{sub.username}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {convo.online ? "Online" : "Offline"} · ${sub.spend} spent · subscribed {sub.subscribedAt} · {creator.displayName} · {convo.assignedChatter}
                </div>
                <div className="mt-1 flex gap-1">
                  {convo.tags.map((t) => (
                    <span key={t} className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative">
              <button className="rounded-md p-2 hover:bg-slate-100" onClick={() => setDrawer(drawer === "more" ? null : "more")}>
                <MoreHorizontal size={18} />
              </button>
              {drawer === "more" ? (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  {[
                    ["Add note", () => setNote(sub.notes || "Follow up tomorrow.")],
                    ["Add tag", () => updateConvo(activeId, { tags: [...new Set([...convo.tags, "priority"])] })],
                    ["Mark follow-up", () => updateConvo(activeId, { followUp: true })],
                    ["Escalate", () => updateConvo(activeId, { escalated: true })],
                    ["View subscriber profile", () => setTab("Subscriber")],
                    [convo.mutedAi ? "Unmute AI" : "Mute AI suggestions", () => updateConvo(activeId, { mutedAi: !convo.mutedAi })],
                  ].map(([label, fn]) => (
                    <button
                      key={String(label)}
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        (fn as () => void)();
                        setDrawer(null);
                      }}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {convo.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>

          {drawer === "vault" ? (
            <VaultPanel
              items={vault.filter((v) => v.creatorId === creatorId)}
              mode={vaultMode}
              setMode={setVaultMode}
              query={vaultQuery}
              setQuery={setVaultQuery}
              type={vaultType}
              setType={setVaultType}
              selected={selectedVault}
              setSelected={setSelectedVault}
              onClose={() => setDrawer(null)}
              onAttach={(item, asPaid) => {
                const p = products.find((x) => x.id === item.productId) ?? creatorProducts[0];
                if (p) attachProduct(p, asPaid);
              }}
              onPreview={(item) => {
                setPreviewId(item.id);
                setAttached((a) => [
                  ...a.filter((x) => x.kind !== "FREE_PREVIEW"),
                  { id: item.id, kind: "FREE_PREVIEW", label: "Free preview", paid: false, purchased: true, preview: true },
                ]);
              }}
              onCreateProduct={(item) => {
                const id = `prod_media_${Date.now()}`;
                setProducts((rows) => [
                  {
                    id,
                    creatorId,
                    name: item.title,
                    description: item.description,
                    mediaType: item.mediaType,
                    standardPrice: item.defaultPrice,
                    minimumPrice: item.minimumPrice,
                    tags: item.tags,
                    available: true,
                    source: "MEDIA_UPLOAD",
                    timesSold: 0,
                    conversionRate: 0,
                    lastSyncedAt: new Date().toISOString(),
                    externalId: item.id,
                    mediaIds: [item.id],
                    previewIds: [],
                  },
                  ...rows,
                ]);
              }}
              onSetPrice={(item) => {
                const p = products.find((x) => x.id === item.productId);
                if (p) {
                  attachProduct(p, true, p.standardPrice);
                  setDrawer("price");
                }
              }}
              purchasedIds={sub.purchasedProductIds}
            />
          ) : null}

          <div className="border-t border-slate-200 bg-white p-3">
            {attached.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {attached.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-1 pr-2 text-[11px]">
                    <MediaThumb kind={a.kind} compact />
                    {a.label}
                    {a.paid ? ` · $${a.price}` : " · free"}
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-400"
              placeholder="Write a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setDrawer(null);
                if (e.key === "ArrowDown" && suggestions.length) {
                  e.preventDefault();
                  const next = (sugIndex + 1) % suggestions.length;
                  setSugIndex(next);
                  insertSuggestion(suggestions[next]!);
                }
                if (e.key === "ArrowUp" && suggestions.length) {
                  e.preventDefault();
                  const next = (sugIndex - 1 + suggestions.length) % suggestions.length;
                  setSugIndex(next);
                  insertSuggestion(suggestions[next]!);
                }
                if (e.key === "Enter" && !e.shiftKey && enterToSend) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <IconBtn title="Emoji" onClick={() => setDrawer(drawer === "emoji" ? null : "emoji")}>
                <Smile size={16} />
              </IconBtn>
              <IconBtn title="Add media" onClick={() => setDrawer("vault")}>
                <ImagePlus size={16} />
              </IconBtn>
              <IconBtn title="Open vault" onClick={() => setDrawer("vault")}>
                <FolderOpen size={16} />
              </IconBtn>
              <IconBtn
                title="Add voice note"
                onClick={() =>
                  setAttached((a) => [...a, { id: "voice_new", kind: "VOICE_NOTE", label: "Voice note", paid: false, purchased: true }])
                }
              >
                <Mic size={16} />
              </IconBtn>
              <IconBtn title="Add product" onClick={() => setTab("Products")}>
                <Tag size={16} />
              </IconBtn>
              <IconBtn title="Set price" onClick={() => setDrawer(drawer === "price" ? null : "price")}>
                <DollarSign size={16} />
              </IconBtn>
              <IconBtn
                title="Add free preview"
                onClick={() => {
                  const prev = vault.find((v) => v.creatorId === creatorId && v.placeholderKind === "FREE_PREVIEW");
                  if (prev) {
                    setPreviewId(prev.id);
                    setAttached((a) => [
                      ...a.filter((x) => x.kind !== "FREE_PREVIEW"),
                      { id: prev.id, kind: "FREE_PREVIEW", label: "Free preview", paid: false, purchased: true, preview: true },
                    ]);
                  }
                }}
              >
                <Eye size={16} />
              </IconBtn>
              <IconBtn title="Saved responses" onClick={() => setDrawer(drawer === "saved" ? null : "saved")}>
                <Bookmark size={16} />
              </IconBtn>
              <button
                className="ml-1 inline-flex h-8 items-center gap-1 rounded-md bg-teal-50 px-2 text-xs font-medium text-teal-800 ring-1 ring-teal-200"
                onClick={() => void generate()}
                disabled={generating || convo.mutedAi}
              >
                <Sparkles size={14} /> {generating ? "Generating…" : "Generate with Canopy"}
              </button>
              <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                <input type="checkbox" checked={enterToSend} onChange={(e) => setEnterToSend(e.target.checked)} />
                Enter to send
              </label>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-500"
                onClick={send}
              >
                <Send size={14} /> Send
              </button>
            </div>
            {drawer === "emoji" ? (
              <div className="mt-2 flex gap-1 text-lg">
                {["😏", "💋", "🤍", "🔥", "🥺"].map((e) => (
                  <button key={e} onClick={() => setDraft((d) => d + e)}>
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
            {drawer === "saved" ? (
              <div className="mt-2 space-y-1">
                {savedResponses.map((s) => (
                  <button key={s} className="block w-full rounded-md bg-slate-50 px-2 py-1 text-left text-xs" onClick={() => setDraft(s)}>
                    {s}
                  </button>
                ))}
                <button
                  className="text-[11px] text-teal-700"
                  onClick={() => {
                    if (draft.trim()) setSaved((rows) => [...rows, draft.trim()]);
                  }}
                >
                  Save current draft
                </button>
              </div>
            ) : null}
            {drawer === "price" ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  Paid
                  <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                </label>
                <input
                  type="number"
                  className="h-8 w-24 rounded border border-slate-200 px-2"
                  value={price}
                  onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Price"
                />
                {productId ? (
                  <span className="text-slate-500">
                    min ${products.find((p) => p.id === productId)?.minimumPrice} · list $
                    {products.find((p) => p.id === productId)?.standardPrice}
                  </span>
                ) : (
                  <span className="text-slate-400">Pick a product first</span>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="flex w-[400px] shrink-0 flex-col border-l border-slate-200 bg-white">
          <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
            {INTEL_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  tab === t ? "bg-teal-600 text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
            {tab === "AI Copilot" ? (
              <div className="space-y-3">
                <Row k="Intent" v={intent} />
                <Row k="Funnel" v={convo.funnelStage} />
                <Row k="Next action" v={action} />
                  <Row k="Prompt" v="canopy-copilot-v22" />
                <Row k="Model" v="Demo model" />
                <p className="text-xs text-slate-500">{convo.summary}</p>
                {risk.length ? <p className="text-xs text-amber-700">Flags: {risk.join(", ")}</p> : null}
                <div className="flex gap-1">
                  <button className="rounded bg-slate-100 px-2 py-1 text-xs" onClick={() => void generate()}>
                    Regenerate
                  </button>
                </div>
                {generating ? <p className="text-xs text-teal-700">Demo AI response · generating…</p> : null}
                {suggestions.map((s, i) => (
                  <div key={s.id} className={`rounded-lg border p-2 ${i === sugIndex ? "border-teal-400" : "border-slate-200"}`}>
                    <div className="mb-1 flex justify-between text-[10px] uppercase text-slate-400">
                      <span>{s.tone}</span>
                      <span>Demo AI response</span>
                    </div>
                    <p className="text-sm">{s.text}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{s.internalReason}</p>
                    {s.productId ? (
                      <p className="mt-1 text-[11px] text-teal-700">
                        {products.find((p) => p.id === s.productId)?.name} · ${s.price}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Mini onClick={() => insertSuggestion(s)}>Insert</Mini>
                      <Mini
                        onClick={() => {
                          setDraft(s.text);
                          setOriginalSuggestion(s.text);
                        }}
                      >
                        Edit
                      </Mini>
                      <Mini onClick={() => void generate()}>Regenerate</Mini>
                      <Mini onClick={() => void generate("ROMANTIC")}>Softer</Mini>
                      <Mini onClick={() => void generate("PLAYFUL")}>More playful</Mini>
                      <Mini onClick={() => void generate("DIRECT")}>More direct</Mini>
                      <Mini onClick={() => void generate("TEASING")}>More explicit</Mini>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "Subscriber" ? (
              <div className="space-y-2">
                <Row k="Spend" v={`$${sub.spend}`} />
                <Row k="Avg purchase" v={`$${sub.avgPurchase}`} />
                <Row k="Subscribed" v={sub.subscribedAt} />
                <Row k="Last purchase" v={sub.lastPurchase ?? "—"} />
                <Row k="Last active" v={sub.lastActive} />
                <Row k="Tone" v={sub.preferredTone} />
                <Row k="Interests" v={sub.interests.join(", ") || "—"} />
                <Row k="Boundaries" v={sub.boundaries.join(", ") || "—"} />
                <Row k="Objections" v={sub.objections.join(", ") || "—"} />
                <Row k="Purchased" v={sub.purchasedProductIds.map((id) => products.find((p) => p.id === id)?.name).join(", ") || "—"} />
                <Row k="Offered" v={sub.offeredProductIds.map((id) => products.find((p) => p.id === id)?.name).join(", ") || "—"} />
                <Row k="Follow-up" v={sub.followUpAt ?? "—"} />
                <p className="text-xs text-slate-500">{note || sub.notes}</p>
                <div className="pt-2 text-xs font-medium">Memories</div>
                {sub.memories.map((m) => (
                  <MemoryRow
                    key={m.id}
                    memory={m}
                    onChange={(next) =>
                      setSubscribers((rows) =>
                        rows.map((s) =>
                          s.id === sub.id ? { ...s, memories: s.memories.map((x) => (x.id === m.id ? next : x)) } : s,
                        ),
                      )
                    }
                    onDelete={() =>
                      setSubscribers((rows) =>
                        rows.map((s) => (s.id === sub.id ? { ...s, memories: s.memories.filter((x) => x.id !== m.id) } : s)),
                      )
                    }
                  />
                ))}
              </div>
            ) : null}

            {tab === "Products" ? (
              <div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {["ALL", "PHOTO", "VIDEO", "AUDIO", "BUNDLE", "CUSTOM", "Purchased", "Not purchased", "Recommended"].map((f) => (
                    <button
                      key={f}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${productFilter === f ? "bg-teal-600 text-white" : "bg-slate-100"}`}
                      onClick={() => setProductFilter(f)}
                    >
                      {f === "PHOTO" ? "Photos" : f === "VIDEO" ? "Videos" : f === "AUDIO" ? "Voice" : f === "BUNDLE" ? "Bundles" : f}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {creatorProducts
                    .filter((p) => {
                      if (productFilter === "Purchased") return sub.purchasedProductIds.includes(p.id);
                      if (productFilter === "Not purchased") return !sub.purchasedProductIds.includes(p.id);
                      if (productFilter === "Recommended") return eligible.eligible.some((e) => e.id === p.id);
                      if (["PHOTO", "VIDEO", "AUDIO", "BUNDLE", "CUSTOM"].includes(productFilter)) return p.mediaType === productFilter;
                      return true;
                    })
                    .map((p) => (
                      <div key={p.id} className="rounded-lg border border-slate-200 p-2">
                        <div className="flex gap-2">
                          <MediaThumb kind={p.mediaType === "AUDIO" ? "VOICE_NOTE" : p.mediaType === "BUNDLE" ? "PREMIUM_BUNDLE" : p.mediaType === "VIDEO" ? "SHORT_VIDEO" : "PHOTO_SET"} compact />
                          <div className="min-w-0">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {p.mediaType} · ${p.standardPrice} list · min ${p.minimumPrice}
                              {p.bundlePrice ? ` · bundle $${p.bundlePrice}` : ""}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {p.tags.join(" · ")} · {p.available ? "available" : "off"} · sold {p.timesSold} ·{" "}
                              {Math.round(p.conversionRate * 100)}% · {p.source} · synced {p.lastSyncedAt.slice(0, 10)}
                            </div>
                            <div className="mt-1 flex gap-1">
                              <Mini onClick={() => attachProduct(p, true)}>Add paid</Mini>
                              <Mini onClick={() => attachProduct(p, false)}>Add free</Mini>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {tab === "Vault" ? (
              <VaultPanel
                items={vault.filter((v) => v.creatorId === creatorId)}
                mode={vaultMode}
                setMode={setVaultMode}
                query={vaultQuery}
                setQuery={setVaultQuery}
                type={vaultType}
                setType={setVaultType}
                selected={selectedVault}
                setSelected={setSelectedVault}
                purchasedIds={sub.purchasedProductIds}
                embedded
                onClose={() => setTab("AI Copilot")}
                onAttach={(item, asPaid) => {
                  const p = products.find((x) => x.id === item.productId) ?? creatorProducts[0];
                  if (p) attachProduct(p, asPaid);
                }}
                onPreview={(item) => {
                  setPreviewId(item.id);
                  setAttached((a) => [
                    ...a.filter((x) => x.kind !== "FREE_PREVIEW"),
                    { id: item.id, kind: "FREE_PREVIEW", label: "Free preview", paid: false, purchased: true, preview: true },
                  ]);
                }}
                onCreateProduct={(item) => {
                  const id = `prod_media_${Date.now()}`;
                  setProducts((rows) => [
                    {
                      id,
                      creatorId,
                      name: item.title,
                      description: item.description,
                      mediaType: item.mediaType,
                      standardPrice: item.defaultPrice,
                      minimumPrice: item.minimumPrice,
                      tags: item.tags,
                      available: true,
                      source: "MEDIA_UPLOAD",
                      timesSold: 0,
                      conversionRate: 0,
                      lastSyncedAt: new Date().toISOString(),
                      externalId: item.id,
                      mediaIds: [item.id],
                      previewIds: [],
                    },
                    ...rows,
                  ]);
                  setTip(`Created product from ${item.title} · source MEDIA_UPLOAD`);
                }}
                onSetPrice={(item) => {
                  const p = products.find((x) => x.id === item.productId);
                  if (p) {
                    attachProduct(p, true, p.standardPrice);
                    setDrawer("price");
                    setTab("AI Copilot");
                  }
                }}
              />
            ) : null}

            {tab === "Activity" ? (
              <ul className="space-y-2 text-xs text-slate-600">
                {convo.messages
                  .filter((m) => m.authorType === "SYSTEM")
                  .map((m) => (
                    <li key={m.id}>{m.body}</li>
                  ))}
              </ul>
            ) : null}

            {tab === "Debug" ? (
              <ol className="space-y-1 font-mono text-[11px] text-slate-600">
                <li>Subscriber message → {lineage?.subscriberMessage || "—"}</li>
                <li>Intent classification → {lineage?.intent || intent}</li>
                <li>Funnel stage → {lineage?.funnelStage || convo.funnelStage}</li>
                <li>Database product query → {lineage?.productQuery || "not run"}</li>
                <li>Eligible products → {(lineage?.eligibleProductIds ?? eligible.eligible.map((p) => p.id)).join(", ") || "none"}</li>
                <li>Retrieved training → {(lineage?.retrievedExamples ?? []).join(" | ") || "—"}</li>
                <li>Venice/demo model → {lineage?.model || "Demo model"}</li>
                <li>Backend validation → {(lineage?.validation ?? []).join(", ")}</li>
                <li>Chatter approval → {lineage?.chatterApproval || "not sent"} · {lineage?.chatterIdentity || DEMO_CHATTER}</li>
                <li>Original suggestion → {lineage?.originalSuggestion || "—"}</li>
                <li>Final edited text → {lineage?.editedText || lineage?.finalMessage || "—"}</li>
                <li>Final message → {lineage?.finalMessage || "—"}</li>
                <li>Approved at → {lineage?.approvedAt || "—"}</li>
                {lineage?.product ? (
                  <li className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-2">
                    {JSON.stringify(lineage.product, null, 2)}
                  </li>
                ) : null}
              </ol>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: DemoMessage }) {
  if (message.authorType === "SYSTEM") {
    return <div className="text-center text-[11px] text-slate-400">{message.body}</div>;
  }
  const mine = message.authorType === "CHATTER";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            mine ? "rounded-br-md bg-teal-600 text-white" : "rounded-bl-md bg-white text-slate-800 shadow-sm"
          }`}
        >
          {message.body}
        </div>
        {message.attachments.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <MediaThumb kind={a.kind} />
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-600">
              <span>{a.label}</span>
              {a.paid ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  {a.purchased ? <Unlock size={12} /> : <Lock size={12} />} ${a.price}
                  {a.purchased ? " · unlocked" : " · locked"}
                </span>
              ) : (
                <span>Free</span>
              )}
            </div>
          </div>
        ))}
        <div className="text-[10px] text-slate-400">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {mine ? (message.read ? " · Read" : " · Sent") : ""}
          {message.aiAssisted ? " · AI-assisted" : ""}
          {message.chatterName ? ` · ${message.chatterName}` : ""}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-400">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Mini({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium hover:bg-slate-200" onClick={onClick}>
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button title={title} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClick}>
      {children}
    </button>
  );
}

function MemoryRow({
  memory,
  onChange,
  onDelete,
}: {
  memory: DemoMemory;
  onChange: (m: DemoMemory) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-slate-100 p-2">
      <div className="text-[10px] text-slate-400">
        {memory.category} · {Math.round(memory.confidence * 100)}% · {memory.source}
      </div>
      <input
        className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
        value={memory.value}
        onChange={(e) => onChange({ ...memory, value: e.target.value })}
      />
      <button className="mt-1 text-[10px] text-red-500" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

function VaultPanel({
  items,
  mode,
  setMode,
  query,
  setQuery,
  type,
  setType,
  selected,
  setSelected,
  onClose,
  onAttach,
  onPreview,
  onCreateProduct,
  onSetPrice,
  purchasedIds,
  embedded,
}: {
  items: DemoVaultItem[];
  mode: "grid" | "list";
  setMode: (m: "grid" | "list") => void;
  query: string;
  setQuery: (q: string) => void;
  type: string;
  setType: (t: string) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  onClose: () => void;
  onAttach: (item: DemoVaultItem, paid: boolean) => void;
  onPreview: (item: DemoVaultItem) => void;
  onCreateProduct?: (item: DemoVaultItem) => void;
  onSetPrice?: (item: DemoVaultItem) => void;
  purchasedIds?: string[];
  embedded?: boolean;
}) {
  const [tag, setTag] = useState("ALL");
  const [priceBand, setPriceBand] = useState("ALL");
  const [owned, setOwned] = useState("ALL");
  const tags = [...new Set(items.flatMap((i) => i.tags))];
  const filtered = items.filter((i) => {
    if (query && !`${i.title} ${i.tags.join(" ")} ${i.id}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (type !== "ALL" && i.mediaType !== type) return false;
    if (tag !== "ALL" && !i.tags.includes(tag)) return false;
    if (priceBand === "free" && i.defaultPrice > 0) return false;
    if (priceBand === "under20" && i.defaultPrice >= 20) return false;
    if (priceBand === "20plus" && i.defaultPrice < 20) return false;
    if (owned === "purchased" && i.productId && !purchasedIds?.includes(i.productId)) return false;
    if (owned === "not" && i.productId && purchasedIds?.includes(i.productId)) return false;
    return true;
  });
  return (
    <div className={`${embedded ? "p-0" : "max-h-64 border-t border-slate-200 bg-white p-3"}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold">Creator vault · DEMO</div>
        <div className="flex gap-1">
          <button onClick={() => setMode("grid")} className={mode === "grid" ? "text-teal-700" : "text-slate-400"}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setMode("list")} className={mode === "list" ? "text-teal-700" : "text-slate-400"}>
            <List size={14} />
          </button>
          <button className="text-xs text-slate-400" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <input className="h-8 flex-1 rounded border border-slate-200 px-2 text-xs" placeholder="Search vault" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="h-8 rounded border border-slate-200 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          {["ALL", "PHOTO", "VIDEO", "AUDIO", "BUNDLE", "CUSTOM"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="h-8 rounded border border-slate-200 text-xs" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="ALL">Tags</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="h-8 rounded border border-slate-200 text-xs" value={priceBand} onChange={(e) => setPriceBand(e.target.value)}>
          <option value="ALL">Any price</option>
          <option value="free">Free</option>
          <option value="under20">Under $20</option>
          <option value="20plus">$20+</option>
        </select>
        <select className="h-8 rounded border border-slate-200 text-xs" value={owned} onChange={(e) => setOwned(e.target.value)}>
          <option value="ALL">All purchase states</option>
          <option value="purchased">Purchased</option>
          <option value="not">Not purchased</option>
        </select>
      </div>
      <div className={mode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {filtered.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-1">
            <button
              className="w-full"
              onClick={() =>
                setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])
              }
            >
              <MediaThumb kind={item.placeholderKind} compact={mode === "list"} />
            </button>
            <div className="truncate px-1 text-[10px] font-medium">{item.title}</div>
            <div className="px-1 text-[10px] text-slate-400">
              {item.id} · ${item.defaultPrice} · min ${item.minimumPrice} · {item.source}
            </div>
            <div className="flex flex-wrap gap-1 p-1">
              <Mini onClick={() => onAttach(item, false)}>Free</Mini>
              <Mini onClick={() => onAttach(item, true)}>Paid</Mini>
              <Mini onClick={() => onPreview(item)}>Preview</Mini>
              <Mini onClick={() => onSetPrice?.(item)}>Set price</Mini>
              <Mini onClick={() => onCreateProduct?.(item)}>Create product</Mini>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        {selected.length} selected · Create product from media is MEDIA_UPLOAD / MANUAL. Live PLATFORM_VAULT_SYNC is not connected.
      </p>
      {selected[0] ? (
        <button
          className="mt-2 text-[11px] font-medium text-teal-700"
          onClick={() => {
            const item = items.find((i) => i.id === selected[0]);
            if (item) onCreateProduct?.(item);
          }}
        >
          Create product from selected
        </button>
      ) : null}
    </div>
  );
}
