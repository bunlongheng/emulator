// Toggle the emulator overlay on the active tab when the toolbar icon is clicked.
// Uses on-demand injection (activeTab + scripting) so nothing runs on pages until asked.

// Most sites refuse to be embedded (X-Frame-Options / CSP frame-ancestors). Like
// Responsive Viewer / Responsively, we strip those response headers so the real site
// renders inside the device iframe, only while the overlay is open.
//
// Scoping: we key the rule by the framed page's DOMAIN, not the tab. A tab-scoped rule
// misses pages served by a Service Worker - the SW re-issues the navigation as its own
// fetch(), which carries NO tabId, so a tabIds condition never matches and the strip
// silently fails (that's why PWAs like local-apps.localhost wouldn't render). A
// requestDomains rule catches both the direct sub_frame request and the SW's fetch.
function stripRuleFor(tabId, host) {
  return {
    id: tabId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" },
      ],
    },
    // sub_frame = normal embed; the others catch SW-issued / reclassified navigation fetches
    condition: {
      resourceTypes: ["sub_frame", "main_frame", "xmlhttprequest", "other"],
      requestDomains: [host],
    },
  };
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch (_) { return null; }
}

async function enableStrip(tabId, host) {
  if (!host) return;
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId],
      addRules: [stripRuleFor(tabId, host)],
    });
  } catch (err) {
    console.warn("[Emulator] could not enable header strip:", err?.message || err);
  }
}

async function disableStrip(tabId) {
  try {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
  } catch (_) {}
}

// Toolbar-icon state so you can tell at a glance whether this tab is being framed:
//   framing  -> green "ON" badge + "click to close" tooltip
//   idle     -> no badge, normal tooltip
const NORMAL_ICON = { 16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png", 128: "icons/icon-128.png" };
const ACTIVE_ICON = { 16: "icons/icon-active-16.png", 32: "icons/icon-active-32.png", 48: "icons/icon-active-48.png", 128: "icons/icon-active-128.png" };

async function setActiveBadge(tabId, on) {
  try {
    // swap the toolbar icon itself: green X while framing (click to close), normal when idle
    await chrome.action.setIcon({ tabId, path: on ? ACTIVE_ICON : NORMAL_ICON });
    if (on) {
      await chrome.action.setTitle({ tabId, title: "Emulator - framing this tab (click to close)" });
    } else {
      await chrome.action.setTitle({ tabId, title: "Frame this tab in a device" });
    }
  } catch (_) {}
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !/^https?:/.test(tab.url)) return;
  try {
    // Put the header-strip rule in place BEFORE the overlay's iframe fires its request.
    await enableStrip(tab.id, hostOf(tab.url));
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["overlay.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
  } catch (err) {
    // Chrome Web Store, chrome:// pages, PDF viewer etc. cannot be scripted.
    await disableStrip(tab.id);
    console.warn("[Emulator] cannot run on this page:", err?.message || err);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return; // copy.html's df-clipboard-done is picked up by its own listener above

  // Overlay opened -> flip the toolbar icon to its green "ON" state.
  if (msg && msg.type === "df-open") {
    setActiveBadge(sender.tab.id, true);
    return;
  }

  // Overlay closed -> drop the per-tab header-strip rule, restoring normal protection.
  if (msg && msg.type === "df-close") {
    disableStrip(sender.tab.id);
    setActiveBadge(sender.tab.id, false);
    return;
  }

  // The overlay asks the worker to screenshot the visible tab. captureVisibleTab grabs
  // rendered pixels, so the framed (cross-origin) page comes through - a DOM/canvas read
  // never could. The content script then crops to the device bounds.
  if (msg && msg.type === "df-capture") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      const err = chrome.runtime.lastError;
      sendResponse(err ? { error: err.message } : { dataUrl });
    });
    return true; // keep the message channel open for the async response
  }

  // Clipboard fallback for plain-http pages (no navigator.clipboard there): park the PNG in
  // session storage, open the extension's own copy page (secure origin + clipboardWrite) in a
  // tiny focused popup, let it write the clipboard, then close it and relay the result.
  if (msg && msg.type === "df-clipboard") {
    (async () => {
      let win = null;
      try {
        await chrome.storage.session.set({ dfClip: msg.dataUrl });
        const result = new Promise((res) => {
          const onDone = (m) => {
            if (m && m.type === "df-clipboard-done") { chrome.runtime.onMessage.removeListener(onDone); res(m); }
          };
          chrome.runtime.onMessage.addListener(onDone);
          setTimeout(() => { chrome.runtime.onMessage.removeListener(onDone); res({ error: "clipboard timeout" }); }, 6000);
        });
        win = await chrome.windows.create({ url: chrome.runtime.getURL("copy.html"), type: "popup", width: 280, height: 120, focused: true });
        sendResponse(await result);
      } catch (e) {
        sendResponse({ error: (e && e.message) || "clipboard error" });
      }
      if (win) { try { await chrome.windows.remove(win.id); } catch (_) {} }
      try { await chrome.storage.session.remove("dfClip"); } catch (_) {}
    })();
    return true;
  }

  // The overlay hands us the rendered device image; we POST it to bunlongheng.com from the
});

// Clean up the rule if the tab is closed while framed.
chrome.tabs.onRemoved.addListener((tabId) => disableStrip(tabId));

// If the framed tab navigates or reloads, the overlay is gone - reset the rule + icon state.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    disableStrip(tabId);
    setActiveBadge(tabId, false);
  }
});
