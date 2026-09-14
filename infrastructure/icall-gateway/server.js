require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const RELAY_SECRET = process.env.RELAY_SECRET;
const ICALL_UAT_BASE_URL = String(process.env.ICALL_UAT_BASE_URL || "").replace(/\/$/, "");
const ICALL_UAT_TOKEN = String(process.env.ICALL_UAT_AUTH_TOKEN || "").trim();
const ICALL_PROD_BASE_URL = String(process.env.ICALL_PROD_BASE_URL || "https://www.icallinsurance.com/API/SANKALP/PROD").replace(/\/$/, "");
const ICALL_PROD_TOKEN = String(process.env.ICALL_PROD_AUTH_TOKEN || "").trim();
const AUTHBRIDGE_BASE_URL = String(process.env.AUTHBRIDGE_BASE_URL || "https://www.truthscreen.com").replace(/\/$/, "");
const AUTHBRIDGE_USERNAME = String(process.env.AUTHBRIDGE_USERNAME || "").trim();
const GATEWAY_ENVIRONMENT = String(process.env.GATEWAY_ENVIRONMENT || "mixed").trim();

if (!RELAY_SECRET) {
  console.error("RELAY_SECRET is missing.");
  process.exit(1);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
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

function normalizeRegistrationNumber(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function validRegistrationNumber(value) {
  const standard = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(value);
  const bharatSeries = /^\d{2}BH\d{4}[A-HJ-NP-Z]{1,2}$/.test(value);
  return standard || bharatSeries;
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

async function postJson(url, { headers = {}, body, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await response.text();
    let data = rawText;
    if (rawText.trim()) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = rawText.trim();
      }
    }
    return { httpStatus: response.status, ok: response.ok, data };
  } finally {
    clearTimeout(timeout);
  }
}

function icallConfig(environment) {
  if (environment === "prod") {
    return { baseUrl: ICALL_PROD_BASE_URL, token: ICALL_PROD_TOKEN, label: "production" };
  }
  return { baseUrl: ICALL_UAT_BASE_URL, token: ICALL_UAT_TOKEN, label: "uat" };
}

async function callIcall(environment, endpoint, body) {
  const config = icallConfig(environment);
  if (!config.baseUrl || !config.token) {
    const error = new Error(`iCall ${config.label} environment is not configured`);
    error.code = "ICALL_NOT_CONFIGURED";
    throw error;
  }
  const result = await postJson(`${config.baseUrl}${endpoint}`, { body, timeoutMs: 30000 });
  if (typeof result.data === "string") {
    throw new Error(`iCall returned invalid JSON with HTTP ${result.httpStatus}`);
  }
  return { httpStatus: result.httpStatus, data: decodeIcallResponse(result.data) };
}

function extractOpaqueValue(value, candidateKeys) {
  if (typeof value === "string" && value.trim()) return value.trim().replace(/^"|"$/g, "");
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  for (const key of candidateKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  for (const nestedKey of ["data", "result", "response"]) {
    const nested = value[nestedKey];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = extractOpaqueValue(nested, candidateKeys);
      if (found) return found;
    }
  }

  return null;
}

function parsePossiblyJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

async function callAuthbridge(path, body) {
  return postJson(`${AUTHBRIDGE_BASE_URL}${path}`, {
    headers: { username: AUTHBRIDGE_USERNAME },
    body,
    timeoutMs: 25000,
  });
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "insureit-integration-gateway",
    environment: GATEWAY_ENVIRONMENT,
    integrations: {
      icall_uat: ICALL_UAT_BASE_URL && ICALL_UAT_TOKEN ? "configured" : "not_configured",
      icall_production: ICALL_PROD_BASE_URL && ICALL_PROD_TOKEN ? "configured" : "not_configured",
      authbridge: AUTHBRIDGE_USERNAME ? "configured" : "not_configured",
    },
  });
});

function registerIcallRoutes(environment) {
  const prefix = `/${environment}/icall`;

  app.post(`${prefix}/register`, requireRelayAuth, async (req, res) => {
    const { pan, pospFirstName, pospLastName = "", dob = "", email_id, mobile, internalPOSCode = "" } = req.body || {};
    const normalizedPan = String(pan || "").trim().toUpperCase();
    const normalizedMobile = String(mobile || "").replace(/\D/g, "").slice(-10);
    if (!validPan(normalizedPan) || !String(pospFirstName || "").trim() || !/^[6-9][0-9]{9}$/.test(normalizedMobile) || !String(email_id || "").includes("@")) {
      return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid registration data" });
    }

    const config = icallConfig(environment);
    if (!config.baseUrl || !config.token) {
      return res.status(503).json({ statusCode: 503, status: "failed", message: `iCall ${config.label} environment is not configured` });
    }

    const payloadData = {
      authToken: config.token,
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
      const result = await callIcall(environment, "/RegisterPOSPTraining", { payload });
      return res.status(result.httpStatus).json(result.data);
    } catch (error) {
      const notConfigured = error?.code === "ICALL_NOT_CONFIGURED";
      console.error(`iCall ${config.label} registration request failed:`, error.message);
      return res.status(notConfigured ? 503 : 502).json({ statusCode: notConfigured ? 503 : 502, status: "failed", message: notConfigured ? error.message : "iCall registration service unavailable" });
    }
  });

  app.post(`${prefix}/status`, requireRelayAuth, async (req, res) => {
    const loginId = String(req.body?.loginId || "").trim().toUpperCase();
    if (!validPan(loginId)) return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid login ID" });
    const config = icallConfig(environment);
    try {
      const result = await callIcall(environment, "/POSPTrainingStatus", { authToken: config.token, loginId });
      return res.status(result.httpStatus).json(result.data);
    } catch (error) {
      const notConfigured = error?.code === "ICALL_NOT_CONFIGURED";
      console.error(`iCall ${config.label} status request failed:`, error.message);
      return res.status(notConfigured ? 503 : 502).json({ statusCode: notConfigured ? 503 : 502, status: "failed", message: notConfigured ? error.message : "iCall status service unavailable" });
    }
  });

  app.post(`${prefix}/sso`, requireRelayAuth, async (req, res) => {
    const loginId = String(req.body?.loginId || "").trim().toUpperCase();
    if (!validPan(loginId)) return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid login ID" });
    const config = icallConfig(environment);
    try {
      const result = await callIcall(environment, "/AuthenticateUser", { authToken: config.token, loginId });
      const redirectUrl = result.data?.data?.redirectUrl;
      if (redirectUrl) {
        const parsedUrl = new URL(redirectUrl);
        if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.icallinsurance.com") {
          return res.status(502).json({ statusCode: 502, status: "failed", message: "Invalid SSO redirect received" });
        }
      }
      return res.status(result.httpStatus).json(result.data);
    } catch (error) {
      const notConfigured = error?.code === "ICALL_NOT_CONFIGURED";
      console.error(`iCall ${config.label} SSO request failed:`, error.message);
      return res.status(notConfigured ? 503 : 502).json({ statusCode: notConfigured ? 503 : 502, status: "failed", message: notConfigured ? error.message : "iCall SSO service unavailable" });
    }
  });

  app.post(`${prefix}/tcc`, requireRelayAuth, async (req, res) => {
    const fromDate = String(req.body?.tcc_from_date || "").trim();
    const toDate = String(req.body?.tcc_to_date || "").trim();
    const datePattern = /^\d{2}-\d{2}-\d{4}$/;
    if (!datePattern.test(fromDate) || !datePattern.test(toDate)) {
      return res.status(400).json({ statusCode: 400, status: "failed", message: "Dates must use DD-MM-YYYY" });
    }
    const config = icallConfig(environment);
    try {
      const result = await callIcall(environment, "/POSPTCC", { authToken: config.token, tcc_from_date: fromDate, tcc_to_date: toDate });
      return res.status(result.httpStatus).json(result.data);
    } catch (error) {
      const notConfigured = error?.code === "ICALL_NOT_CONFIGURED";
      console.error(`iCall ${config.label} TCC request failed:`, error.message);
      return res.status(notConfigured ? 503 : 502).json({ statusCode: notConfigured ? 503 : 502, status: "failed", message: notConfigured ? error.message : "iCall certificate service unavailable" });
    }
  });
}

registerIcallRoutes("uat");
registerIcallRoutes("prod");

app.post(["/authbridge/rc-verification", "/uat/authbridge/rc-verification"], requireRelayAuth, async (req, res) => {
  if (!AUTHBRIDGE_USERNAME) {
    return res.status(503).json({ statusCode: 503, status: "failed", message: "AuthBridge is not configured" });
  }

  const registrationNumber = normalizeRegistrationNumber(req.body?.registrationNumber);
  if (!validRegistrationNumber(registrationNumber)) {
    return res.status(400).json({ statusCode: 400, status: "failed", message: "Invalid vehicle registration number" });
  }

  const transactionId = `INSUREIT-RC-${Date.now()}-${crypto.randomInt(1000, 10000)}`;
  const providerRequest = { transID: transactionId, docType: 372, docNumber: registrationNumber };

  try {
    const encrypted = await callAuthbridge("/InstantSearch/encrypted_string", providerRequest);
    if (!encrypted.ok) {
      return res.status(502).json({ statusCode: 502, status: "failed", message: "AuthBridge request encryption failed", transactionId });
    }

    const requestData = extractOpaqueValue(encrypted.data, ["requestData", "encryptedData", "responseData", "data", "result"]);
    if (!requestData) {
      return res.status(502).json({ statusCode: 502, status: "failed", message: "AuthBridge returned an invalid encryption response", transactionId });
    }

    const lookup = await callAuthbridge("/api/v2.2/utilitysearch", { requestData });
    if (!lookup.ok) {
      return res.status(502).json({ statusCode: 502, status: "failed", message: "AuthBridge RC service unavailable", transactionId });
    }

    const responseData = extractOpaqueValue(lookup.data, ["responseData", "encryptedData", "requestData", "data", "result"]);
    if (!responseData) {
      const direct = parsePossiblyJson(lookup.data);
      if (direct && typeof direct === "object") {
        return res.json({ statusCode: 200, status: "success", transactionId, registrationNumber, provider: "authbridge", data: direct });
      }
      return res.status(502).json({ statusCode: 502, status: "failed", message: "AuthBridge returned an invalid RC response", transactionId });
    }

    const decrypted = await callAuthbridge("/InstantSearch/decrypt_encrypted_string", { responseData });
    if (!decrypted.ok) {
      return res.status(502).json({ statusCode: 502, status: "failed", message: "AuthBridge response decryption failed", transactionId });
    }

    const data = parsePossiblyJson(decrypted.data);
    return res.json({
      statusCode: 200,
      status: "success",
      provider: "authbridge",
      transactionId,
      registrationNumber,
      lookedUpAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError" || error?.name === "TimeoutError";
    console.error("AuthBridge RC request failed:", timedOut ? "provider timeout" : error.message);
    return res.status(502).json({
      statusCode: 502,
      status: "failed",
      message: timedOut ? "AuthBridge RC request timed out" : "AuthBridge RC service unavailable",
      transactionId,
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ statusCode: 404, status: "failed", message: "Route not found" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`InsureIt gateway listening on 127.0.0.1:${PORT}`);
});
