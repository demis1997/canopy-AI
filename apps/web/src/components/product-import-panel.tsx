"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseProductCsv } from "@canopy/shared";

export function ProductImportPanel({ creators }: { creators: { id: string; name: string; handle: string }[] }) {
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

export function VaultSyncPanel() {
  const [message, setMessage] = useState("");
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
      <div className="font-semibold">Platform vault sync</div>
      <p className="mt-1 text-xs text-white/55">
        Canopy does not claim a public OnlyFans API. DEMO uses seeded data. MANUAL and CSV_IMPORT work above.
        PLATFORM_VAULT_SYNC stays off unless an authorised integration or permitted extension “Import selected
        items” workflow is enabled. Credentials and session cookies are never collected.
      </p>
      <button
        className="mt-3 h-8 rounded-md border border-white/15 px-3 text-xs"
        onClick={async () => {
          const res = await fetch("/api/products/vault-sync", { method: "POST" });
          const json = await res.json();
          setMessage(json.message);
        }}
      >
        Request authorised vault sync
      </button>
      {message ? <p className="mt-2 text-xs text-amber-200">{message}</p> : null}
    </div>
  );
}
