"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Local demo messenger used by the Manifest V3 extension adapter.
 * It is not an OnlyFans clone — it exists so the copilot workflow can be
 * tested without touching a live platform.
 */
export default function DemoMessengerPage() {
  const [messages, setMessages] = useState<{ from: string; text: string }[]>([
    { from: "fan", text: "hey you looked unreal in that story" },
  ]);
  const [draft, setDraft] = useState("");
  const [fanDraft, setFanDraft] = useState("got anything from the gym?");
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    document.documentElement.dataset.canopyDemo = "true";
    const id = new URLSearchParams(window.location.search).get("conversationId") ?? "";
    setConversationId(id);
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-xl p-6 text-slate-800">
      <p className="text-xs">
        <Link className="text-teal-700 underline" href="/demo/conversations">
          Open investor demo inbox
        </Link>
      </p>
      <h1 className="mt-3 text-xl font-semibold">Canopy demo messenger</h1>
      <p className="mt-2 text-sm text-slate-500">
        Safe local adapter surface. The extension reads these labelled nodes only. Sending stays
        manual — there is no platform automation. Optional <code>?conversationId=</code> links
        generation to a real Canopy thread.
      </p>
      <div
        data-canopy-thread
        data-conversation-id={conversationId || undefined}
        className="mt-6 min-h-[240px] space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            data-canopy-message
            data-author={m.from}
            className={m.from === "fan" ? "text-slate-800" : "text-teal-700"}
          >
            <div className="text-[11px] uppercase text-slate-400">{m.from}</div>
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <textarea
          data-canopy-compose
          className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Creator / chatter compose box"
        />
        <Button
          data-canopy-send
          variant="outline"
          onClick={() => {
            if (!draft.trim()) return;
            setMessages((m) => [...m, { from: "creator", text: draft }]);
            setDraft("");
          }}
        >
          Send manually
        </Button>
      </div>
      <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
        <div className="text-xs text-slate-400">Simulate a subscriber message</div>
        <textarea
          className="min-h-[60px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm"
          value={fanDraft}
          onChange={(e) => setFanDraft(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => {
            setMessages((m) => [...m, { from: "fan", text: fanDraft }]);
          }}
        >
          Add fan message
        </Button>
      </div>
    </div>
  );
}
