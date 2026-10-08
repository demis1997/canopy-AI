"use client";

import { useMemo, useState } from "react";
import { DemoChrome } from "@/demo/chrome";
import { MediaThumb } from "@/demo/media-thumb";
import { demoCreators, demoProducts, demoVault } from "@/demo/seed";
import type { DemoProduct, DemoVaultItem } from "@/demo/types";
import { parseProductCsv } from "@canopy/shared";

const SAMPLE_CSV = [
  "external_id,creator,name,description,content_type,standard_price,minimum_price,tags,media_reference,preview_reference,availability",
  "csv_lounge,Maya Voss,Lounge stills,Soft indoor set,PHOTO,14,11,gfe|tease,media_lounge,media_lounge_prev,true",
  "csv_bad,Maya Voss,,broken,GIF,-1,50,x,m,p,true",
].join("\n");

const SOURCES = [
  {
    mode: "DEMO",
    title: "Demo seed",
    body: "This page uses fictional catalog data. No live creator platform is connected.",
  },
  {
    mode: "MANUAL",
    title: "Manual create",
    body: "Upload or select vault media, set prices, choose a free preview, then save. Source becomes MANUAL.",
  },
  {
    mode: "CSV_IMPORT",
    title: "CSV import",
    body: "Paste an exported catalogue. Every row is validated before it can be imported.",
  },
  {
    mode: "PLATFORM_VAULT_SYNC",
    title: "Authorised vault sync",
    body: "Disabled unless an authorised integration exists. Canopy does not scrape credentials, session cookies, or crawl an account. A browser extension may import currently visible, explicitly selected vault metadata only when the creator triggers “Import selected items.”",
  },
] as const;

export default function DemoProductsPage() {
  const [creatorId, setCreatorId] = useState("creator_maya");
  const [products, setProducts] = useState<DemoProduct[]>(demoProducts);
  const [vault] = useState<DemoVaultItem[]>(demoVault);
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [name, setName] = useState("Lounge stills");
  const [description, setDescription] = useState("Soft indoor photo set.");
  const [standard, setStandard] = useState(14);
  const [minimum, setMinimum] = useState(11);
  const [tags, setTags] = useState("gfe, tease");
  const [mediaId, setMediaId] = useState("media_sunset");
  const [previewId, setPreviewId] = useState("media_sunset_prev");
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  const creator = demoCreators.find((c) => c.id === creatorId)!;
  const creatorVault = vault.filter((v) => v.creatorId === creatorId);
  const rows = useMemo(() => parseProductCsv(csv), [csv]);
  const validRows = rows.filter((r) => r.errors.length === 0);

  function createManual() {
    if (minimum > standard) {
      setNotice("Minimum price cannot exceed standard price.");
      return;
    }
    const product: DemoProduct = {
      id: `prod_manual_${Date.now()}`,
      creatorId,
      name,
      description,
      mediaType: "PHOTO",
      standardPrice: standard,
      minimumPrice: minimum,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      available,
      source: "MANUAL",
      timesSold: 0,
      conversionRate: 0,
      lastSyncedAt: new Date().toISOString(),
      externalId: `manual_${Date.now()}`,
      mediaIds: [mediaId],
      previewIds: previewId ? [previewId] : [],
    };
    setProducts((p) => [product, ...p]);
    setNotice(
      `Saved ${product.name} as MANUAL. The model can recommend it after the next generate.`,
    );
  }

  function importCsv() {
    const imported: DemoProduct[] = validRows.map((row, i) => ({
      id: `prod_csv_${Date.now()}_${i}`,
      creatorId,
      name: row.name,
      description: row.description,
      mediaType: row.content_type as DemoProduct["mediaType"],
      standardPrice: row.standard_price,
      minimumPrice: row.minimum_price,
      tags: row.tags,
      available: row.availability,
      source: "CSV_IMPORT",
      timesSold: 0,
      conversionRate: 0,
      lastSyncedAt: new Date().toISOString(),
      externalId: row.external_id || `csv_${i}`,
      mediaIds: row.media_reference ? [row.media_reference] : [],
      previewIds: row.preview_reference ? [row.preview_reference] : [],
    }));
    setProducts((p) => [...imported, ...p]);
    setNotice(
      `Imported ${imported.length} valid row(s). ${rows.length - validRows.length} row(s) skipped.`,
    );
  }

  async function tryVaultSync() {
    setSyncBusy(true);
    const res = await fetch("/api/demo/vault-sync", { method: "POST" });
    const json = await res.json();
    setSyncBusy(false);
    setNotice(json.message);
  }

  return (
    <div className="min-h-screen">
      <DemoChrome active="products" />
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product catalogue</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Canopy never invents products. Suggestions can only recommend IDs returned by this
            catalogue. Demo seed, manual create, CSV import, and media upload are available here.
            Live platform vault sync is not claimed and stays disabled without an authorised
            integration.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {SOURCES.map((s) => (
            <div key={s.mode} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                {s.mode}
              </div>
              <div className="mt-1 text-sm font-medium">{s.title}</div>
              <p className="mt-1 text-xs text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>

        {notice ? (
          <div className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">{notice}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Manual product</h2>
            <label className="mt-3 block text-xs text-slate-500">Creator</label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              value={creatorId}
              onChange={(e) => setCreatorId(e.target.value)}
            >
              {demoCreators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs text-slate-500">Name</label>
            <input
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="mt-3 block text-xs text-slate-500">Description</label>
            <textarea
              className="mt-1 min-h-[64px] w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500">Standard price</label>
                <input
                  type="number"
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                  value={standard}
                  onChange={(e) => setStandard(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Minimum price</label>
                <input
                  type="number"
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                  value={minimum}
                  onChange={(e) => setMinimum(Number(e.target.value))}
                />
              </div>
            </div>
            <label className="mt-3 block text-xs text-slate-500">Tags</label>
            <input
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <label className="mt-3 block text-xs text-slate-500">Locked media</label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
            >
              {creatorVault.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs text-slate-500">Free preview</label>
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              value={previewId}
              onChange={(e) => setPreviewId(e.target.value)}
            >
              <option value="">None</option>
              {creatorVault.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
              />{" "}
              Available
            </label>
            <button
              className="mt-4 h-9 rounded-md bg-teal-600 px-3 text-sm font-medium text-white"
              onClick={createManual}
            >
              Save product
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold">CSV import preview</h2>
            <textarea
              className="mt-3 min-h-[160px] w-full rounded-md border border-slate-200 p-2 font-mono text-[11px]"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <table className="mt-3 w-full text-left text-[11px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="py-1">Name</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{row.name || "—"}</td>
                    <td>{row.content_type || "—"}</td>
                    <td>
                      ${row.standard_price}/{row.minimum_price}
                    </td>
                    <td className={row.errors.length ? "text-red-600" : "text-teal-700"}>
                      {row.errors.length ? row.errors.join("; ") : "Ready"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="mt-3 h-9 rounded-md bg-slate-800 px-3 text-sm font-medium text-white disabled:opacity-40"
              disabled={!validRows.length}
              onClick={importCsv}
            >
              Import {validRows.length} valid row(s)
            </button>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <div className="font-semibold">Platform vault sync</div>
              <p className="mt-1">
                There is no public OnlyFans API in this product. Sync stays queued-disabled until an
                authorised connector or permitted extension import is enabled.
              </p>
              <button
                className="mt-2 h-8 rounded-md border border-amber-300 bg-white px-2 font-medium"
                disabled={syncBusy}
                onClick={() => void tryVaultSync()}
              >
                {syncBusy ? "Checking…" : "Request authorised vault sync"}
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">
            {creator.displayName} catalogue ·{" "}
            {products.filter((p) => p.creatorId === creatorId).length} products
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products
              .filter((p) => p.creatorId === creatorId)
              .map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                  <MediaThumb
                    kind={
                      p.mediaType === "AUDIO"
                        ? "VOICE_NOTE"
                        : p.mediaType === "BUNDLE"
                          ? "PREMIUM_BUNDLE"
                          : p.mediaType === "VIDEO"
                            ? "SHORT_VIDEO"
                            : "PHOTO_SET"
                    }
                  />
                  <div className="mt-2 font-medium">{p.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.mediaType} · ${p.standardPrice} list · min ${p.minimumPrice} · {p.source}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {p.tags.join(" · ")} · sold {p.timesSold} · {p.available ? "available" : "off"}{" "}
                    · {p.id}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
