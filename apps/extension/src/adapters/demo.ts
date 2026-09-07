import type { PlatformAdapter, ThreadContext } from "./types";

export const demoAdapter: PlatformAdapter = {
  id: "demo",
  matches(url: string) {
    return url.includes("/demo");
  },
  getVisibleThread(): ThreadContext | null {
    const thread = document.querySelector("[data-canopy-thread]");
    if (!thread) return null;
    const messages = [...thread.querySelectorAll("[data-canopy-message]")].map((node) => {
      const author = node.getAttribute("data-author") === "fan" ? "subscriber" : "creator";
      return { author, text: (node.textContent ?? "").replace(/^(fan|creator)/i, "").trim() };
    });
    return {
      messages,
      composeFound: Boolean(document.querySelector("[data-canopy-compose]")),
    };
  },
  insertReply(text: string) {
    const box = document.querySelector<HTMLTextAreaElement>("[data-canopy-compose]");
    if (!box) return { ok: false, reason: "compose-missing" };
    box.value = text;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true };
  },
  diagnostics() {
    return {
      thread: Boolean(document.querySelector("[data-canopy-thread]")),
      compose: Boolean(document.querySelector("[data-canopy-compose]")),
      send: Boolean(document.querySelector("[data-canopy-send]")),
      note: "Demo adapter only. No platform cookies are read.",
    };
  },
};
