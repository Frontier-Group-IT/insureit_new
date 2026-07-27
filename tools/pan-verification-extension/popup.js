const elements = {
  form: document.getElementById("settings-form"),
  panel: document.getElementById("settings-panel"),
  insureitUrl: document.getElementById("insureit-url"),
  workerKey: document.getElementById("worker-key"),
  iibUserId: document.getElementById("iib-user-id"),
  iibPassword: document.getElementById("iib-password"),
  deviceName: document.getElementById("device-name"),
  batchSize: document.getElementById("batch-size"),
  start: document.getElementById("start"),
  pause: document.getElementById("pause"),
  stop: document.getElementById("stop"),
  focus: document.getElementById("focus-iib"),
  reconnect: document.getElementById("reconnect-iib"),
  restart: document.getElementById("restart-iib"),
  diagnostics: document.getElementById("export-diagnostics"),
  status: document.getElementById("runtime-status"),
  controllerState: document.getElementById("controller-state"),
  pageType: document.getElementById("page-type"),
  attempt: document.getElementById("current-attempt"),
  lastError: document.getElementById("last-error"),
  dot: document.getElementById("status-dot"),
  processed: document.getElementById("processed"),
  queued: document.getElementById("queued"),
  currentPan: document.getElementById("current-pan"),
  message: document.getElementById("message")
};

let currentRuntime = {};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RUNTIME_CHANGED") renderRuntime(message.runtime);
});

document.addEventListener("DOMContentLoaded", load);
elements.form.addEventListener("submit", saveSettings);
elements.start.addEventListener("click", startOrCheckNow);
elements.pause.addEventListener("click", togglePause);
elements.stop.addEventListener("click", stop);
elements.focus?.addEventListener("click", () => runControl("FOCUS_IIB", "Opening the managed IIB tab..."));
elements.reconnect?.addEventListener("click", () => runControl("RECONNECT_IIB", "Reconnecting to IIB..."));
elements.restart?.addEventListener("click", () => runControl("RESTART_IIB", "Restarting the IIB tab..."));
elements.diagnostics?.addEventListener("click", () => runControl("EXPORT_DIAGNOSTICS", "Preparing diagnostics..."));

async function load() {
  const response = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" });
  if (!response?.ok) return showMessage(response?.error || "Could not load extension state.", true);
  const config = response.config || {};
  elements.insureitUrl.value = config.insureitUrl || "";
  elements.workerKey.value = config.workerKey || "";
  elements.iibUserId.value = config.iibUserId || "POS.1156BR";
  elements.iibPassword.value = config.iibPassword || "";
  elements.deviceName.value = config.deviceName || "N.M. PAN Checker";
  elements.batchSize.value = config.batchSize || 3;
  renderRuntime(response.runtime || {});
  if (!config.insureitUrl || !config.workerKey || !config.iibPassword) elements.panel.open = true;
}

async function saveSettings(event) {
  event.preventDefault();
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_CONFIG",
    config: {
      insureitUrl: elements.insureitUrl.value,
      workerKey: elements.workerKey.value,
      iibUserId: elements.iibUserId.value,
      iibPassword: elements.iibPassword.value,
      deviceName: elements.deviceName.value,
      batchSize: elements.batchSize.value
    }
  });
  if (!response?.ok) return showMessage(response?.error || "Settings could not be saved.", true);
  showMessage("Settings saved locally in this browser.", false, true);
  elements.panel.open = false;
}

async function startOrCheckNow() {
  const running = Boolean(currentRuntime?.running);
  setBusy(true, running);
  showMessage(running ? "Refreshing the PAN queue and checking IIB..." : "Starting PAN checker...");

  if (running && !currentRuntime?.currentJobId) {
    await chrome.runtime.sendMessage({
      type: "UPDATE_RUNTIME",
      patch: {
        queue: [],
        status: "Refreshing queued PANs from InsureIt...",
        lastError: null
      }
    });
  }

  const response = await chrome.runtime.sendMessage({ type: running ? "CHECK_NOW" : "START" });
  setBusy(false, running);
  if (!response?.ok) {
    elements.panel.open = true;
    return showMessage(response?.error || "Could not check for PAN work.", true);
  }

  const latest = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  if (latest?.ok) renderRuntime(latest);
  const available = Array.isArray(latest?.queue) ? latest.queue.length : 0;

  if (available > 0 && !latest?.currentPan) {
    return showMessage(`${available} fresh PAN job(s) loaded. Processing will begin on the IIB page.`, false, true);
  }
  if (available > 0) {
    return showMessage(`${available} PAN job(s) are ready or currently being processed.`, false, true);
  }
  showMessage(response.jobs ? `${response.jobs} PAN job(s) claimed.` : "No pending PAN was returned by InsureIt.", false, true);
}

async function togglePause() {
  const state = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  const type = state?.paused ? "RESUME" : "PAUSE";
  const response = await chrome.runtime.sendMessage({ type });
  if (!response?.ok) return showMessage(response?.error || "Could not change pause state.", true);
  renderRuntime(response);
}

async function stop() {
  const response = await chrome.runtime.sendMessage({ type: "STOP" });
  if (!response?.ok) return showMessage(response?.error || "Could not stop the checker.", true);
  renderRuntime(response);
  showMessage("PAN checker stopped.");
}

async function runControl(type, progressMessage) {
  showMessage(progressMessage);
  const response = await chrome.runtime.sendMessage({ type });
  if (!response?.ok) return showMessage(response?.error || "The requested action failed.", true);
  if (type === "EXPORT_DIAGNOSTICS") showMessage("Diagnostics export started.", false, true);
  const latest = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  if (latest?.ok) renderRuntime(latest);
}

function renderRuntime(runtime) {
  currentRuntime = runtime || {};
  const running = Boolean(runtime?.running);
  const paused = Boolean(runtime?.paused);
  elements.status.textContent = runtime?.status || "Idle";
  elements.processed.textContent = runtime?.processed || 0;
  elements.queued.textContent = Array.isArray(runtime?.queue) ? runtime.queue.length : 0;
  elements.currentPan.textContent = runtime?.currentPan || "—";
  if (elements.controllerState) elements.controllerState.textContent = runtime?.state || "STOPPED";
  if (elements.pageType) elements.pageType.textContent = runtime?.lastPageType || "unknown";
  if (elements.attempt) elements.attempt.textContent = runtime?.currentAttempt ? `${runtime.currentAttempt} of 3` : "—";
  if (elements.lastError) elements.lastError.textContent = runtime?.lastError || "—";
  elements.dot.style.background = runtime?.lastError ? "#ef4444" : paused ? "#f5b942" : running ? "#35d07f" : "#94a3b8";
  elements.start.disabled = false;
  elements.start.textContent = running ? "Check now" : "Start checking";
  elements.pause.disabled = !running;
  elements.pause.textContent = paused ? "Resume" : "Pause";
  elements.stop.disabled = !running;
}

function setBusy(busy, running) {
  elements.start.disabled = busy;
  elements.start.textContent = busy ? (running ? "Refreshing..." : "Starting...") : (running ? "Check now" : "Start checking");
}

function showMessage(text, error = false, success = false) {
  elements.message.textContent = text || "";
  elements.message.className = `message${error ? " error" : success ? " success" : ""}`;
}