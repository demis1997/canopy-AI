"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TokenRow = {
  id: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};

export function ExtensionOnboarding() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function refresh() {
    const res = await fetch("/api/extension/token");
    const json = await res.json();
    setTokens(json.tokens ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-medium">Install the Canopy extension</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-white/65">
          <li>
            Build locally: <code>pnpm --filter @canopy/extension build</code>
          </li>
          <li>Chrome/Edge → Extensions → Load unpacked → select <code>apps/extension/dist</code></li>
          <li>Issue a session token below and paste it into the extension popup</li>
          <li>
            Open the mock inbox at <a className="text-canopy-300" href="/demo">/demo</a> — never a live OnlyFans tab for demos
          </li>
        </ol>
      </div>
      <p className="text-xs text-white/40">
        Permissions: storage, sidePanel, activeTab, scripting, and localhost demo URLs only. The extension never
        stores the application API key or the AI provider key. Generation goes through the Canopy backend.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            const res = await fetch("/api/extension/token", { method: "POST" });
            const json = await res.json();
            setFresh(json.token ?? null);
            setStatus(json.token ? "Token issued. Paste it into the extension, then it disappears from this page." : json.error);
            await refresh();
          }}
        >
          Issue connection token
        </Button>
        <Button asChild variant="secondary">
          <a href="/demo">Open mock inbox</a>
        </Button>
      </div>
      {fresh ? (
        <pre className="overflow-x-auto rounded-[10px] bg-black/40 p-3 text-xs">{fresh}</pre>
      ) : null}
      {status ? <p className="text-sm text-canopy-200">{status}</p> : null}
      <div>
        <div className="text-xs text-white/40">Connected sessions</div>
        <ul className="mt-2 space-y-2 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-white/[0.06] px-3 py-2">
              <span>
                Issued {new Date(t.issuedAt).toLocaleString()} · expires {new Date(t.expiresAt).toLocaleString()} ·{" "}
                {t.active ? "active" : t.revokedAt ? "revoked" : "expired"}
              </span>
              {t.active ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch(`/api/extension/token?id=${t.id}`, { method: "DELETE" });
                    setStatus("Session revoked.");
                    await refresh();
                  }}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
          {!tokens.length ? <li className="text-white/40">No extension sessions yet.</li> : null}
        </ul>
      </div>
    </Card>
  );
}
