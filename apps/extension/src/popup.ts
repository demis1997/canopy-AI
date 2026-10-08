const appUrl = "http://localhost:3000";

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(payload: Record<string, unknown>) {
  const tab = await activeTab();
  if (!tab?.id) return { ok: false, reason: "no-tab" };
  try {
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch {
    return { ok: false, reason: "content-script-missing" };
  }
}

function setStatus(text: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

async function refreshInbox() {
  const tab = await activeTab();
  const url = tab?.url ?? "";
  const inbox = document.getElementById("inbox")!;
  const mock = /localhost:3000\/demo|127\.0\.0\.1:3000\/demo/.test(url);
  const of = /onlyfans\.com/i.test(url);
  inbox.textContent = mock
    ? "Mock inbox detected. Safe local harness — not OnlyFans."
    : of
      ? "OnlyFans URL detected. Adapter is fail-closed until selectors are configured."
      : "Authorized inbox not open. Open /demo or a configured inbox.";
}

document.getElementById("save-token")?.addEventListener("click", async () => {
  const token = (document.getElementById("token") as HTMLInputElement).value.trim();
  await chrome.storage.session.set({ canopyToken: token });
  setStatus("Token stored in session storage only.");
});

document.getElementById("disconnect")?.addEventListener("click", async () => {
  await chrome.storage.session.remove("canopyToken");
  (document.getElementById("token") as HTMLInputElement).value = "";
  setStatus("Disconnected. Issue a new token from /platform to reconnect.");
});

document.getElementById("pause")?.addEventListener("click", async () => {
  await send({ type: "CANOPY_PAUSE", paused: true });
  setStatus("Paused.");
});

document.getElementById("resume")?.addEventListener("click", async () => {
  await send({ type: "CANOPY_PAUSE", paused: false });
  setStatus("Resumed.");
});

document.getElementById("read")?.addEventListener("click", async () => {
  const data = await send({ type: "CANOPY_READ_THREAD" });
  document.getElementById("thread")!.textContent = JSON.stringify(data, null, 2);
  const conversationId = data?.thread?.conversationId;
  document.getElementById("persona")!.textContent = conversationId
    ? `Conversation ${conversationId}`
    : "No Canopy conversation id on this page.";
  const token = (await chrome.storage.session.get("canopyToken")).canopyToken as string | undefined;
  const box = document.getElementById("suggestions")!;
  box.innerHTML = "";
  if (!token || !conversationId) {
    setStatus(
      token
        ? "Read complete. Link a conversation id to generate via Canopy."
        : "Read complete. Save a session token to generate.",
    );
    return;
  }
  try {
    const res = await fetch(`${appUrl}/api/extension/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversationId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus(json.error || "Generation failed");
      return;
    }
    for (const option of json.replyOptions ?? []) {
      const el = document.createElement("div");
      el.className = "suggestion";
      el.textContent = option.text;
      el.addEventListener("click", () => {
        (document.getElementById("draft") as HTMLTextAreaElement).value = option.text;
      });
      box.appendChild(el);
    }
    setStatus(
      json.mockMode
        ? "Suggestions (labelled mock provider)."
        : "Suggestions ready. Insert, then send yourself.",
    );
  } catch {
    setStatus("Could not reach the Canopy backend.");
  }
});

document.getElementById("insert")?.addEventListener("click", async () => {
  const text = (document.getElementById("draft") as HTMLTextAreaElement).value;
  const result = await send({ type: "CANOPY_INSERT", text });
  setStatus(
    result?.ok
      ? "Inserted into compose box. Click the native send button yourself."
      : `Insert failed: ${result?.reason ?? "unknown"}`,
  );
});

void refreshInbox();
