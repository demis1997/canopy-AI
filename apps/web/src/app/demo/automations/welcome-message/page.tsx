"use client";

import { useMemo, useState } from "react";
import { DemoChrome } from "@/demo/chrome";
import { MediaThumb } from "@/demo/media-thumb";
import { demoCreators, demoProducts, demoVault } from "@/demo/seed";

const SEGMENTS = [
  { id: "new_subscribers", label: "New subscribers" },
  { id: "high_value", label: "High value" },
  { id: "expired_trial", label: "Recently expired" },
];

export default function WelcomeMessagePage() {
  const [creatorId, setCreatorId] = useState("creator_maya");
  const [enabled, setEnabled] = useState(true);
  const [body, setBody] = useState("hey — thanks for being here. this one's just a hello 😏");
  const [paid, setPaid] = useState(true);
  const [price, setPrice] = useState(8);
  const [productId, setProductId] = useState("prod_engagement");
  const [previewId, setPreviewId] = useState("media_engagement_prev");
  const [segment, setSegment] = useState("new_subscribers");
  const [notice, setNotice] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const creator = demoCreators.find((c) => c.id === creatorId)!;
  const products = demoProducts.filter((p) => p.creatorId === creatorId);
  const vault = demoVault.filter((v) => v.creatorId === creatorId);
  const product = products.find((p) => p.id === productId);
  const preview = vault.find((v) => v.id === previewId);
  const media = vault.find((v) => product?.mediaIds.includes(v.id));

  const priceError = useMemo(() => {
    if (!paid) return "";
    if (!product) return "Pick a catalogue product. The AI cannot invent one.";
    if (price < product.minimumPrice) return `Below authorised floor $${product.minimumPrice}.`;
    if (price > product.standardPrice) return `Above list price $${product.standardPrice}.`;
    return "";
  }, [paid, price, product]);

  async function rewrite() {
    setRewriting(true);
    const res = await fetch("/api/demo/rewrite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: body, creator: creator.displayName, style: creator.style }),
    });
    const json = await res.json();
    setBody(json.text);
    setRewriting(false);
    setNotice("Demo AI response · rewrite inserted. Delivery is still manual until you save.");
  }

  function save() {
    if (priceError) {
      setNotice(priceError);
      return;
    }
    window.localStorage.setItem(
      "canopy.demo.welcome",
      JSON.stringify({ creatorId, enabled, body, paid, price, productId, previewId, segment }),
    );
    setNotice("Saved in this browser. Automatic platform delivery requires an authorised platform integration.");
  }

  function sendTest() {
    if (priceError) {
      setNotice(priceError);
      return;
    }
    setTestSent(true);
    setNotice("Test delivered to the demo fan preview only. Nothing was sent to a live platform.");
  }

  return (
    <div className="min-h-screen">
      <DemoChrome active="welcome" />
      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome-message builder</h1>
            <p className="mt-1 text-sm text-slate-500">
              Recreate the familiar new-subscriber greeting workflow. Canopy can draft and attach vault media.
              Automatic delivery to a live creator platform is not enabled in this demo.
            </p>
          </div>
          {notice ? <div className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">{notice}</div> : null}

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex items-center justify-between text-sm font-medium">
              Enable welcome message
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            </label>
            <label className="mt-4 block text-xs text-slate-500">Creator</label>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
              {demoCreators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} · {c.style}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-xs text-slate-500">Subscriber segment</label>
            <select className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-xs text-slate-500">Message</label>
            <textarea className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-200 p-3 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="mt-2 h-8 rounded-md bg-teal-50 px-3 text-xs font-medium text-teal-800 ring-1 ring-teal-200" disabled={rewriting} onClick={() => void rewrite()}>
              {rewriting ? "Rewriting…" : "AI rewrite"}
            </button>
            <p className="mt-1 text-[11px] text-slate-400">Demo AI response · same Zod-backed mock used by inbox generation.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500">Attach product from vault</label>
                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ${p.standardPrice}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Free preview</label>
                <select className="mt-1 h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
                  <option value="">None</option>
                  {vault.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
                Paid message
              </label>
              {paid ? (
                <input
                  type="number"
                  className="h-9 w-24 rounded-md border border-slate-200 px-2"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              ) : (
                <span className="text-xs text-slate-500">Free delivery</span>
              )}
              {product ? (
                <span className="text-xs text-slate-500">
                  list ${product.standardPrice} · min ${product.minimumPrice}
                </span>
              ) : null}
            </div>
            {priceError ? <p className="mt-2 text-xs text-red-600">{priceError}</p> : null}

            <div className="mt-4 flex gap-2">
              <button className="h-9 rounded-md bg-teal-600 px-4 text-sm font-medium text-white" onClick={save}>
                Save
              </button>
              <button className="h-9 rounded-md border border-slate-200 px-4 text-sm" onClick={sendTest}>
                Send test to demo
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Automatic platform delivery requires an authorised platform integration. This builder never logs into
              a creator platform or transmits session cookies.
            </p>
          </section>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fan preview</div>
            <div className="mt-3 rounded-2xl bg-[#eef1f4] p-3">
              <div className="text-[11px] text-slate-400">{creator.displayName}</div>
              <div className="mt-2 max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm shadow-sm">
                {enabled ? body : <span className="text-slate-400">Welcome message is off.</span>}
              </div>
              {preview ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <MediaThumb kind="FREE_PREVIEW" />
                  <div className="px-2 py-1 text-[11px] text-slate-500">Free preview · {preview.title}</div>
                </div>
              ) : null}
              {paid && media ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <MediaThumb kind={media.placeholderKind} />
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-600">
                    <span>{product?.name}</span>
                    <span className="font-medium">${price} · locked</span>
                  </div>
                </div>
              ) : null}
              {testSent ? <div className="mt-3 text-center text-[11px] text-teal-700">Test copy delivered in demo</div> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
