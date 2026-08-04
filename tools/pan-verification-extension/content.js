(() => {
  const INSTANCE_KEY = "__NM_IIB_PAN_CHECKER_INSTANCE__";
  const previous = globalThis[INSTANCE_KEY];
  if (previous?.shutdown) { try { previous.shutdown(true); } catch (_) {} }

  const SELECTORS = {
    userId: ["#txtUserId", "input[id$='txtUserId']", "input[name$='txtUserId']"],
    password: ["#txtPassword", "input[type='password']"],
    captcha: ["#captchaTextBox", "input[id*='captcha' i]", "input[name*='captcha' i]"],
    posQuery: ["#ctl00_ContentPlaceHolder1_dgMenu_ctl02_lnkImage", "a[id$='lnkImage']"],
    panRadio: ["#ctl00_ContentPlaceHolder1_rdPAN", "input[type='radio'][id*='PAN' i]", "input[type='radio'][value*='PAN' i]"],
    panInput: ["#ctl00_ContentPlaceHolder1_txtPAN", "input[id$='_txtPAN']", "input[name$='$txtPAN']", "input[placeholder*='PAN' i]"],
    queryButton: ["#ctl00_ContentPlaceHolder1_btnQuery", "input[id$='_btnQuery']", "button[id*='Query' i]", "input[type='submit'][value*='Query' i]"],
    positive: ["#ctl00_ContentPlaceHolder1_trYesData", "tr[id*='YesData' i]"],
    negative: ["#ctl00_ContentPlaceHolder1_trNoData", "tr[id*='NoData' i]"]
  };

  const LOGIN_URL = "https://pos.iib.gov.in/";
  const RESULT_TIMEOUT_MS = 30000;
  const DELAY_MS = 2500;
  const MAX_JOB_ATTEMPTS = 3;
  let alive = true;
  let loopStarted = false;
  let observer = null;
  let observerTimer = null;

  function shutdown(removeOverlay = false) {
    alive = false;
    loopStarted = false;
    if (observer) observer.disconnect();
    observer = null;
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = null;
    if (removeOverlay) document.getElementById("nm-pan-overlay")?.remove();
    if (globalThis[INSTANCE_KEY]?.shutdown === shutdown) delete globalThis[INSTANCE_KEY];
  }
  globalThis[INSTANCE_KEY] = { shutdown };

  function send(message) {
    return new Promise((resolve) => {
      if (!alive || !chrome.runtime?.id) return resolve(null);
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError?.message;
          if (error) { if (/context invalidated|receiving end/i.test(error)) shutdown(); return resolve(null); }
          resolve(response ?? null);
        });
      } catch (_) { shutdown(); resolve(null); }
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!alive) return false;
    handleMessage(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || "Content error" }));
    return true;
  });

  init().catch(() => shutdown());

  async function init() {
    await send({ type: "CONTENT_READY" });
    startObserver();
    const state = await send({ type: "GET_ALL_STATE" });
    if (!state?.ok) return;
    renderOverlay(state.runtime);
    reportState();
    if (state.runtime.running && !state.runtime.paused) ensureAutomation();
  }

  async function handleMessage(message) {
    switch (message?.type) {
      case "PING": return { ok: true, pageType: classifyPage(), url: location.href, title: document.title };
      case "DETECT_PAGE": return { ok: true, pageType: classifyPage(), url: location.href, title: document.title, message: pageMessage(classifyPage()) };
      case "PREPARE_LOGIN": return prepareLogin(message.config || {});
      case "OPEN_POS_QUERY": return openPosQuery();
      case "WAKE_UP": ensureAutomation(); return { ok: true };
      case "RUNTIME_CHANGED": renderOverlay(message.runtime); if (message.runtime.running && !message.runtime.paused) ensureAutomation(); return { ok: true };
      default: return { ok: false, error: "Unknown content message" };
    }
  }

  function startObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(() => {
      if (observerTimer) clearTimeout(observerTimer);
      observerTimer = setTimeout(reportState, 400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden"] });
  }

  function reportState() { if (alive) void send({ type: "PORTAL_STATE", pageType: classifyPage() }); }

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
    if (!document.body?.innerText.trim()) return "blank";
    return "unknown";
  }

  function pageMessage(type) {
    return ({ login: "IIB login page is ready.", captcha_error: "CAPTCHA was not accepted.", invalid_credentials: "IIB credentials were not accepted.", session_expired: "IIB session expired.", access_denied: "IIB access was denied.", maintenance: "IIB portal is under maintenance.", server_error: "IIB portal returned a server error.", pan_query: "PAN query page is ready.", menu: "IIB menu is ready.", blank: "IIB page is blank.", unknown: "The current IIB page was not recognised." })[type] || "Unknown IIB page state.";
  }

  async function prepareLogin(config) {
    const user = find(SELECTORS.userId), password = find(SELECTORS.password), captcha = find(SELECTORS.captcha);
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
    reportState();
    return ready ? { ok: true } : { ok: false, error: "PAN query page did not open." };
  }

  function ensureAutomation() {
    if (loopStarted || !alive) return;
    loopStarted = true;
    automationLoop().finally(() => { loopStarted = false; });
  }

  async function automationLoop() {
    while (alive) {
      const state = await send({ type: "GET_ALL_STATE" });
      if (!state?.ok) return;
      renderOverlay(state.runtime);
      if (!state.runtime.running) return;
      if (state.runtime.paused) { await sleep(750); continue; }

      const pageType = classifyPage();
      if (["login", "captcha_error", "invalid_credentials"].includes(pageType)) { await prepareLogin(state.config); await sleep(1000); continue; }
      if (pageType === "session_expired") { await updateStatus("IIB session expired. Current PAN is preserved. Sign in again."); location.href = LOGIN_URL; return; }
      if (pageType === "menu") { await openPosQuery(); continue; }
      if (pageType !== "pan_query") { await updateStatus(pageMessage(pageType)); await sleep(1500); continue; }

      const job = await nextJob();
      if (!job) { await updateStatus("No pending PANs. Waiting for new work..."); await sleep(5000); continue; }
      await processJob(job);
      await sleep(DELAY_MS);
    }
  }

  async function nextJob() {
    let runtime = await send({ type: "GET_RUNTIME" });
    if (!runtime) return null;
    if (!(runtime.queue || []).length) {
      const claim = await send({ type: "CLAIM_MORE" });
      if (!claim?.ok) { await updateStatus(claim?.error || "Could not claim PAN jobs."); return null; }
      runtime = await send({ type: "GET_RUNTIME" });
    }
    return runtime?.queue?.[0] || null;
  }

  async function processJob(job) {
    const pan = String(job.pan_number || "").replace(/\s/g, "").toUpperCase();
    const masked = maskPan(pan);
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return finishJob(job, "invalid", "Invalid PAN format", "");

    const runtime = await send({ type: "GET_RUNTIME" });
    const resumedResult = recoverPostbackResult(job, pan, runtime);
    if (resumedResult === "matched") return finishJob(job, "matched", "Matching Record Found In DataBase", "");
    if (resumedResult === "not_found") return finishJob(job, "not_found", "No Data Found In POS System", "");
    const startAttempt = runtime?.currentJobId === job.id ? Number(runtime.currentAttempt || 0) + 1 : 1;
    for (let attempt = startAttempt; attempt <= MAX_JOB_ATTEMPTS && alive; attempt += 1) {
      await send({ type: "UPDATE_RUNTIME", patch: { currentPan: masked, currentJobId: job.id, currentAttempt: attempt, state: "SUBMITTING_PAN", status: `Checking ${masked} - attempt ${attempt} of ${MAX_JOB_ATTEMPTS}` } });
      const controls = getControls();
      if (!controls.ok) {
        if (attempt < MAX_JOB_ATTEMPTS) { await updateStatus("PAN query controls were not found. Reloading..."); location.reload(); return; }
        return finishJob(job, "failed", null, "PAN query controls were not found on the IIB page.");
      }

      const baseline = resultSignature();
      controls.radio?.click();
      setInputValue(controls.input, pan);
      const submittedAt = Date.now();
      controls.button.click();
      await updateStatus(`Waiting for a fresh IIB result for ${masked}...`, masked);
      const result = await waitForFreshResult({ baseline, pan, submittedAt, timeoutMs: RESULT_TIMEOUT_MS });

      if (result === "matched") return finishJob(job, "matched", "Matching Record Found In DataBase", "");
      if (result === "not_found") return finishJob(job, "not_found", "No Data Found In POS System", "");
      if (result === "session") { await send({ type: "UPDATE_RUNTIME", patch: { state: "RECOVERING_SESSION", status: "IIB session expired. Sign in again; the same PAN will retry.", currentPan: masked, currentJobId: job.id, currentAttempt: attempt } }); location.href = LOGIN_URL; return; }
      if (attempt < MAX_JOB_ATTEMPTS) { await updateStatus(`No fresh result received. Retrying ${masked}...`, masked); await sleep(1200); continue; }
      return finishJob(job, "failed", null, "No fresh result was returned by the IIB POS portal after three attempts.");
    }
  }

  function recoverPostbackResult(job, pan, runtime) {
    if (runtime?.currentJobId !== job.id || Number(runtime.currentAttempt || 0) < 1) return null;
    const currentPan = String(find(SELECTORS.panInput)?.value || "").replace(/\s/g, "").toUpperCase();
    if (currentPan !== pan) return null;
    const current = resultSignature();
    if (current.matched) return "matched";
    if (current.notFound) return "not_found";
    return null;
  }

  async function waitForFreshResult({ baseline, pan, submittedAt, timeoutMs }) {
    let transitionSeen = false;
    while (alive && Date.now() - submittedAt < timeoutMs) {
      const pageType = classifyPage();
      if (["login", "session_expired"].includes(pageType)) return "session";
      const current = resultSignature();
      const currentPan = String(find(SELECTORS.panInput)?.value || "").replace(/\s/g, "").toUpperCase();
      if (current.signature !== baseline.signature || current.visible !== baseline.visible) transitionSeen = true;
      if (transitionSeen && currentPan === pan) {
        if (current.matched) return "matched";
        if (current.notFound) return "not_found";
      }
      await sleep(300);
    }
    return null;
  }

  function resultSignature() {
    const positive = find(SELECTORS.positive), negative = find(SELECTORS.negative);
    const positiveText = (positive?.innerText || "").replace(/\s+/g, " ").trim();
    const negativeText = (negative?.innerText || "").replace(/\s+/g, " ").trim();
    const positiveVisible = Boolean(visible(positive)), negativeVisible = Boolean(visible(negative));
    return {
      signature: `${positiveVisible}:${positiveText}|${negativeVisible}:${negativeText}`,
      visible: positiveVisible || negativeVisible,
      matched: positiveVisible && /matching record found/i.test(positiveText),
      notFound: negativeVisible && /no data found/i.test(negativeText)
    };
  }

  async function finishJob(job, status, resultMessage, error) {
    const response = await send({ type: "COMPLETE_JOB", payload: { jobId: job.id, status, resultMessage, error } });
    if (!response?.ok) return updateStatus(response?.error || "Could not update InsureIt with the PAN result.");
    if (response.discarded || response.applied === false) return updateStatus(`InsureIt discarded this result: ${response.reason || "state changed"}.`);
    const label = status === "not_found" ? "No record found" : status === "matched" ? "Matching record found" : status === "invalid" ? "Invalid PAN" : "Check failed";
    return updateStatus(`${label}. Waiting 2.5 seconds before the next PAN...`, maskPan(job.pan_number));
  }

  function getControls() {
    const radio = find(SELECTORS.panRadio), input = visible(find(SELECTORS.panInput)), button = visible(find(SELECTORS.queryButton));
    return { ok: Boolean(input && button), radio, input, button };
  }

  function find(selectors) { for (const selector of selectors) { try { const el = document.querySelector(selector); if (el) return el; } catch (_) {} } return null; }
  function setInputValue(input, value) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; if (setter) setter.call(input, value); else input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }
  function visible(element) { if (!element) return null; const style = getComputedStyle(element); return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length ? element : null; }
  function normalizedBody() { return (document.body?.innerText || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function includesAny(text, values) { return values.some((value) => text.includes(value)); }
  function waitFor(predicate, timeoutMs, intervalMs) { return new Promise((resolve) => { const started = Date.now(); const timer = setInterval(() => { let matched = false; try { matched = Boolean(predicate()); } catch (_) {} if (!alive || matched || Date.now() - started >= timeoutMs) { clearInterval(timer); resolve(matched); } }, intervalMs); }); }
  async function updateStatus(status, currentPan) { const patch = { status }; if (currentPan !== undefined) patch.currentPan = currentPan; await send({ type: "UPDATE_RUNTIME", patch }); }

  function renderOverlay(runtime) {
    if (!runtime?.running && !document.getElementById("nm-pan-overlay")) return;
    let overlay = document.getElementById("nm-pan-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "nm-pan-overlay";
      overlay.innerHTML = `<div class="nm-head"><span class="nm-dot"></span><strong>N.M. PAN Checker</strong><button id="nm-focus">↗</button><button id="nm-reconnect">↻</button><button id="nm-minimise">−</button></div><div class="nm-body"><div class="nm-pan" id="nm-pan">Current PAN: —</div><div class="nm-status" id="nm-status">Preparing...</div><div class="nm-row"><span id="nm-count">0 processed</span><span id="nm-mode">Running</span></div><div class="nm-bar"><span id="nm-progress"></span></div></div>`;
      document.documentElement.appendChild(overlay);
      const style = document.createElement("style");
      style.textContent = `#nm-pan-overlay{position:fixed;z-index:2147483647;top:16px;right:16px;width:350px;background:#102447;color:#fff;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.34);font-family:Segoe UI,Arial,sans-serif;overflow:hidden;border:1px solid rgba(255,255,255,.15)}#nm-pan-overlay .nm-head{display:flex;align-items:center;gap:8px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.12);font-size:13px}.nm-dot{width:9px;height:9px;border-radius:50%;background:#35d07f}.nm-head button{border:0;background:transparent;color:#fff;font-size:16px;cursor:pointer}#nm-focus{margin-left:auto}.nm-body{padding:13px}.nm-pan{font-size:15px;font-weight:700}.nm-status{margin-top:5px;color:#c7d7f5;font-size:11px;line-height:1.45;min-height:31px}.nm-row{display:flex;justify-content:space-between;margin-top:9px;color:#b9c9e8;font-size:10px}.nm-bar{height:6px;margin-top:8px;background:rgba(255,255,255,.14);border-radius:999px;overflow:hidden}.nm-bar span{display:block;height:100%;width:0;background:#4d8dff}#nm-pan-overlay.nm-collapsed .nm-body{display:none}`;
      document.documentElement.appendChild(style);
      document.getElementById("nm-minimise")?.addEventListener("click", () => overlay.classList.toggle("nm-collapsed"));
      document.getElementById("nm-focus")?.addEventListener("click", () => void send({ type: "FOCUS_IIB" }));
      document.getElementById("nm-reconnect")?.addEventListener("click", () => void send({ type: "RECONNECT_IIB" }));
    }
    document.getElementById("nm-pan").textContent = `Current PAN: ${runtime.currentPan || "—"}`;
    document.getElementById("nm-status").textContent = runtime.status || "Working...";
    document.getElementById("nm-count").textContent = `${runtime.processed || 0} processed`;
    document.getElementById("nm-mode").textContent = runtime.paused ? "Paused" : runtime.state || "Running";
    const total = Math.max(runtime.totalClaimed || 0, runtime.processed || 0);
    document.getElementById("nm-progress").style.width = `${total ? Math.min(100, Math.round(((runtime.processed || 0) / total) * 100)) : 0}%`;
    const dot = overlay.querySelector(".nm-dot");
    if (dot) dot.style.background = runtime.lastError ? "#ef4444" : runtime.paused ? "#f5b942" : runtime.running ? "#35d07f" : "#94a3b8";
  }

  function maskPan(value) { const pan = String(value || "").trim().toUpperCase(); return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "—"; }
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
})();
