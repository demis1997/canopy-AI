"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseProductCsv } from "@canopy/shared";

export function ProductImportPanel({
  creators,
}: {
  creators: { id: string; name: string; handle: string }[];
}) {
  const router = useRouter();
  const sample = [
    "external_id,creator,name,description,content_type,standard_price,minimum_price,tags,media_reference,preview_reference,availability",
    `${creators[0]?.name ?? "Maya Voss"},Lounge stills,Soft indoor set,PHOTO,14,11,gfe|tease,media-1,prev-1,true`.replace(
      /^/,
      "csv-1,",
    ),
  ].join("\n");
  const [csv, setCsv] = useState(sample);
  const [notice, setNotice] = useState("");
  const rows = parseProductCsv(csv);
  const valid = rows.filter((r) => r.errors.length === 0);

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900 p-4">
      <h2 className="text-sm font-semibold">CSV import</h2>
      <p className="mt-1 text-xs text-white/50">
        Validate every row before import. Source will be CSV_IMPORT. Unknown creators are skipped.
      </p>
      <textarea
        className="mt-3 min-h-[120px] w-full rounded-md border border-white/10 bg-ink-950 p-2 font-mono text-[11px]"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      <ul className="mt-2 space-y-1 text-xs">
        {rows.map((row, i) => (
          <li key={i} className={row.errors.length ? "text-red-300" : "text-canopy-300"}>
            {row.name || `row ${i + 1}`}: {row.errors.length ? row.errors.join("; ") : "ready"}
          </li>
        ))}
      </ul>
      <button
        className="mt-3 h-9 rounded-md bg-white/10 px-3 text-sm disabled:opacity-40"
        disabled={!valid.length}
        onClick={async () => {
          const res = await fetch("/api/products", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ csv }),
          });
          const json = await res.json();
          setNotice(`Imported ${json.created ?? 0}. Skipped ${json.skipped?.length ?? 0}.`);
          router.refresh();
        }}
      >
        Import {valid.length} valid row(s)
      </button>
      {notice ? <p className="mt-2 text-xs text-white/60">{notice}</p> : null}
    </div>
  );
}

export function VaultSyncPanel({
  creators,
  accounts,
}: {
  creators: { id: string; name: string }[];
  accounts: {
    id: string;
    creatorId: string;
    displayName: string;
    providerAccountId: string | null;
    connectionStatus: string;
    lastCatalogSyncAt: string | null;
  }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeAccount, setActiveAccount] = useState(accounts[0]?.id ?? "");
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => {
    if (!runId || !activeAccount) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/products/vault-sync?accountId=${encodeURIComponent(activeAccount)}`,
        );
        const data = await response.json();
        const run = data.runs?.find((r: { id: string }) => r.id === runId);
        if (!run) return;
        setMessage(
          `${run.status}: ${run.importedProducts} products processed. ${run.lastError ?? ""}`,
        );
        if (run.status === "SUCCEEDED" || run.status === "FAILED") {
          setRunId(null);
          router.refresh();
        }
      } catch {
        setMessage("Unable to read import status. Refresh to retry.");
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [runId, activeAccount, router]);
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-ink-900 p-4 text-sm">
      <div>
        <h2 className="font-semibold">Connect OnlyFansAPI</h2>
        <p className="mt-1 text-xs text-white/55">
          Connect the creator in your OnlyFansAPI dashboard, then enter its account ID and API key
          here. Imported vault media and paid posts/messages appear as draft products for you to
          price and approve.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const form = event.currentTarget;
          const data = new FormData(form);
          try {
            const response = await fetch("/api/platform/accounts", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                driver: "ONLYFANS_API",
                creatorId: data.get("creatorId"),
                providerAccountId: data.get("providerAccountId"),
                apiKey: data.get("apiKey"),
              }),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error ?? "Connection failed");
            form.reset();
            setActiveAccount(json.account.id);
            setMessage("Connected. Start an import below.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Connection failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <select name="creatorId" aria-label="Creator" required className="rounded bg-ink-950 p-2">
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          name="providerAccountId"
          aria-label="OnlyFansAPI account ID"
          placeholder="acct_..."
          required
          className="rounded bg-ink-950 p-2"
        />
        <input
          name="apiKey"
          aria-label="OnlyFansAPI key"
          type="password"
          autoComplete="off"
          placeholder="API key"
          required
          className="rounded bg-ink-950 p-2"
        />
        <button
          disabled={busy || !creators.length}
          className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
        >
          {busy ? "Connecting…" : "Connect creator"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Connected creator"
          value={activeAccount}
          onChange={(e) => setActiveAccount(e.target.value)}
          className="rounded bg-ink-950 p-2"
        >
          <option value="">Select connected creator</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName} · {a.connectionStatus}
            </option>
          ))}
        </select>
        <button
          disabled={busy || !activeAccount || Boolean(runId)}
          className="rounded bg-white/10 px-3 py-2 disabled:opacity-40"
          onClick={async () => {
            setBusy(true);
            try {
              const response = await fetch("/api/products/vault-sync", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ platformAccountId: activeAccount }),
              });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error ?? "Import failed");
              setRunId(json.runId);
              setMessage(json.message);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Import failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Import vault and paid offers
        </button>
      </div>
      {message ? (
        <p role="status" className="text-xs text-white/70">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ProductApproval({
  product,
}: {
  product: {
    id: string;
    standardPriceCents: number;
    minimumPriceCents: number;
    available: boolean;
    sourceAvailable: boolean;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2 py-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        try {
          const response = await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              standardPriceCents: Math.round(Number(data.get("price")) * 100),
              minimumPriceCents: Math.round(Number(data.get("minimum")) * 100),
              available: true,
              approvedForAutomation: true,
            }),
          });
          const json = await response.json();
          if (!response.ok) throw new Error(json.error ?? "Approval failed");
          setMessage("Approved");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Approval failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="text-xs">
        Price ${" "}
        <input
          name="price"
          aria-label="Product price in USD"
          type="number"
          step="0.01"
          min="3"
          max="200"
          required
          defaultValue={product.standardPriceCents / 100 || ""}
          className="w-16 rounded bg-ink-950 p-1"
        />
      </label>
      <label className="text-xs">
        Minimum ${" "}
        <input
          name="minimum"
          aria-label="Minimum product price in USD"
          type="number"
          step="0.01"
          min="3"
          max="200"
          required
          defaultValue={product.minimumPriceCents / 100 || ""}
          className="w-16 rounded bg-ink-950 p-1"
        />
      </label>
      <button
        disabled={busy || !product.sourceAvailable}
        className="rounded bg-white/10 px-2 py-1 text-xs disabled:opacity-40"
      >
        {product.available ? "Save approval" : "Approve product"}
      </button>
      <span className="text-xs">
        {message ||
          (!product.sourceAvailable
            ? "Source unavailable"
            : product.available
              ? "Approved"
              : "Draft")}
      </span>
    </form>
  );
}
