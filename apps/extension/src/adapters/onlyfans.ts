import type { PlatformAdapter } from "./types";

/**
 * Isolated production adapter.
 * Selectors are configuration, not guesses. If the live page structure is unknown,
 * diagnostics mode reports missing nodes instead of inventing brittle scrapers.
 * This adapter never reads cookies, never logs in, and never clicks send.
 */
export function createOnlyFansAdapter(selectors: {
  thread?: string;
  message?: string;
  compose?: string;
}): PlatformAdapter {
  return {
    id: "onlyfans",
    matches(url: string) {
      return /onlyfans\.com/i.test(url);
    },
    getVisibleThread() {
      if (!selectors.thread || !selectors.compose) return null;
      const thread = document.querySelector(selectors.thread);
      const compose = document.querySelector(selectors.compose);
      if (!thread || !compose) return null;
      const messages = selectors.message
        ? [...thread.querySelectorAll(selectors.message)].map((node) => ({
            author: "unknown" as const,
            text: (node.textContent ?? "").trim(),
          }))
        : [];
      return { messages, composeFound: true };
    },
    insertReply(text: string) {
      if (!selectors.compose) return { ok: false, reason: "selectors-unconfigured" };
      const box = document.querySelector<HTMLTextAreaElement | HTMLElement>(selectors.compose);
      if (!box) return { ok: false, reason: "compose-missing" };
      if ("value" in box) {
        (box as HTMLTextAreaElement).value = text;
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true };
      }
      box.textContent = text;
      return { ok: true };
    },
    diagnostics() {
      return {
        configured: Boolean(selectors.thread && selectors.compose),
        thread: selectors.thread ? Boolean(document.querySelector(selectors.thread)) : false,
        compose: selectors.compose ? Boolean(document.querySelector(selectors.compose)) : false,
        note: "Configure selectors after inspecting the authorised page. Never store passwords.",
      };
    },
  };
}
