const IIB_URL = "https://pos.iib.gov.in/";
const IIB_PATTERN = "https://pos.iib.gov.in/*";
const HEARTBEAT_ALARM = "nm-pan-heartbeat";
const HEARTBEAT_MINUTES = 0.5;
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
  discarded: 0,
  totalClaimed: 0,
  lastResult: null,
  lastError: null,
  managedTabId: null,
  managedWindowId: null,
  lastKnownUrl: null,
  lastPageType: "unknown",
  lastSyncAt: null,
  lastLeaseAt: null,
  queue: []
};

let claimInFlight = null;
let controlInFlight = null;
let heartbeatInFlight = null;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["runtime", "config", "diagnostics"]);
  const config = await ensureWorkerSession(stored.config || {});
  await chrome.storage.local.set({
    config,
    runtime: { ...DEFAULT_STATE, ...(stored.runtime || {}) },
    diagnostics: Array.isArray(stored.diagnostics) ? stored.diagnostics : []
  });
  await ensureHeartbeat();
});

chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(["config"]);
  await chrome.storage.local.set({ config: await ensureWorkerSession(stored.config || {}) });
  await ensureHeartbeat();
  const runtime = await getRuntime();
  if (runtime.running && !runtime.paused) await controlCycle("startup");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  runHeartbeatCycle().catch((error) => recordFailure("heartbeat_failed", error));
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const runtime = await getRuntime();
  if (runtime.managedTabId !== tabId) return;
  await updateRuntime({ managedTabId: null, managedWindowId: null, lastKnownUrl: null, lastPageType: "unknown", state: runtime.running ? "RECOVERING_TAB" : "STOPPED", status: runtime.running ? "IIB tab closed. Recreating..." : "Stopped" });
  if (runtime.running && !runtime.paused) await controlCycle("tab_closed");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const runtime = await getRuntime();
  if (runtime.managedTabId !== tabId) return;
  if (changeInfo.url || tab.url) await updateRuntime({ lastKnownUrl: changeInfo.url || tab.url });
  if (changeInfo.status === "complete" && runtime.running && !runtime.paused) await controlCycle("tab_ready");
});

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
    case "PAUSE": return updateRuntime({ paused: true, state: "PAUSED", status: "Paused. Current PAN is preserved." });
    case "RESUME": await updateRuntime({ paused: false, state: "STARTING", status: "Resuming..." }); return controlCycle("resume", true);
    case "STOP": return stopChecker();
    case "FOCUS_IIB": return focusManagedTab();
    case "RECONNECT_IIB": return reconnectManagedTab(false);
    case "RESTART_IIB": return reconnectManagedTab(true);
    case "EXPORT_DIAGNOSTICS": return exportDiagnostics();
    case "CLAIM_MORE": return claimMoreJobs();
    case "COMPLETE_JOB": return completeJob(message.payload);
    case "UPDATE_RUNTIME": return updateRuntime(message.patch || {});
    case "CONTENT_READY":
      if (sender.tab?.id) await updateRuntime({ managedTabId: sender.tab.id, managedWindowId: sender.tab.windowId, lastKnownUrl: sender.tab.url || null });
      return { ok: true };
    case "PORTAL_STATE":
      if (sender.tab?.id) await updateRuntime({ managedTabId: sender.tab.id, managedWindowId: sender.tab.windowId, lastKnownUrl: sender.tab.url || null, lastPageType: message.pageType || "unknown" });
      return { ok: true };
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

async function stopChecker() {
  const runtime = await getRuntime();
  return updateRuntime({ ...runtime, running: false, paused: false, state: "STOPPED", status: "Stopped. Claimed jobs will safely expire if unfinished.", currentPan: null, currentJobId: null, currentAttempt: 0, queue: [] });
}

async function runHeartbeatCycle() {
  if (heartbeatInFlight) return heartbeatInFlight;
  heartbeatInFlight = (async () => {
    const runtime = await getRuntime();
    if (!runtime.running || runtime.paused) return { ok: true, skipped: true };
    await renewLeases();
    return controlCycle("alarm");
  })().finally(() => { heartbeatInFlight = null; });
  return heartbeatInFlight;
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

  await logEvent("control_cycle", `Controller cycle: ${reason}`, { state: runtime.state, queue: runtime.queue?.length || 0 });
  await renewLeases();
  const tab = await ensureManagedTab();
  const portal = await verifyPortal(tab.id);
  if (!portal.ok) {
    await updateRuntime({ state: "RECOVERING_TAB", status: portal.error || "Reconnecting to IIB...", lastError: portal.error || null });
    return { ok: false, error: portal.error };
  }

  if (["login", "captcha_error", "invalid_credentials", "session_expired"].includes(portal.pageType)) {
    await updateRuntime({ state: portal.pageType === "session_expired" ? "RECOVERING_SESSION" : "WAITING_FOR_CAPTCHA", status: portal.pageType === "session_expired" ? "IIB session expired. Sign in again; current work is preserved." : "Enter CAPTCHA and submit on the IIB page.", lastPageType: portal.pageType });
    await focusManagedTab();
    await safeSend(tab.id, { type: "PREPARE_LOGIN", config: { iibUserId: config.iibUserId, iibPassword: config.iibPassword } });
    return { ok: true, waitingForLogin: true };
  }

  if (portal.pageType === "menu") {
    await updateRuntime({ state: "OPENING_POS_QUERY", status: "Login successful. Opening PAN query...", lastPageType: "menu" });
    return safeSend(tab.id, { type: "OPEN_POS_QUERY" });
  }

  if (portal.pageType !== "pan_query") {
    await updateRuntime({ state: "RECOVERING_TAB", status: portal.message || `Unexpected IIB page: ${portal.pageType}`, lastError: portal.message || portal.pageType });
    await reconnectManagedTab(false);
    return { ok: false, error: portal.message || portal.pageType };
  }

  await updateRuntime({ state: "SESSION_READY", status: "IIB PAN query is ready.", lastPageType: "pan_query", lastError: null });
  runtime = await getRuntime();
  const capacity = Math.max(0, Math.min(Number(config.batchSize) || 3, 10) - (runtime.queue?.length || 0));
  if (capacity > 0) await claimMoreJobs(capacity);
  runtime = await getRuntime();
  if (!runtime.queue?.length) {
    await updateRuntime({ state: "SESSION_READY", status: "No pending PANs. Waiting for new work..." });
    return { ok: true, jobs: 0 };
  }
  await safeSend(tab.id, { type: "WAKE_UP" });
  return { ok: true, jobs: runtime.queue.length };
}

async function claimMoreJobs(requestedLimit) {
  if (claimInFlight) return claimInFlight;
  claimInFlight = doClaimMoreJobs(requestedLimit).finally(() => { claimInFlight = null; });
  return claimInFlight;
}

async function doClaimMoreJobs(requestedLimit) {
  const { config, runtime } = await getAllState();
  validateConfig(config);
  if (!runtime.running || runtime.paused || runtime.lastPageType !== "pan_query") return { ok: true, jobs: [] };
  const capacity = Math.max(0, Math.min(Number(config.batchSize) || 3, 10) - (runtime.queue?.length || 0));
  const limit = Math.max(0, Math.min(Number(requestedLimit) || capacity, capacity));
  if (!limit) return { ok: true, jobs: [] };

  const response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/claim`, {
    method: "POST",
    headers: workerHeaders(config),
    body: JSON.stringify({ limit, device: config.deviceName, workerSessionId: config.workerSessionId })
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(body?.error || `Claim failed (${response.status})`);

  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const current = await getRuntime();
  const existingIds = new Set((current.queue || []).map((job) => job.id));
  const merged = [...(current.queue || []), ...jobs.filter((job) => job?.id && !existingIds.has(job.id))];
  await updateRuntime({ queue: merged, totalClaimed: (current.totalClaimed || 0) + jobs.filter((job) => !existingIds.has(job.id)).length, lastSyncAt: new Date().toISOString(), status: merged.length ? `${merged.length} PAN job${merged.length === 1 ? "" : "s"} ready` : "No pending PANs. Waiting for new work..." });
  return { ok: true, jobs };
}

async function renewLeases() {
  const { config, runtime } = await getAllState();
  if (!runtime.running || runtime.paused || !config.workerSessionId) return { ok: true, skipped: true };
  const jobIds = (runtime.queue || []).map((job) => job?.id).filter(Boolean);
  if (runtime.currentJobId && !jobIds.includes(runtime.currentJobId)) jobIds.push(runtime.currentJobId);
  if (!jobIds.length) return { ok: true, jobs: [] };

  const response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/heartbeat`, {
    method: "POST",
    headers: workerHeaders(config),
    body: JSON.stringify({ jobIds, workerSessionId: config.workerSessionId, device: config.deviceName })
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(body?.error || `Heartbeat failed (${response.status})`);

  const activeIds = new Set((Array.isArray(body.jobs) ? body.jobs : []).map((job) => job.id));
  const queue = (runtime.queue || []).filter((job) => activeIds.has(job.id));
  const lost = (runtime.queue || []).filter((job) => !activeIds.has(job.id));
  const patch = { queue, lastLeaseAt: new Date().toISOString() };
  if (runtime.currentJobId && !activeIds.has(runtime.currentJobId)) Object.assign(patch, { currentJobId: null, currentPan: null, currentAttempt: 0, state: "SESSION_READY", status: "A job lease expired or was reclaimed. Checking for fresh work..." });
  if (lost.length) await logEvent("lease_lost", "Removed jobs no longer owned by this worker.", { count: lost.length, ids: lost.map((job) => job.id) });
  await updateRuntime(patch);
  return { ok: true, jobs: [...activeIds] };
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
        headers: workerHeaders(config),
        body: JSON.stringify({ ...payload, workerSessionId: config.workerSessionId, device: config.deviceName })
      });
      body = await safeJson(response);
      if (response.ok) break;
      lastError = new Error(body?.error || `Completion failed (${response.status})`);
    } catch (error) { lastError = error; }
    if (attempt < 3) await sleep(attempt * 1000);
  }
  if (!response?.ok) throw lastError || new Error("Could not submit the PAN result to InsureIt.");

  const runtime = await getRuntime();
  const queue = (runtime.queue || []).filter((job) => job.id !== payload.jobId);
  if (body.discarded || body.applied === false) {
    const reason = body.reason || "result_discarded";
    await updateRuntime({ queue, discarded: (runtime.discarded || 0) + 1, currentPan: null, currentJobId: null, currentAttempt: 0, state: "SESSION_READY", status: discardedMessage(reason), lastResult: `discarded:${reason}` });
    await logEvent("completion_discarded", "InsureIt discarded a PAN result.", { jobId: payload.jobId, reason });
    return { ok: true, applied: false, discarded: true, reason, applicationId: body.applicationId || null };
  }

  await updateRuntime({ queue, processed: (runtime.processed || 0) + 1, currentPan: null, currentJobId: null, currentAttempt: 0, state: "SESSION_READY", status: payload.status === "not_found" ? "No record found - InsureIt updated" : payload.status === "matched" ? "Matching record found - InsureIt updated" : `${payload.status} - InsureIt updated`, lastResult: payload.status });
  await refreshOpenInsureitTabs(config.insureitUrl, body.applicationId);
  return { ok: true, applied: true, applicationId: body.applicationId };
}

async function verifyPortal(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status !== "complete") return { ok: false, error: "Waiting for the IIB page to load." };
  } catch (_) { return { ok: false, error: "The managed IIB tab is unavailable." }; }
  let ping = await safeSend(tabId, { type: "PING" });
  if (!ping?.ok) {
    try { await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }); } catch (_) {}
    ping = await safeSend(tabId, { type: "PING" });
  }
  if (!ping?.ok) return { ok: false, error: "The extension could not connect to the IIB page." };
  const portal = await safeSend(tabId, { type: "DETECT_PAGE" });
  if (portal?.ok) await updateRuntime({ lastPageType: portal.pageType || "unknown", lastKnownUrl: portal.url || null });
  return portal || { ok: false, error: "Could not identify the IIB page." };
}

async function ensureManagedTab() {
  const runtime = await getRuntime();
  if (runtime.managedTabId) {
    try { const tab = await chrome.tabs.get(runtime.managedTabId); if (tab?.url?.startsWith(IIB_URL)) return tab; } catch (_) {}
  }
  const existing = await chrome.tabs.query({ url: IIB_PATTERN });
  const tab = existing.find((item) => item.id) || await chrome.tabs.create({ url: IIB_URL, active: true });
  await updateRuntime({ managedTabId: tab.id, managedWindowId: tab.windowId, lastKnownUrl: tab.url || IIB_URL });
  return tab;
}

async function focusManagedTab() {
  const tab = await ensureManagedTab();
  await chrome.tabs.update(tab.id, { active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true });
  return { ok: true, tabId: tab.id };
}

async function reconnectManagedTab(forceRecreate) {
  const runtime = await getRuntime();
  if (runtime.managedTabId && forceRecreate) { try { await chrome.tabs.remove(runtime.managedTabId); } catch (_) {} await updateRuntime({ managedTabId: null }); }
  const tab = await ensureManagedTab();
  if (!forceRecreate) await chrome.tabs.update(tab.id, { url: IIB_URL, active: true });
  await updateRuntime({ state: "RECOVERING_TAB", status: forceRecreate ? "Restarting the IIB tab..." : "Reconnecting to IIB...", lastError: null });
  return { ok: true };
}

async function saveConfig(input) {
  const stored = await chrome.storage.local.get(["config"]);
  const normalized = await ensureWorkerSession({
    ...stored.config,
    insureitUrl: trimSlash(input?.insureitUrl),
    workerKey: String(input?.workerKey || "").trim(),
    iibUserId: String(input?.iibUserId || "").trim(),
    iibPassword: String(input?.iibPassword || ""),
    deviceName: String(input?.deviceName || "N.M. PAN Checker").trim() || "N.M. PAN Checker",
    batchSize: Math.max(1, Math.min(Number(input?.batchSize) || 3, 10))
  });
  validateConfig(normalized);
  await chrome.storage.local.set({ config: normalized });
  return { ok: true, config: normalized };
}

async function ensureWorkerSession(config) {
  return { ...config, workerSessionId: config.workerSessionId || crypto.randomUUID() };
}

async function refreshOpenInsureitTabs(insureitUrl, applicationId) {
  const origin = new URL(trimSlash(insureitUrl)).origin;
  for (const tab of await chrome.tabs.query({})) {
    if (!tab.id || !tab.url) continue;
    let url; try { url = new URL(tab.url); } catch (_) { continue; }
    if (url.origin !== origin) continue;
    if (applicationId && !url.pathname.includes(applicationId)) continue;
    try { await chrome.tabs.reload(tab.id, { bypassCache: true }); } catch (_) {}
  }
}

async function exportDiagnostics() {
  const stored = await chrome.storage.local.get(["runtime", "diagnostics", "config"]);
  const payload = { exportedAt: new Date().toISOString(), extensionVersion: chrome.runtime.getManifest().version, workerSessionId: stored.config?.workerSessionId || null, runtime: sanitizeRuntime(stored.runtime || DEFAULT_STATE), diagnostics: stored.diagnostics || [] };
  const url = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
  const downloadId = await chrome.downloads.download({ url, filename: `nm-iib-pan-checker-diagnostics-${Date.now()}.json`, saveAs: true });
  return { ok: true, downloadId };
}

async function getAllState() { const stored = await chrome.storage.local.get(["config", "runtime"]); return { ok: true, config: await ensureWorkerSession(stored.config || {}), runtime: { ...DEFAULT_STATE, ...(stored.runtime || {}) } }; }
async function getRuntime() { const stored = await chrome.storage.local.get(["runtime"]); return { ...DEFAULT_STATE, ...(stored.runtime || {}) }; }
async function updateRuntime(patch) { const next = { ...(await getRuntime()), ...patch }; await chrome.storage.local.set({ runtime: next }); await broadcastRuntime(next); return { ok: true, ...next }; }
async function broadcastRuntime(runtime) { try { await chrome.runtime.sendMessage({ type: "RUNTIME_CHANGED", runtime }); } catch (_) {} if (runtime.managedTabId) try { await chrome.tabs.sendMessage(runtime.managedTabId, { type: "RUNTIME_CHANGED", runtime }); } catch (_) {} }
async function safeSend(tabId, message, timeoutMs = 7000) { try { return await Promise.race([chrome.tabs.sendMessage(tabId, message), new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "Content script response timed out." }), timeoutMs))]); } catch (error) { return { ok: false, error: error?.message || "Content script unavailable." }; } }
async function ensureHeartbeat() { if (!(await chrome.alarms.get(HEARTBEAT_ALARM))) await chrome.alarms.create(HEARTBEAT_ALARM, { delayInMinutes: HEARTBEAT_MINUTES, periodInMinutes: HEARTBEAT_MINUTES }); }
async function logEvent(type, message, details = {}) { const stored = await chrome.storage.local.get(["diagnostics"]); const diagnostics = Array.isArray(stored.diagnostics) ? stored.diagnostics : []; diagnostics.push({ at: new Date().toISOString(), type, message, details: sanitizeDetails(details) }); if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS); await chrome.storage.local.set({ diagnostics }); }
async function recordFailure(type, error, details = {}) { const message = error instanceof Error ? error.message : String(error || "Unknown error"); await logEvent(type, message, details); await updateRuntime({ lastError: message, status: message }); }
function workerHeaders(config) { return { "content-type": "application/json", "x-pan-worker-key": config.workerKey }; }
function validateConfig(config) { if (!config?.insureitUrl || !config?.workerKey || !config?.iibUserId || !config?.iibPassword || !config?.workerSessionId) throw new Error("Open the extension and save all settings first."); }
function discardedMessage(reason) { return ({ stale_pan_result: "Result discarded because the PAN changed. Queue a fresh check.", worker_session_mismatch: "Result discarded because another checker owns this job.", lease_expired: "Result discarded because the job lease expired. Checking for fresh work...", job_replaced: "Result discarded because this job was replaced." })[reason] || `Result discarded by InsureIt (${reason}).`; }
function trimSlash(value) { return String(value || "").trim().replace(/\/+$/, ""); }
async function safeJson(response) { try { return await response.json(); } catch (_) { return {}; } }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sanitizeRuntime(runtime) { return { ...runtime, currentPan: runtime.currentPan ? maskPan(runtime.currentPan) : null, queue: (runtime.queue || []).map((job) => ({ id: job.id, pan: maskPan(job.pan_number), lease_expires_at: job.lease_expires_at || null })) }; }
function sanitizeDetails(details) { return JSON.parse(JSON.stringify(details || {}).replace(/[A-Z]{5}[0-9]{4}[A-Z]/g, maskPan)); }
function maskPan(value) { const pan = String(value || "").trim().toUpperCase(); return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "—"; }
