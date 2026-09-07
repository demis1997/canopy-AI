const appUrl = "http://localhost:3000";

async function readThread() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return chrome.tabs.sendMessage(tab.id, { type: "CANOPY_READ_THREAD" });
}

async function insert(text: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false };
  return chrome.tabs.sendMessage(tab.id, { type: "CANOPY_INSERT", text });
}

document.getElementById("save-token")?.addEventListener("click", async () => {
  const token = (document.getElementById("token") as HTMLInputElement).value;
  await chrome.storage.session.set({ canopyToken: token });
  document.getElementById("status")!.textContent = "Token stored in session storage only (not cookies).";
});

document.getElementById("read")?.addEventListener("click", async () => {
  const data = await readThread();
  document.getElementById("thread")!.textContent = JSON.stringify(data, null, 2);
});

document.getElementById("insert")?.addEventListener("click", async () => {
  const text = (document.getElementById("draft") as HTMLTextAreaElement).value;
  const result = await insert(text);
  document.getElementById("status")!.textContent = result?.ok
    ? "Inserted into compose box. Send it yourself."
    : `Insert failed: ${result?.reason ?? "unknown"}`;
});
