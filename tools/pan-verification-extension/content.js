const SELECTORS = {
  userId: ["#txtUserId", "input[id$='txtUserId']", "input[name$='txtUserId']"],
  password: ["#txtPassword", "input[type='password']"],
  captcha: ["#captchaTextBox", "input[id*='captcha' i]", "input[name*='captcha' i]"],
  submit: ["#btnSubmit", "input[type='submit']", "button[type='submit']"],
  posQuery: ["#ctl00_ContentPlaceHolder1_dgMenu_ctl02_lnkImage", "a[id$='lnkImage']"],
  panRadio: ["#ctl00_ContentPlaceHolder1_rdPAN", "input[type='radio'][id*='PAN' i]", "input[type='radio'][value*='PAN' i]"],
  panInput: ["#ctl00_ContentPlaceHolder1_txtPAN", "input[id$='_txtPAN']", "input[name$='$txtPAN']", "input[placeholder*='PAN' i]"],
  queryButton: ["#ctl00_ContentPlaceHolder1_btnQuery", "input[id$='_btnQuery']", "button[id*='Query' i]", "input[type='submit'][value*='Query' i]"],
  positive: ["#ctl00_ContentPlaceHolder1_trYesData", "tr[id*='YesData' i]"],
  negative: ["#ctl00_ContentPlaceHolder1_trNoData", "tr[id*='NoData' i]"]
};

const LOGIN_URL = "https://pos.iib.gov.in/";
const DELAY_MS = 2500;
const RESULT_TIMEOUT_MS = 30000;
const MAX_JOB_ATTEMPTS = 3;
let loopStarted = false;
let observer = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || "Content-script error" }));
  return true;
});

init();

async function init() {
  await chrome.runtime.sendMessage({ type: "CONTENT_READY" }).catch(() => {});
  startObserver();
  const response = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" }).catch(() => null);
  if (!response?.ok) return;
  renderOverlay(response.runtime);
  await reportPortalState();
  if (response.runtime.running && !response.runtime.paused) ensureAutomation();
}

async function handleMessage(message) {
  switch (message?.type) {
    case "PING": return { ok: true, pageType: classifyPage(), url: location.href, title: document.title };
    case "DETECT_PAGE": return detectPageResponse();
    case "PREPARE_LOGIN": return prepareLogin(message.config || {});
    case "OPEN_POS_QUERY": return openPosQuery();
    case "WAKE_UP": ensureAutomation(); return { ok: true };
    case "RUNTIME_CHANGED": renderOverlay(message.runtime); if (message.runtime.running && !message.runtime.paused) ensureAutomation(); return { ok: true };
    default: return { ok: false, error: "Unknown content message" };
  }
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => { reportPortalState(); });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
}

async function reportPortalState() {
  const pageType = classifyPage();
  await chrome.runtime.sendMessage({ type: "PORTAL_STATE", pageType }).catch(() => {});
}

function detectPageResponse() {
  const pageType = classifyPage();
  const controls = {
    userId: Boolean(find(SELECTORS.userId)),
    password: Boolean(find(SELECTORS.password)),
    captcha: Boolean(find(SELECTORS.captcha)),
    posQuery: Boolean(find(SELECTORS.posQuery)),
    panInput: Boolean(find(SELECTORS.panInput)),
    queryButton: Boolean(find(SELECTORS.queryButton))
  };
  return { ok: true, pageType, controls, url: location.href, title: document.title, message: pageMessage(pageType) };
}

function classifyPage() {
  const body = normalizedBody();
  if (find(SELECTORS.userId) && find(SELECTORS.password)) {
    if (includesAny(body, ["invalid captcha", "incorrect captcha", "captcha does not match"])) return "captcha_error";
    if (includesAny(body, ["invalid password", "invalid user", "invalid login", "authentication failed"])) return "invalid_credentials";
    return "login";
  }
  if (includesAny(body, ["session expired", "session has expired", "please login again"])) return "session_expired";
  if (includesAny(body, ["access denied", "unauthorized", "not authorized"])) return "access_denied";
  if (includesAny(body, ["under maintenance", "maintenance activity", "temporarily unavailable"])) return "maintenance";
  if (includesAny(body, ["server error", "runtime error", "service unavailable", "internal server error"])) return "server_error";
  if (visible(find(SELECTORS.panInput)) && visible(find(SELECTORS.queryButton))) return "pan_query";
  if (visible(find(SELECTORS.posQuery))) return "menu";
  if (!document.body || !document.body.innerText.trim()) return "blank";
  return "unknown";
}

function pageMessage(pageType) {
  const messages = {
    login: "IIB login page is ready.",
    captcha_error: "CAPTCHA was not accepted.",
    invalid_credentials: "IIB credentials were not accepted.",
    session_expired: "IIB session expired.",
    access_denied: "IIB access was denied.",
    maintenance: "IIB portal is under maintenance.",
    server_error: "IIB portal returned a server error.",
    pan_query: "PAN query page is ready.",
    menu: "IIB menu page is ready.",
    blank: "IIB page is blank.",
    unknown: "The current IIB page was not recognised."
  };
  return messages[pageType] || "Unknown IIB page state.";
}

async function prepareLogin(config) {
  const user = find(SELECTORS.userId);
  const password = find(SELECTORS.password);
  const captcha = find(SELECTORS.captcha);
  if (!user || !password || !captcha) return { ok: false, error: "Login controls were not found." };
  setInputValue(user, config.iibUserId || "");
  setInputValue(password, config.iibPassword || "");
  captcha.focus();
  await updateStatus("Enter CAPTCHA and click Submit on the IIB page.");
  return { ok: true };
}

async function openPosQuery() {
  const link = visible(find(SELECTORS.posQuery));
  if (!link) return { ok: false, error: "POS Query option was not found." };
  link.click();
  const ready = await waitFor(() => visible(find(SELECTORS.panInput)) && visible(find(SELECTORS.queryButton)), 20000, 250);
  if (!ready) return { ok: false, error: "PAN query page did not open." };
  await reportPortalState();
  return { ok: true };
}

function ensureAutomation() {
  if (loopStarted) return;
  loopStarted = true;
  automationLoop().finally(() => { loopStarted = false; });
}

async function automationLoop() {
  while (true) {
    const stateResponse = await chrome.runtime.sendMessage({ type: "GET_ALL_STATE" }).catch(() => null);
    if (!stateResponse?.ok) return;
    const { config, runtime } = stateResponse;
    renderOverlay(runtime);
    if (!runtime.running) return;
    if (runtime.paused) { await sleep(750); continue; }

    const pageType = classifyPage();
    if (["login", "captcha_error", "invalid_credentials"].includes(pageType)) {
      await prepareLogin(config);
      await sleep(1000);
      continue;
    }
    if (pageType === "session_expired") {
      await updateStatus("IIB session expired. Current PAN is preserved. Sign in again.");
      location.href = LOGIN_URL;
      return;
    }
    if (pageType === "menu") {
      const opened = await openPosQuery();
      if (!opened.ok) { await updateStatus(opened.error); await sleep(2000); }
      continue;
    }
    if (pageType === "pan_query") {
      const job = await nextJob();
      if (!job) { await updateStatus("No pending PANs. Waiting for new work..."); await sleep(5000); continue; }
      await processJob(job);
      await sleep(DELAY_MS);
      continue;
    }

    await updateStatus(pageMessage(pageType));
    await sleep(1500);
  }
}

async function nextJob() {
  let runtime = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  let queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  if (!queue.length) {
    const claim = await chrome.runtime.sendMessage({ type: "CLAIM_MORE" });
    if (!claim?.ok) { await updateStatus(claim?.error || "Could not claim PAN jobs."); return null; }
    runtime = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
    queue = Array.isArray(runtime.queue) ? runtime.queue : [];
  }
  return queue[0] || null;
}

async function processJob(job) {
  const pan = String(job.pan_number || "").replace(/\s/g, "").toUpperCase();
  const masked = maskPan(pan);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { await finishJob(job, "invalid", "Invalid PAN format", ""); return; }

  let runtime = await chrome.runtime.sendMessage({ type: "GET_RUNTIME" });
  const previousAttempt = runtime.currentJobId === job.id ? Number(runtime.currentAttempt || 0) : 0;
  for (let attempt = previousAttempt + 1; attempt <= MAX_JOB_ATTEMPTS; attempt += 1) {
    await chrome.runtime.sendMessage({ type: "UPDATE_RUNTIME", patch: { currentPan: masked, currentJobId: job.id, currentAttempt: attempt, state: "SUBMITTING_PAN", status: `Checking ${masked} - attempt ${attempt} of ${MAX_JOB_ATTEMPTS}` } });

    const controls = getQueryControls();
    if (!controls.ok) {
      await updateStatus("PAN query controls were not found. Reconnecting...");
      if (attempt < MAX_JOB_ATTEMPTS) { location.reload(); return; }
      await finishJob(job, "failed", null, "PAN query controls were not found on the IIB page.");
      return;
    }

    controls.radio?.click();
    setInputValue(controls.input, pan);
    clearResultVisibility();
    controls.button.click();

    await updateStatus(`Waiting for the IIB result for ${masked}...`, masked);
    const result = await waitForResult(RESULT_TIMEOUT_MS);
    if (result === "matched") { await finishJob(job, "matched", "Matching Record Found In DataBase", ""); return; }
    if (result === "not_found") { await finishJob(job, "not_found", "No Data Found In POS System", ""); return; }
    if (result === "session") {
      await chrome.runtime.sendMessage({ type: "UPDATE_RUNTIME", patch: { state: "RECOVERING_SESSION", status: "IIB session expired. Sign in again; the same PAN will retry.", currentPan: masked, currentJobId: job.id, currentAttempt: attempt } });
      location.href = LOGIN_URL;
      return;
    }

    if (attempt < MAX_JOB_ATTEMPTS) {
      await updateStatus(`No result received. Retrying ${masked}...`, masked);
      await sleep(1200);
      continue;
    }
    await finishJob(job, "failed", null, "No result was returned by the IIB POS portal after three attempts.");
    return;
  }
}

function getQueryControls() {
  const radio = find(SELECTORS.panRadio);
  const input = visible(find(SELECTORS.panInput));
  const button = visible(find(SELECTORS.queryButton));
  return { ok: Boolean(input && button), radio, input, button };
}

async function waitForResult(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const pageType = classifyPage();
    if (["login", "session_expired"].includes(pageType)) return "session";
    const positive = find(SELECTORS.positive);
    const negative = find(SELECTORS.negative);
    const positiveText = (positive?.innerText || "").trim();
    const negativeText = (negative?.innerText || "").trim();
    const body = normalizedBody();
    if ((visible(positive) && /matching record found/i.test(positiveText)) || body.includes("matching record found in database")) return "matched";
    if ((visible(negative) && /no data found/i.test(negativeText)) || body.includes("no data found in pos system")) return "not_found";
    await sleep(300);
  }
  return null;
}

async function finishJob(job, status, resultMessage, error) {
  const response = await chrome.runtime.sendMessage({ type: "COMPLETE_JOB", payload: { jobId: job.id, status, resultMessage, error } });
  if (!response?.ok) { await updateStatus(response?.error || "Could not update InsureIt with the PAN result."); return; }
  const label = status === "not_found" ? "No record found" : status === "matched" ? "Matching record found" : status === "invalid" ? "Invalid PAN" : "Check failed";
  await updateStatus(`${label}. Waiting 2.5 seconds before the next PAN...`, maskPan(job.pan_number));
}

function clearResultVisibility() {
  for (const selectors of [SELECTORS.positive, SELECTORS.negative]) {
    const element = find(selectors);
    if (element) element.dataset.nmPreviousText = (element.innerText || "").trim();
  }
}

async function updateStatus(status, currentPan) {
  const patch = { status };
  if (currentPan !== undefined) patch.currentPan = currentPan;
  await chrome.runtime.sendMessage({ type: "UPDATE_RUNTIME", patch }).catch(() => {});
}

function find(selectors) {
  for (const selector of selectors) {
    try { const element = document.querySelector(selector); if (element) return element; } catch (_) {}
  }
  return null;
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

function normalizedBody() { return (document.body?.innerText || "").replace(/\s+/g, " ").trim().toLowerCase(); }
function includesAny(text, values) { return values.some((value) => text.includes(value)); }
function waitFor(predicate, timeoutMs, intervalMs) { return new Promise((resolve) => { const started = Date.now(); const timer = setInterval(() => { let matched = false; try { matched = Boolean(predicate()); } catch (_) {} if (matched || Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(matched); } }, intervalMs); }); }

function renderOverlay(runtime) {
  if (!runtime?.running && !document.getElementById("nm-pan-overlay")) return;
  let overlay = document.getElementById("nm-pan-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "nm-pan-overlay";
    overlay.innerHTML = `<div class="nm-head"><span class="nm-dot"></span><strong>N.M. PAN Checker</strong><button id="nm-focus" title="Focus IIB tab">↗</button><button id="nm-reconnect" title="Reconnect">↻</button><button id="nm-minimise" title="Minimise">−</button></div><div class="nm-body"><div class="nm-pan" id="nm-pan">Current PAN: —</div><div class="nm-status" id="nm-status">Preparing...</div><div class="nm-row"><span id="nm-count">0 processed</span><span id="nm-mode">Running</span></div><div class="nm-bar"><span id="nm-progress"></span></div></div>`;
    document.documentElement.appendChild(overlay);
    const style = document.createElement("style");
    style.textContent = `#nm-pan-overlay{position:fixed;z-index:2147483647;top:16px;right:16px;width:350px;background:#102447;color:#fff;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.34);font-family:Segoe UI,Arial,sans-serif;overflow:hidden;border:1px solid rgba(255,255,255,.15)}#nm-pan-overlay .nm-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.12);font-size:13px}.nm-dot{width:9px;height:9px;border-radius:50%;background:#35d07f;box-shadow:0 0 0 4px rgba(53,208,127,.15)}#nm-pan-overlay .nm-head button{border:0;background:transparent;color:#fff;font-size:16px;cursor:pointer;padding:0 2px}#nm-focus{margin-left:auto}.nm-body{padding:13px}.nm-pan{font-size:15px;font-weight:700}.nm-status{margin-top:5px;color:#c7d7f5;font-size:11px;line-height:1.45;min-height:31px}.nm-row{display:flex;justify-content:space-between;margin-top:9px;color:#b9c9e8;font-size:10px}.nm-bar{height:6px;margin-top:8px;background:rgba(255,255,255,.14);border-radius:999px;overflow:hidden}.nm-bar span{display:block;height:100%;width:0;background:#4d8dff;transition:width .25s ease}#nm-pan-overlay.nm-collapsed .nm-body{display:none}`;
    document.documentElement.appendChild(style);
    document.getElementById("nm-minimise")?.addEventListener("click", () => overlay.classList.toggle("nm-collapsed"));
    document.getElementById("nm-focus")?.addEventListener("click", () => chrome.runtime.sendMessage({ type: "FOCUS_IIB" }));
    document.getElementById("nm-reconnect")?.addEventListener("click", () => chrome.runtime.sendMessage({ type: "RECONNECT_IIB" }));
  }
  document.getElementById("nm-pan").textContent = `Current PAN: ${runtime.currentPan || "—"}`;
  document.getElementById("nm-status").textContent = runtime.status || "Working...";
  document.getElementById("nm-count").textContent = `${runtime.processed || 0} processed`;
  document.getElementById("nm-mode").textContent = runtime.paused ? "Paused" : runtime.state || (runtime.running ? "Running" : "Stopped");
  const total = Math.max(runtime.totalClaimed || 0, runtime.processed || 0);
  const percent = total ? Math.min(100, Math.round(((runtime.processed || 0) / total) * 100)) : 0;
  document.getElementById("nm-progress").style.width = `${percent}%`;
  const dot = overlay.querySelector(".nm-dot");
  if (dot) dot.style.background = runtime.lastError ? "#ef4444" : runtime.paused ? "#f5b942" : runtime.running ? "#35d07f" : "#94a3b8";
}

function maskPan(value) { const pan = String(value || "").trim().toUpperCase(); return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "—"; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
