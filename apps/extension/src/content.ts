import { demoAdapter } from "./adapters/demo";
import { createOnlyFansAdapter } from "./adapters/onlyfans";
import { detectAdapter } from "./adapters/types";

const adapters = [demoAdapter, createOnlyFansAdapter({})];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CANOPY_READ_THREAD") {
    const adapter = detectAdapter(location.href, adapters);
    sendResponse({ adapter: adapter?.id ?? null, thread: adapter?.getVisibleThread() ?? null, diagnostics: adapter?.diagnostics() });
    return true;
  }
  if (message.type === "CANOPY_INSERT") {
    const adapter = detectAdapter(location.href, adapters);
    sendResponse(adapter?.insertReply(message.text) ?? { ok: false, reason: "no-adapter" });
    return true;
  }
  return false;
});
