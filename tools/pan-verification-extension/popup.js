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
  status: document.getElementById("runtime-status"),
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

async function load() {
  const response = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" });
  if (!response?.ok) return showMessage(response?.error || "Could not load extension state.", true);
  const config = response.config || {};
  elements.insureitUrl.value = config.insureitUrl || "";
  elements.workerKey.value = config.workerKey || "";
  elements.iibUserId.value = config.iibUserId || "POS.1156BR";
  elements.iibPassword.value = config.iibPassword || "";
  elements.deviceName.value = config.deviceName || "N.M. PAN Checker";
  elements.batchSize.value = config.batchSize || 20;
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
  showMessage(running ? "Checking InsureIt for new PANs..." : "Starting PAN checker...");
  const response = await chrome.runtime.sendMessage({ type: running ? "CHECK_NOW" : "START" });
  setBusy(false, running);
  if (!response?.ok) {
    elements.panel.open = true;
    return showMessage(response?.error || "Could not check for PAN work.", true);
  }
  showMessage(response.jobs ? `${response.jobs} PAN job(s) claimed.` : "No new PANs right now.", false, true);
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

function renderRuntime(runtime) {
  currentRuntime = runtime || {};
  const running = Boolean(runtime?.running);
  const paused = Boolean(runtime?.paused);
  elements.status.textContent = runtime?.status || "Idle";
  elements.processed.textContent = runtime?.processed || 0;
  elements.queued.textContent = Array.isArray(runtime?.queue) ? runtime.queue.length : 0;
  elements.currentPan.textContent = runtime?.currentPan || "—";
  elements.dot.style.background = paused ? "#f5b942" : running ? "#35d07f" : "#94a3b8";
  elements.start.disabled = false;
  elements.start.textContent = running ? "Check now" : "Start checking";
  elements.pause.disabled = !running;
  elements.pause.textContent = paused ? "Resume" : "Pause";
  elements.stop.disabled = !running;
}

function setBusy(busy, running) {
  elements.start.disabled = busy;
  elements.start.textContent = busy ? (running ? "Checking..." : "Starting...") : (running ? "Check now" : "Start checking");
}

function showMessage(text, error = false, success = false) {
  elements.message.textContent = text || "";
  elements.message.className = `message${error ? " error" : success ? " success" : ""}`;
}
