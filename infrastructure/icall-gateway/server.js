require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const RELAY_SECRET = process.env.RELAY_SECRET;
const ICALL_BASE_URL = process.env.ICALL_UAT_BASE_URL;
const ICALL_TOKEN = process.env.ICALL_UAT_AUTH_TOKEN;

if (!RELAY_SECRET || !ICALL_BASE_URL || !ICALL_TOKEN) {
  console.error("Required environment variables are missing.");
  process.exit(1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }));

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function requireRelayAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const expected = `Bearer ${RELAY_SECRET}`;
  if (!safeEqual(authorization, expected)) {
    return res.status(401).json({ statusCode: 401, status: "failed", message: "Unauthorized" });
  }
  next();
}

function validPan(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(value || "").trim().toUpperCase());
}

function decodeIcallResponse(response) {
  if (!response || typeof response !== "object") return response;
  if (typeof response.payload !== "string" || !response.payload.trim()) return response;
  try {
    return JSON.parse(Buffer.from(response.payload.trim(), "base64").toString("utf8"));
  } catch {
    return response;
  }
}

async function callIcall(endpoint, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${ICALL_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await response.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch {
      throw new Error(`iCall returned invalid JSON with HTTP ${response.status}`);
    }
    return { httpStatus: response.status, data: decodeIcallResponse(json) };
  } finally {
    clearTimeout(timeout);
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "insureit-icall-gateway", environment: "uat" });
});

app.post("/uat/icall/register", requireRelayAuth, async (req, res) => {
  const { pan, pospFirstName, pospLastName = "", dob = "", email_id, mobile, internalPOSCode = "" } = req.body || {};
  const normalizedPan = String(pan || "").trim().toUpperCase();
  const normalizedMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (!validPan(normalizedPan) || !String(pospFirstName || "").trim() || !/^[6-9][0-9]{9}$/.test(normalizedMobile) || !String(email_id || "").includes("@")) {
    return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid registration data" });
  }

  const payloadData = {
    authToken: ICALL_TOKEN,
    pan: normalizedPan,
    pospFirstName: String(pospFirstName).trim(),
    pospLastName: String(pospLastName).trim(),
    dob: String(dob).trim(),
    email_id: String(email_id).trim().toLowerCase(),
    mobile: normalizedMobile,
    internalPOSCode: String(internalPOSCode).trim(),
  };

  try {
    const payload = Buffer.from(JSON.stringify(payloadData), "utf8").toString("base64");
    const result = await callIcall("/RegisterPOSPTraining", { payload });
    return res.status(result.httpStatus).json(result.data);
  } catch (error) {
    console.error("Registration request failed:", error.message);
    return res.status(502).json({ statusCode: 502, status: "failed", message: "iCall registration service unavailable" });
  }
});

app.post("/uat/icall/status", requireRelayAuth, async (req, res) => {
  const loginId = String(req.body?.loginId || "").trim().toUpperCase();
  if (!validPan(loginId)) return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid login ID" });
  try {
    const result = await callIcall("/POSPTrainingStatus", { authToken: ICALL_TOKEN, loginId });
    return res.status(result.httpStatus).json(result.data);
  } catch (error) {
    console.error("Status request failed:", error.message);
    return res.status(502).json({ statusCode: 502, status: "failed", message: "iCall status service unavailable" });
  }
});

app.post("/uat/icall/sso", requireRelayAuth, async (req, res) => {
  const loginId = String(req.body?.loginId || "").trim().toUpperCase();
  if (!validPan(loginId)) return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid login ID" });
  try {
    const result = await callIcall("/AuthenticateUser", { authToken: ICALL_TOKEN, loginId });
    const redirectUrl = result.data?.data?.redirectUrl;
    if (redirectUrl) {
      const parsedUrl = new URL(redirectUrl);
      if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.icallinsurance.com") {
        return res.status(502).json({ statusCode: 502, status: "failed", message: "Invalid SSO redirect received" });
      }
    }
    return res.status(result.httpStatus).json(result.data);
  } catch (error) {
    console.error("SSO request failed:", error.message);
    return res.status(502).json({ statusCode: 502, status: "failed", message: "iCall SSO service unavailable" });
  }
});

app.post("/uat/icall/tcc", requireRelayAuth, async (req, res) => {
  const fromDate = String(req.body?.tcc_from_date || "").trim();
  const toDate = String(req.body?.tcc_to_date || "").trim();
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  if (!datePattern.test(fromDate) || !datePattern.test(toDate)) {
    return res.status(400).json({ statusCode: 400, status: "failed", message: "Dates must use DD-MM-YYYY" });
  }
  try {
    const result = await callIcall("/POSPTCC", { authToken: ICALL_TOKEN, tcc_from_date: fromDate, tcc_to_date: toDate });
    return res.status(result.httpStatus).json(result.data);
  } catch (error) {
    console.error("TCC request failed:", error.message);
    return res.status(502).json({ statusCode: 502, status: "failed", message: "iCall certificate service unavailable" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ statusCode: 404, status: "failed", message: "Route not found" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`InsureIt gateway listening on 127.0.0.1:${PORT}`);
});
