import { demoAdapter } from "./adapters/demo";
import { createOnlyFansAdapter } from "./adapters/onlyfans";
import { detectAdapter } from "./adapters/types";

const adapters = [demoAdapter, createOnlyFansAdapter({})];

function paused(): Promise<boolean> {
  return chrome.storage.session.get("canopyPaused").then((v) => Boolean(v.canopyPaused));
}

function showChip(connected: boolean) {
  const existing = document.getElementById("canopy-status-chip");
  if (existing) existing.remove();
  const chip = document.createElement("div");
  chip.id = "canopy-status-chip";
  chip.textContent = connected ? "Canopy connected" : "Canopy offline";
  chip.setAttribute(
    "style",
    "position:fixed;right:12px;bottom:12px;z-index:2147483646;font:11px/1.2 ui-sans-serif,system-ui;padding:6px 10px;border-radius:999px;background:#0c1218;color:#99f6e4;border:1px solid rgba(255,255,255,.12);pointer-events:none;",
  );
  document.documentElement.appendChild(chip);
}

const adapter = detectAdapter(location.href, adapters);
if (adapter) {
  void paused().then((isPaused) => showChip(!isPaused));
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const isPaused = await paused();
    if (message.type === "CANOPY_STATUS") {
      sendResponse({
        adapter: adapter?.id ?? null,
        inboxOpen: Boolean(adapter),
        paused: isPaused,
        diagnostics: adapter?.diagnostics() ?? null,
      });
      return;
    }
    if (message.type === "CANOPY_PAUSE") {
      await chrome.storage.session.set({ canopyPaused: Boolean(message.paused) });
      showChip(!message.paused && Boolean(adapter));
      sendResponse({ paused: Boolean(message.paused) });
      return;
    }
    if (isPaused) {
      sendResponse({ ok: false, reason: "paused" });
      return;
    }
    if (message.type === "CANOPY_READ_THREAD") {
      const thread = adapter?.getVisibleThread() ?? null;
      sendResponse({
        adapter: adapter?.id ?? null,
        thread,
        diagnostics: adapter?.diagnostics() ?? null,
        inboxOpen: Boolean(adapter && thread),
      });
      return;
    }
    if (message.type === "CANOPY_INSERT") {
      sendResponse(adapter?.insertReply(message.text) ?? { ok: false, reason: "no-adapter" });
    }
  })();
  return true;
});
