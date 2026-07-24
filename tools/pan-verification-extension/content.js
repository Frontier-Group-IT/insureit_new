const SELECTORS = {
  userId: "#txtUserId",
  password: "#txtPassword",
  captcha: "#captchaTextBox",
  submit: "#btnSubmit",
  posQuery: "#ctl00_ContentPlaceHolder1_dgMenu_ctl02_lnkImage",
  panRadio: "#ctl00_ContentPlaceHolder1_rdPAN",
  panInput: "#ctl00_ContentPlaceHolder1_txtPAN",
  queryButton: "#ctl00_ContentPlaceHolder1_btnQuery",
  positive: "#ctl00_ContentPlaceHolder1_trYesData",
  negative: "#ctl00_ContentPlaceHolder1_trNoData"
};

const LOGIN_URL = "https://pos.iib.gov.in/";
const DELAY_MS = 2500;
let loopStarted = false;
let lastOverlay = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RUNTIME_CHANGED") {
    renderOverlay(message.runtime);
    if (message.runtime.running && !message.runtime.paused) ensureAutomation();
  }
});

init();

async function init() {
  await chrome.runtime.sendMessage({ type: "CONTENT_READY" });
  const response = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" });
  if (!response?.ok) return;
  renderOverlay(response.runtime);
  if (response.runtime.running) ensureAutomation();
}

function ensureAutomation() {
  if (loopStarted) return;
  loopStarted = true;
  automationLoop().finally(() => { loopStarted = false; });
}

async function automationLoop() {
  while (true) {
    const stateResponse = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" });
    if (!stateResponse?.ok) return;
    const { config, runtime } = stateResponse;
    renderOverlay(runtime);
    if (!runtime.running) return;
    if (runtime.paused) {
      await sleep(750);
      continue;
    }

    if (isLoginPage()) {
      prepareLogin(config, runtime);
      await waitForLoginOrStop();
      continue;
    }

    const posLink = visible(document.querySelector(SELECTORS.posQuery));
    if (posLink) {
      await updateStatus("Login successful. Opening PAN query...");
      posLink.click();
      await sleep(1500);
      continue;
    }

    if (visible(document.querySelector(SELECTORS.panInput))) {
      const job = await nextJob();
      if (!job) {
        await updateStatus("No pending PANs. Waiting for new work...");
        await sleep(5000);
        continue;
      }
      await processJob(job);
      await sleep(DELAY_MS);
      continue;
    }

    await updateStatus("Waiting for the IIB POS page...");
    await sleep(1000);
  }
}

function prepareLogin(config, runtime) {
  const user = document.querySelector(SELECTORS.userId);
  const password = document.querySelector(SELECTORS.password);
  const captcha = document.querySelector(SELECTORS.captcha);
  if (!user || !password || !captcha) return;

  setInputValue(user, config.iibUserId || "");
  setInputValue(password, config.iibPassword || "");
  captcha.focus();
  updateStatus("Enter the CAPTCHA and click the website Submit button.");
  renderOverlay({ ...runtime, status: "Waiting for CAPTCHA", currentPan: null });
}

async function waitForLoginOrStop() {
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const state = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
    if (!state?.running) return;
    if (visible(document.querySelector(SELECTORS.posQuery)) || visible(document.querySelector(SELECTORS.panInput))) return;

    const body = (document.body?.innerText || "").toLowerCase();
    const known = ["invalid captcha", "incorrect captcha", "captcha does not match", "invalid password", "invalid user", "session expired"];
    const match = known.find((text) => body.includes(text));
    if (match) {
      await updateStatus(`${titleCase(match)}. Re-enter CAPTCHA and submit again.`);
      const captcha = document.querySelector(SELECTORS.captcha);
      if (captcha) {
        setInputValue(captcha, "");
        captcha.focus();
      }
    }
    await sleep(1000);
  }
  await updateStatus("Login timed out. Reloading the IIB login page...");
  location.href = LOGIN_URL;
}

async function nextJob() {
  let runtime = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  let queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  if (!queue.length) {
    const claim = await chrome.runtime.sendMessage({ type: "CLAIM_MORE" });
    if (!claim?.ok) {
      await updateStatus(claim?.error || "Could not claim PAN jobs.");
      return null;
    }
    runtime = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
    queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  }
  return queue[0] || null;
}

async function processJob(job) {
  const pan = String(job.pan_number || "").trim().toUpperCase();
  const masked = maskPan(pan);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    await finishJob(job, "invalid", "Invalid PAN format", "");
    return;
  }

  await chrome.runtime.sendMessage({
    type: "UPDATE_RUNTIME",
    patch: { currentPan: masked, status: "Submitting PAN query" }
  });

  const radio = document.querySelector(SELECTORS.panRadio);
  const input = document.querySelector(SELECTORS.panInput);
  const button = document.querySelector(SELECTORS.queryButton);
  if (!radio || !input || !button) {
    await finishJob(job, "failed", null, "PAN query controls were not found on the IIB page.");
    return;
  }

  radio.click();
  setInputValue(input, pan);
  clearResultVisibility();
  button.click();

  await updateStatus(`Checking ${masked} in IIB POS...`, masked);
  const result = await waitForResult(25000);
  if (result === "matched") {
    await finishJob(job, "matched", "Matching Record Found In DataBase", "");
  } else if (result === "not_found") {
    await finishJob(job, "not_found", "No Data Found In POS System", "");
  } else if (result === "session") {
    await finishJob(job, "failed", null, "IIB session expired during PAN query.");
    location.href = LOGIN_URL;
  } else {
    await finishJob(job, "failed", null, "No result was returned by the IIB POS portal within the allowed time.");
  }
}

async function waitForResult(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isLoginPage()) return "session";
    const positive = document.querySelector(SELECTORS.positive);
    const negative = document.querySelector(SELECTORS.negative);
    const positiveText = (positive?.innerText || "").trim();
    const negativeText = (negative?.innerText || "").trim();
    if (visible(positive) && /matching record found/i.test(positiveText)) return "matched";
    if (visible(negative) && /no data found/i.test(negativeText)) return "not_found";
    await sleep(300);
  }
  return null;
}

async function finishJob(job, status, resultMessage, error) {
  const response = await chrome.runtime.sendMessage({
    type: "COMPLETE_JOB",
    payload: {
      jobId: job.id,
      status,
      resultMessage,
      error
    }
  });
  if (!response?.ok) {
    await updateStatus(response?.error || "Could not update InsureIt with the PAN result.");
    return;
  }
  const label = status === "not_found" ? "No record found" : status === "matched" ? "Matching record found" : status === "invalid" ? "Invalid PAN" : "Check failed";
  await updateStatus(`${label}. Waiting 2.5 seconds before the next PAN...`, maskPan(job.pan_number));
}

function clearResultVisibility() {
  for (const selector of [SELECTORS.positive, SELECTORS.negative]) {
    const element = document.querySelector(selector);
    if (element) element.dataset.nmPreviousText = (element.innerText || "").trim();
  }
}

async function updateStatus(status, currentPan) {
  const patch = { status };
  if (currentPan !== undefined) patch.currentPan = currentPan;
  await chrome.runtime.sendMessage({ type: "UPDATE_RUNTIME", patch });
}

function isLoginPage() {
  return Boolean(document.querySelector(SELECTORS.userId) && document.querySelector(SELECTORS.password));
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value); else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function visible(element) {
  if (!element) return null;
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length ? element : null;
}

function renderOverlay(runtime) {
  if (!runtime?.running && !document.getElementById("nm-pan-overlay")) return;
  let overlay = document.getElementById("nm-pan-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "nm-pan-overlay";
    overlay.innerHTML = `
      <div class="nm-head"><span class="nm-dot"></span><strong>N.M. PAN Checker</strong><button id="nm-minimise" title="Minimise">−</button></div>
      <div class="nm-body">
        <div class="nm-pan" id="nm-pan">Current PAN: —</div>
        <div class="nm-status" id="nm-status">Preparing...</div>
        <div class="nm-row"><span id="nm-count">0 processed</span><span id="nm-mode">Running</span></div>
        <div class="nm-bar"><span id="nm-progress"></span></div>
      </div>`;
    document.documentElement.appendChild(overlay);
    const style = document.createElement("style");
    style.textContent = `
      #nm-pan-overlay{position:fixed;z-index:2147483647;top:16px;right:16px;width:350px;background:#102447;color:#fff;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.34);font-family:Segoe UI,Arial,sans-serif;overflow:hidden;border:1px solid rgba(255,255,255,.15)}
      #nm-pan-overlay .nm-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.12);font-size:13px}.nm-dot{width:9px;height:9px;border-radius:50%;background:#35d07f;box-shadow:0 0 0 4px rgba(53,208,127,.15)}#nm-minimise{margin-left:auto;border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer}.nm-body{padding:13px}.nm-pan{font-size:15px;font-weight:700}.nm-status{margin-top:5px;color:#c7d7f5;font-size:11px;line-height:1.45;min-height:31px}.nm-row{display:flex;justify-content:space-between;margin-top:9px;color:#b9c9e8;font-size:10px}.nm-bar{height:6px;margin-top:8px;background:rgba(255,255,255,.14);border-radius:999px;overflow:hidden}.nm-bar span{display:block;height:100%;width:0;background:#4d8dff;transition:width .25s ease}#nm-pan-overlay.nm-collapsed .nm-body{display:none}`;
    document.documentElement.appendChild(style);
    document.getElementById("nm-minimise")?.addEventListener("click", () => overlay.classList.toggle("nm-collapsed"));
  }
  lastOverlay = runtime;
  document.getElementById("nm-pan").textContent = `Current PAN: ${runtime.currentPan || "—"}`;
  document.getElementById("nm-status").textContent = runtime.status || "Working...";
  document.getElementById("nm-count").textContent = `${runtime.processed || 0} processed`;
  document.getElementById("nm-mode").textContent = runtime.paused ? "Paused" : runtime.running ? "Running" : "Stopped";
  const total = Math.max(runtime.totalClaimed || 0, runtime.processed || 0);
  const percent = total ? Math.min(100, Math.round(((runtime.processed || 0) / total) * 100)) : 0;
  document.getElementById("nm-progress").style.width = `${percent}%`;
  const dot = overlay.querySelector(".nm-dot");
  if (dot) dot.style.background = runtime.paused ? "#f5b942" : runtime.running ? "#35d07f" : "#94a3b8";
}

function maskPan(value) {
  const pan = String(value || "").trim().toUpperCase();
  return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "—";
}

function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
