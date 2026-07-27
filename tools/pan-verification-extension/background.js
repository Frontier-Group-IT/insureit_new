const IIB_URL = "https://pos.iib.gov.in/";
const IIB_PATTERN = "https://pos.iib.gov.in/*";
const HEARTBEAT_ALARM = "nm-pan-heartbeat";
const HEARTBEAT_MINUTES = 0.5;
const PAGE_READY_TIMEOUT_MS = 30000;
const CONTENT_PING_TIMEOUT_MS = 5000;
const MAX_NAVIGATION_ATTEMPTS = 4;
const MAX_DIAGNOSTICS = 300;

const DEFAULT_STATE = {
  running: false,
  paused: false,
  state: "STOPPED",
  status: "Idle",
  currentPan: null,
  currentJobId: null,
  currentAttempt: 0,
  processed: 0,
  totalClaimed: 0,
  lastResult: null,
  lastError: null,
  managedTabId: null,
  managedWindowId: null,
  lastKnownUrl: null,
  lastPageType: "unknown",
  lastPageReadyAt: null,
  lastContentPingAt: null,
  navigationAttempt: 0,
  queue: []
};

let claimInFlight = null;
let controlInFlight = null;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["runtime", "diagnostics"]);
  await chrome.storage.local.set({
    runtime: { ...DEFAULT_STATE, ...(stored.runtime || {}) },
    diagnostics: Array.isArray(stored.diagnostics) ? stored.diagnostics : []
  });
  await ensureHeartbeat();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureHeartbeat();
  const runtime = await getRuntime();
  if (runtime.running) await controlCycle("startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  controlCycle("alarm").catch((error) => recordFailure("heartbeat_failed", error));
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const runtime = await getRuntime();
  if (runtime.managedTabId !== tabId) return;
  await logEvent("managed_tab_closed", "The managed IIB tab was closed.", { tabId });
  await updateRuntime({ managedTabId: null, managedWindowId: null, lastKnownUrl: null, lastPageType: "unknown", state: runtime.running ? "RECOVERING_TAB" : "STOPPED", status: runtime.running ? "IIB tab closed. Recreating..." : "Stopped" });
  if (runtime.running && !runtime.paused) await controlCycle("tab_removed");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const runtime = await getRuntime();
  if (runtime.managedTabId !== tabId) return;
  const patch = {};
  if (changeInfo.url || tab.url) patch.lastKnownUrl = changeInfo.url || tab.url;
  if (changeInfo.status === "complete") patch.lastPageReadyAt = new Date().toISOString();
  if (Object.keys(patch).length) await updateRuntime(patch);
  if (changeInfo.status === "complete" && runtime.running && !runtime.paused) await controlCycle("tab_complete");
});

chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const runtime = await getRuntime();
  if (runtime.managedTabId !== details.tabId) return;
  await logEvent("navigation_error", details.error || "IIB navigation failed.", { tabId: details.tabId, url: details.url });
  await updateRuntime({ state: "RECOVERING_TAB", status: "IIB page failed to open. Recovering...", lastError: details.error || "Navigation failed" });
  if (runtime.running && !runtime.paused) await controlCycle("navigation_error");
}, { url: [{ hostEquals: "pos.iib.gov.in" }] });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(async (error) => {
    await recordFailure("message_failed", error, { type: message?.type });
    sendResponse({ ok: false, error: error?.message || "Unexpected extension error" });
  });
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_ALL_STATE": return getAllState();
    case "GET_RUNTIME": return { ok: true, ...(await getRuntime()) };
    case "SAVE_CONFIG": return saveConfig(message.config);
    case "START": return startChecker();
    case "CHECK_NOW": return controlCycle("manual", true);
    case "PAUSE": return pauseChecker();
    case "RESUME": return resumeChecker();
    case "STOP": return stopChecker();
    case "FOCUS_IIB": return focusManagedTab();
    case "RECONNECT_IIB": return reconnectManagedTab(false);
    case "RESTART_IIB": return reconnectManagedTab(true);
    case "EXPORT_DIAGNOSTICS": return exportDiagnostics();
    case "CLAIM_MORE": return claimMoreJobs();
    case "COMPLETE_JOB": return completeJob(message.payload);
    case "UPDATE_RUNTIME": return updateRuntime(message.patch || {});
    case "CONTENT_READY": {
      if (sender.tab?.id) {
        const runtime = await getRuntime();
        if (!runtime.managedTabId || runtime.managedTabId === sender.tab.id) {
          await updateRuntime({ managedTabId: sender.tab.id, managedWindowId: sender.tab.windowId, lastKnownUrl: sender.tab.url || null, lastContentPingAt: new Date().toISOString() });
        }
      }
      return { ok: true };
    }
    case "PORTAL_STATE": {
      if (sender.tab?.id) await updateRuntime({ managedTabId: sender.tab.id, managedWindowId: sender.tab.windowId, lastKnownUrl: sender.tab.url || null, lastPageType: message.pageType || "unknown", lastContentPingAt: new Date().toISOString() });
      return { ok: true };
    }
    default: return { ok: false, error: "Unknown message" };
  }
}

async function startChecker() {
  const { config } = await getAllState();
  validateConfig(config);
  await updateRuntime({ running: true, paused: false, state: "STARTING", status: "Opening the managed IIB tab...", lastError: null });
  await ensureHeartbeat();
  return controlCycle("start", true);
}

async function pauseChecker() {
  return updateRuntime({ paused: true, state: "PAUSED", status: "Paused. Current PAN is preserved." });
}

async function resumeChecker() {
  await updateRuntime({ paused: false, state: "STARTING", status: "Resuming..." });
  await ensureHeartbeat();
  return controlCycle("resume", true);
}

async function stopChecker() {
  const runtime = await getRuntime();
  return updateRuntime({ ...runtime, running: false, paused: false, state: "STOPPED", status: "Stopped", currentPan: null, currentJobId: null, currentAttempt: 0 });
}

async function controlCycle(reason = "unknown", force = false) {
  if (controlInFlight) return controlInFlight;
  controlInFlight = runControlCycle(reason, force).finally(() => { controlInFlight = null; });
  return controlInFlight;
}

async function runControlCycle(reason, force) {
  const { config } = await getAllState();
  validateConfig(config);
  let runtime = await getRuntime();
  if (!runtime.running) return { ok: true, skipped: true };
  if (runtime.paused && !force) return { ok: true, skipped: true };

  await logEvent("control_cycle", `Controller cycle: ${reason}`, { state: runtime.state });
  const tab = await ensureManagedTab();
  const portal = await verifyPortal(tab.id);
  runtime = await getRuntime();

  if (!portal.ok) {
    await updateRuntime({ state: "RECOVERING_TAB", status: portal.error || "Reconnecting to the IIB page...", lastError: portal.error || null });
    return { ok: false, error: portal.error || "IIB portal is not ready." };
  }

  const pageType = portal.pageType;
  if (["login", "captcha_error", "invalid_credentials", "session_expired"].includes(pageType)) {
    await updateRuntime({ state: pageType === "session_expired" ? "RECOVERING_SESSION" : "WAITING_FOR_CAPTCHA", status: pageType === "session_expired" ? "IIB session expired. Sign in again." : "Enter CAPTCHA and submit on the IIB page.", lastPageType: pageType });
    await focusManagedTab();
    await safeSend(tab.id, { type: "PREPARE_LOGIN", config: { iibUserId: config.iibUserId, iibPassword: config.iibPassword } });
    return { ok: true, waitingForLogin: true };
  }

  if (pageType === "menu") {
    await updateRuntime({ state: "OPENING_POS_QUERY", status: "Login successful. Opening PAN query...", lastPageType: pageType });
    const response = await safeSend(tab.id, { type: "OPEN_POS_QUERY" });
    if (!response?.ok) throw new Error(response?.error || "Could not open the PAN query page.");
    return { ok: true, navigating: true };
  }

  if (pageType !== "pan_query") {
    const recoverable = ["server_error", "blank", "unknown", "access_denied", "maintenance"].includes(pageType);
    await updateRuntime({ state: recoverable ? "RECOVERING_TAB" : "ERROR", status: portal.message || `Unexpected IIB page: ${pageType}`, lastPageType: pageType, lastError: portal.message || pageType });
    if (recoverable) await recoverManagedTab();
    return { ok: false, error: portal.message || `Unexpected IIB page: ${pageType}` };
  }

  await updateRuntime({ state: "SESSION_READY", status: "IIB PAN query is ready.", lastPageType: pageType, navigationAttempt: 0, lastError: null });

  runtime = await getRuntime();
  if (!runtime.queue?.length) await claimMoreJobs();
  runtime = await getRuntime();
  if (!runtime.queue?.length) {
    await updateRuntime({ state: "SESSION_READY", status: "No pending PANs. Waiting for new work..." });
    return { ok: true, jobs: 0 };
  }

  await safeSend(tab.id, { type: "WAKE_UP" });
  return { ok: true, jobs: runtime.queue.length };
}

async function ensureManagedTab() {
  let runtime = await getRuntime();
  if (runtime.managedTabId) {
    try {
      const tab = await chrome.tabs.get(runtime.managedTabId);
      if (tab?.id && tab.url?.startsWith("https://pos.iib.gov.in/")) return tab;
    } catch (_) {}
  }

  const existing = await chrome.tabs.query({ url: IIB_PATTERN });
  let tab = existing.find((item) => item.id && item.active) || existing.find((item) => item.id) || null;
  if (!tab) tab = await chrome.tabs.create({ url: IIB_URL, active: true });
  await updateRuntime({ managedTabId: tab.id, managedWindowId: tab.windowId, lastKnownUrl: tab.url || IIB_URL, state: "WAITING_FOR_PAGE", status: "Waiting for the IIB page to load..." });
  return tab;
}

async function verifyPortal(tabId) {
  const ready = await waitForTabComplete(tabId, PAGE_READY_TIMEOUT_MS);
  if (!ready) {
    await recoverManagedTab();
    return { ok: false, error: "IIB page did not finish loading." };
  }

  let response = await safeSend(tabId, { type: "PING" }, CONTENT_PING_TIMEOUT_MS);
  if (!response?.ok) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch (_) {}
    response = await safeSend(tabId, { type: "PING" }, CONTENT_PING_TIMEOUT_MS);
  }
  if (!response?.ok) {
    await recoverManagedTab();
    return { ok: false, error: "The IIB page opened, but the extension could not connect to it." };
  }

  const portal = await safeSend(tabId, { type: "DETECT_PAGE" }, CONTENT_PING_TIMEOUT_MS);
  if (!portal?.ok) return { ok: false, error: portal?.error || "Could not identify the IIB page." };
  await updateRuntime({ lastPageType: portal.pageType || "unknown", lastContentPingAt: new Date().toISOString(), lastKnownUrl: portal.url || null });
  return portal;
}

async function recoverManagedTab() {
  const runtime = await getRuntime();
  const attempt = (runtime.navigationAttempt || 0) + 1;
  if (attempt > MAX_NAVIGATION_ATTEMPTS) {
    await updateRuntime({ state: "ERROR", status: "IIB portal could not be opened after several attempts.", lastError: "Maximum navigation attempts reached", navigationAttempt: attempt });
    return;
  }
  await updateRuntime({ state: "RECOVERING_TAB", status: `Recovering IIB tab (${attempt}/${MAX_NAVIGATION_ATTEMPTS})...`, navigationAttempt: attempt });
  if (attempt === 1 && runtime.managedTabId) {
    try { await chrome.tabs.update(runtime.managedTabId, { url: IIB_URL, active: true }); return; } catch (_) {}
  }
  if (attempt === 2 && runtime.managedTabId) {
    try { await chrome.tabs.reload(runtime.managedTabId, { bypassCache: true }); return; } catch (_) {}
  }
  if (runtime.managedTabId) {
    try { await chrome.tabs.remove(runtime.managedTabId); } catch (_) {}
  }
  const tab = await chrome.tabs.create({ url: IIB_URL, active: true });
  await updateRuntime({ managedTabId: tab.id, managedWindowId: tab.windowId, lastKnownUrl: IIB_URL });
}

async function reconnectManagedTab(forceRecreate) {
  const runtime = await getRuntime();
  if (forceRecreate && runtime.managedTabId) {
    try { await chrome.tabs.remove(runtime.managedTabId); } catch (_) {}
    await updateRuntime({ managedTabId: null, managedWindowId: null, navigationAttempt: 0 });
  } else if (runtime.managedTabId) {
    try { await chrome.tabs.update(runtime.managedTabId, { url: IIB_URL, active: true }); } catch (_) {}
  }
  await updateRuntime({ state: "RECOVERING_TAB", status: forceRecreate ? "Restarting the IIB tab..." : "Reconnecting to IIB...", navigationAttempt: 0, lastError: null });
  return controlCycle(forceRecreate ? "restart" : "reconnect", true);
}

async function focusManagedTab() {
  const runtime = await getRuntime();
  if (!runtime.managedTabId) {
    const tab = await ensureManagedTab();
    return { ok: true, tabId: tab.id };
  }
  try {
    const tab = await chrome.tabs.get(runtime.managedTabId);
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
    return { ok: true, tabId: tab.id };
  } catch (_) {
    await updateRuntime({ managedTabId: null, managedWindowId: null });
    const tab = await ensureManagedTab();
    return { ok: true, tabId: tab.id };
  }
}

async function claimMoreJobs() {
  if (claimInFlight) return claimInFlight;
  claimInFlight = doClaimMoreJobs().finally(() => { claimInFlight = null; });
  return claimInFlight;
}

async function doClaimMoreJobs() {
  const { config, runtime } = await getAllState();
  validateConfig(config);
  if (!runtime.running || runtime.paused || runtime.lastPageType !== "pan_query") return { ok: true, jobs: [] };
  const limit = Math.max(1, Math.min(Number(config.batchSize) || 3, 10));
  const response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pan-worker-key": config.workerKey },
    body: JSON.stringify({ limit, device: config.deviceName })
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(body?.error || `Claim failed (${response.status})`);
  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const current = await getRuntime();
  const existingIds = new Set((current.queue || []).map((job) => job.id));
  const merged = [...(current.queue || []), ...jobs.filter((job) => !existingIds.has(job.id))];
  await updateRuntime({ queue: merged, totalClaimed: (current.totalClaimed || 0) + jobs.length, status: merged.length ? "PANs ready" : "No pending PANs. Waiting for new work..." });
  return { ok: true, jobs };
}

async function completeJob(payload) {
  const { config } = await getAllState();
  validateConfig(config);
  let response;
  let body = {};
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/complete`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-pan-worker-key": config.workerKey },
        body: JSON.stringify({ jobId: payload.jobId, status: payload.status, resultMessage: payload.resultMessage || null, error: payload.error || null, device: config.deviceName })
      });
      body = await safeJson(response);
      if (response.ok) break;
      lastError = new Error(body?.error || `Completion failed (${response.status})`);
    } catch (error) { lastError = error; }
    if (attempt < 3) await sleep(1000 * attempt);
  }
  if (!response?.ok) throw lastError || new Error("Could not submit the PAN result to InsureIt.");

  const runtime = await getRuntime();
  const queue = (runtime.queue || []).filter((job) => job.id !== payload.jobId);
  await updateRuntime({ queue, processed: (runtime.processed || 0) + 1, lastResult: payload.status, currentPan: null, currentJobId: null, currentAttempt: 0, state: "SESSION_READY", status: payload.status === "not_found" ? "No record found - InsureIt updated" : payload.status === "matched" ? "Matching record found - InsureIt updated" : `${payload.status} - InsureIt updated` });
  await refreshOpenInsureitTabs(config.insureitUrl, body.applicationId);
  return { ok: true, applicationId: body.applicationId };
}

async function saveConfig(config) {
  const normalized = {
    insureitUrl: trimSlash(config?.insureitUrl),
    workerKey: String(config?.workerKey || "").trim(),
    iibUserId: String(config?.iibUserId || "").trim(),
    iibPassword: String(config?.iibPassword || ""),
    deviceName: String(config?.deviceName || "N.M. PAN Checker").trim() || "N.M. PAN Checker",
    batchSize: Math.max(1, Math.min(Number(config?.batchSize) || 3, 10))
  };
  if (!normalized.insureitUrl || !normalized.workerKey || !normalized.iibUserId || !normalized.iibPassword) throw new Error("Complete the InsureIt URL, worker key and IIB credentials.");
  await chrome.storage.local.set({ config: normalized });
  return { ok: true, config: normalized };
}

async function exportDiagnostics() {
  const stored = await chrome.storage.local.get(["runtime", "diagnostics"]);
  const payload = { exportedAt: new Date().toISOString(), extensionVersion: chrome.runtime.getManifest().version, runtime: sanitizeRuntime(stored.runtime || DEFAULT_STATE), diagnostics: stored.diagnostics || [] };
  const url = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
  const downloadId = await chrome.downloads.download({ url, filename: `nm-iib-pan-checker-diagnostics-${Date.now()}.json`, saveAs: true });
  return { ok: true, downloadId };
}

async function logEvent(type, message, details = {}) {
  const stored = await chrome.storage.local.get(["diagnostics"]);
  const diagnostics = Array.isArray(stored.diagnostics) ? stored.diagnostics : [];
  diagnostics.push({ at: new Date().toISOString(), type, message, details: sanitizeDetails(details) });
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
  await chrome.storage.local.set({ diagnostics });
}

async function recordFailure(type, error, details = {}) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  await logEvent(type, message, details);
  const runtime = await getRuntime();
  await updateRuntime({ lastError: message, status: runtime.running ? message : runtime.status });
}

async function waitForTabComplete(tabId, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete" && tab.url?.startsWith("https://pos.iib.gov.in/")) return true;
    } catch (_) { return false; }
    await sleep(300);
  }
  return false;
}

async function safeSend(tabId, message, timeoutMs = 7000) {
  try {
    return await Promise.race([
      chrome.tabs.sendMessage(tabId, message),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "Content script response timed out." }), timeoutMs))
    ]);
  } catch (error) {
    return { ok: false, error: error?.message || "Content script unavailable." };
  }
}

async function refreshOpenInsureitTabs(insureitUrl, applicationId) {
  const origin = new URL(trimSlash(insureitUrl)).origin;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    let url;
    try { url = new URL(tab.url); } catch (_) { continue; }
    if (url.origin !== origin) continue;
    if (applicationId && !url.pathname.includes(applicationId)) continue;
    try { await chrome.tabs.reload(tab.id, { bypassCache: true }); } catch (_) {}
  }
}

async function getAllState() {
  const stored = await chrome.storage.local.get(["config", "runtime"]);
  return { ok: true, config: stored.config || {}, runtime: { ...DEFAULT_STATE, ...(stored.runtime || {}) } };
}
async function getRuntime() { const stored = await chrome.storage.local.get(["runtime"]); return { ...DEFAULT_STATE, ...(stored.runtime || {}) }; }
async function updateRuntime(patch) { const runtime = await getRuntime(); const next = { ...runtime, ...patch }; await chrome.storage.local.set({ runtime: next }); await broadcastRuntime(next); return { ok: true, ...next }; }
async function broadcastRuntime(runtime) { try { await chrome.runtime.sendMessage({ type: "RUNTIME_CHANGED", runtime }); } catch (_) {} if (runtime.managedTabId) try { await chrome.tabs.sendMessage(runtime.managedTabId, { type: "RUNTIME_CHANGED", runtime }); } catch (_) {} }
async function ensureHeartbeat() { const existing = await chrome.alarms.get(HEARTBEAT_ALARM); if (!existing) await chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: HEARTBEAT_MINUTES, periodInMinutes: HEARTBEAT_MINUTES }); }
function validateConfig(config) { if (!config?.insureitUrl || !config?.workerKey || !config?.iibUserId || !config?.iibPassword) throw new Error("Open the extension and save all settings first."); }
function trimSlash(value) { return String(value || "").trim().replace(/\/+$/, ""); }
async function safeJson(response) { try { return await response.json(); } catch (_) { return {}; } }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sanitizeRuntime(runtime) { const copy = { ...runtime }; if (copy.currentPan) copy.currentPan = String(copy.currentPan).replace(/.(?=.{3})/g, "*"); if (Array.isArray(copy.queue)) copy.queue = copy.queue.map((job) => ({ id: job.id, pan: maskPan(job.pan_number), status: job.status || null })); return copy; }
function sanitizeDetails(details) { const text = JSON.stringify(details || {}); return JSON.parse(text.replace(/[A-Z]{5}[0-9]{4}[A-Z]/g, (pan) => maskPan(pan))); }
function maskPan(value) { const pan = String(value || "").trim().toUpperCase(); return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "—"; }
