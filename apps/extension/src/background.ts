chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true }).catch(() => undefined);
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CANOPY_FORWARD" && sender.tab?.id) {
    chrome.tabs
      .sendMessage(sender.tab.id, message.payload)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
