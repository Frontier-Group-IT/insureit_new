const DEFAULT_STATE = {
  running: false,
  paused: false,
  status: "Idle",
  currentPan: null,
  processed: 0,
  totalClaimed: 0,
  lastResult: null,
  activeTabId: null,
  queue: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["runtime"]);
  if (!stored.runtime) await chrome.storage.local.set({ runtime: DEFAULT_STATE });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Unexpected extension error" }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_ALL_STATE":
      return getAllState();
    case "SAVE_CONFIG":
      return saveConfig(message.config);
    case "START":
      return startChecker();
    case "PAUSE":
      return updateRuntime({ paused: true, status: "Paused" });
    case "RESUME":
      return updateRuntime({ paused: false, status: "Resuming" });
    case "STOP":
      return stopChecker();
    case "GET_RUNTIME":
      return { ok: true, ...(await getRuntime()) };
    case "CLAIM_MORE":
      return claimMoreJobs();
    case "COMPLETE_JOB":
      return completeJob(message.payload);
    case "UPDATE_RUNTIME":
      return updateRuntime(message.patch || {});
    case "CONTENT_READY":
      if (sender.tab?.id) await updateRuntime({ activeTabId: sender.tab.id });
      return { ok: true };
    default:
      return { ok: false, error: "Unknown message" };
  }
}

async function getAllState() {
  const stored = await chrome.storage.local.get(["config", "runtime"]);
  return { ok: true, config: stored.config || {}, runtime: stored.runtime || DEFAULT_STATE };
}

async function saveConfig(config) {
  const normalized = {
    insureitUrl: trimSlash(config?.insureitUrl),
    workerKey: String(config?.workerKey || "").trim(),
    iibUserId: String(config?.iibUserId || "").trim(),
    iibPassword: String(config?.iibPassword || ""),
    deviceName: String(config?.deviceName || "N.M. PAN Checker").trim() || "N.M. PAN Checker",
    batchSize: Math.max(1, Math.min(Number(config?.batchSize) || 20, 100))
  };
  if (!normalized.insureitUrl || !normalized.workerKey || !normalized.iibUserId || !normalized.iibPassword) {
    throw new Error("Complete the InsureIt URL, worker key and IIB credentials.");
  }
  await chrome.storage.local.set({ config: normalized });
  return { ok: true, config: normalized };
}

async function startChecker() {
  const { config } = await getAllState();
  validateConfig(config);
  await chrome.storage.local.set({ runtime: { ...DEFAULT_STATE, running: true, status: "Claiming queued PANs" } });
  const claim = await claimMoreJobs();
  const tab = await findOrOpenIibTab();
  await updateRuntime({ activeTabId: tab.id, status: claim.jobs.length ? "Opening IIB POS" : "No pending PANs" });
  return { ok: true, jobs: claim.jobs.length };
}

async function stopChecker() {
  const runtime = await getRuntime();
  const next = { ...runtime, running: false, paused: false, status: "Stopped", currentPan: null, queue: [] };
  await chrome.storage.local.set({ runtime: next });
  broadcastRuntime(next);
  return { ok: true, ...next };
}

async function claimMoreJobs() {
  const { config, runtime } = await getAllState();
  validateConfig(config);
  if (!runtime.running) return { ok: true, jobs: [] };

  const response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/claim`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pan-worker-key": config.workerKey
    },
    body: JSON.stringify({ limit: config.batchSize || 20, device: config.deviceName })
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(body?.error || `Claim failed (${response.status})`);

  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const current = await getRuntime();
  const existingIds = new Set((current.queue || []).map((job) => job.id));
  const merged = [...(current.queue || []), ...jobs.filter((job) => !existingIds.has(job.id))];
  const patch = {
    queue: merged,
    totalClaimed: (current.totalClaimed || 0) + jobs.length,
    status: merged.length ? "PANs ready" : "No pending PANs"
  };
  await updateRuntime(patch);
  return { ok: true, jobs };
}

async function completeJob(payload) {
  const { config } = await getAllState();
  validateConfig(config);
  const response = await fetch(`${trimSlash(config.insureitUrl)}/api/internal/pan-verification/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pan-worker-key": config.workerKey
    },
    body: JSON.stringify({
      jobId: payload.jobId,
      status: payload.status,
      resultMessage: payload.resultMessage || null,
      error: payload.error || null,
      device: config.deviceName
    })
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error(body?.error || `Completion failed (${response.status})`);

  const runtime = await getRuntime();
  const queue = (runtime.queue || []).filter((job) => job.id !== payload.jobId);
  const next = {
    queue,
    processed: (runtime.processed || 0) + 1,
    lastResult: payload.status,
    currentPan: null,
    status: payload.status === "not_found" ? "No record found" : payload.status === "matched" ? "Matching record found" : payload.status
  };
  await updateRuntime(next);
  return { ok: true, applicationId: body.applicationId };
}

async function findOrOpenIibTab() {
  const tabs = await chrome.tabs.query({ url: "https://pos.iib.gov.in/*" });
  if (tabs.length) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    return tab;
  }
  return chrome.tabs.create({ url: "https://pos.iib.gov.in/", active: true });
}

async function updateRuntime(patch) {
  const runtime = await getRuntime();
  const next = { ...runtime, ...patch };
  await chrome.storage.local.set({ runtime: next });
  broadcastRuntime(next);
  return { ok: true, ...next };
}

async function getRuntime() {
  const stored = await chrome.storage.local.get(["runtime"]);
  return stored.runtime || DEFAULT_STATE;
}

async function broadcastRuntime(runtime) {
  try {
    await chrome.runtime.sendMessage({ type: "RUNTIME_CHANGED", runtime });
  } catch (_) {}
  if (runtime.activeTabId) {
    try {
      await chrome.tabs.sendMessage(runtime.activeTabId, { type: "RUNTIME_CHANGED", runtime });
    } catch (_) {}
  }
}

function validateConfig(config) {
  if (!config?.insureitUrl || !config?.workerKey || !config?.iibUserId || !config?.iibPassword) {
    throw new Error("Open the extension and save all settings first.");
  }
}

function trimSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

async function safeJson(response) {
  try { return await response.json(); } catch (_) { return {}; }
}
