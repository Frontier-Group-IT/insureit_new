const NM_QUEUE_RECONCILE_ALARM = "nm-pan-queue-reconcile";
const NM_QUEUE_RECONCILE_MINUTES = 0.5;

chrome.runtime.onInstalled.addListener(() => {
  ensureQueueReconcileAlarm().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureQueueReconcileAlarm().then(() => reconcileQueue("startup")).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== NM_QUEUE_RECONCILE_ALARM) return;
  reconcileQueue("alarm").catch((error) => recordQueueDiagnostic("queue_reconcile_failed", error?.message || String(error || "Queue reconciliation failed")));
});

ensureQueueReconcileAlarm().catch(() => {});

async function ensureQueueReconcileAlarm() {
  const existing = await chrome.alarms.get(NM_QUEUE_RECONCILE_ALARM);
  if (!existing) {
    await chrome.alarms.create(NM_QUEUE_RECONCILE_ALARM, {
      delayInMinutes: NM_QUEUE_RECONCILE_MINUTES,
      periodInMinutes: NM_QUEUE_RECONCILE_MINUTES
    });
  }
}

async function reconcileQueue(reason) {
  const stored = await chrome.storage.local.get(["config", "runtime", "diagnostics"]);
  const config = stored.config || {};
  const runtime = stored.runtime || {};

  if (!runtime.running || runtime.paused || runtime.lastPageType !== "pan_query") return;
  if (!config.insureitUrl || !config.workerKey || !config.deviceName) return;

  const limit = Math.max(1, Math.min(Number(config.batchSize) || 3, 10));
  const endpoint = `${String(config.insureitUrl).replace(/\/+$/, "")}/api/internal/pan-verification/claim`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pan-worker-key": config.workerKey
      },
      body: JSON.stringify({ limit, device: config.deviceName })
    });
  } catch (error) {
    await recordQueueDiagnostic("queue_reconcile_network_failed", error?.message || "Failed to reach InsureIt", { reason });
    return;
  }

  let body = {};
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) {
    await recordQueueDiagnostic("queue_reconcile_server_failed", body?.error || `Queue reconciliation failed (${response.status})`, { reason });
    return;
  }

  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const previousQueue = Array.isArray(runtime.queue) ? runtime.queue : [];
  const previousIds = new Set(previousQueue.map((job) => job?.id).filter(Boolean));
  const activeIds = new Set(jobs.map((job) => job?.id).filter(Boolean));
  const newlyClaimed = jobs.filter((job) => job?.id && !previousIds.has(job.id)).length;
  const staleRemoved = previousQueue.filter((job) => job?.id && !activeIds.has(job.id)).length;
  const currentJobStillActive = runtime.currentJobId ? activeIds.has(runtime.currentJobId) : true;

  const nextRuntime = {
    ...runtime,
    queue: jobs,
    totalClaimed: Number(runtime.totalClaimed || 0) + newlyClaimed,
    status: jobs.length ? `${jobs.length} PAN job${jobs.length === 1 ? "" : "s"} ready` : "No pending PANs. Waiting for new work...",
    lastError: null
  };

  if (!currentJobStillActive) {
    nextRuntime.currentJobId = null;
    nextRuntime.currentPan = null;
    nextRuntime.currentAttempt = 0;
    nextRuntime.state = "SESSION_READY";
  }

  await chrome.storage.local.set({ runtime: nextRuntime });
  await recordQueueDiagnostic("queue_reconciled", "PAN queue synchronized with InsureIt.", {
    reason,
    activeJobs: jobs.length,
    newlyClaimed,
    staleRemoved
  });

  try { chrome.runtime.sendMessage({ type: "RUNTIME_CHANGED", runtime: nextRuntime }, () => void chrome.runtime.lastError); } catch (_) {}
  if (nextRuntime.managedTabId && jobs.length) {
    try { chrome.tabs.sendMessage(nextRuntime.managedTabId, { type: "WAKE_UP" }, () => void chrome.runtime.lastError); } catch (_) {}
  }
}

async function recordQueueDiagnostic(type, message, details = {}) {
  try {
    const stored = await chrome.storage.local.get(["diagnostics"]);
    const diagnostics = Array.isArray(stored.diagnostics) ? stored.diagnostics : [];
    diagnostics.push({ at: new Date().toISOString(), type, message, details });
    if (diagnostics.length > 300) diagnostics.splice(0, diagnostics.length - 300);
    await chrome.storage.local.set({ diagnostics });
  } catch (_) {}
}
