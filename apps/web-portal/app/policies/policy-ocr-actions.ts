"use server";

import { headers } from "next/headers";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { parsePolicyDocument, type ParsedPolicyField } from "@/lib/policy-ocr-parsers";
import { refineDigitCommercialPolicy } from "@/lib/policy-ocr-digit-refiner";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const OCR_TIMEOUT_MS = 120 * 1000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

export type PolicyOcrField = ParsedPolicyField;

export type PolicyOcrResult =
  | {
      ok: true;
      fields: PolicyOcrField[];
      model: string;
      parserId: string;
      parserVersion: string;
      extractionMethod: string;
      warnings: string[];
    }
  | { ok: false; error: string };

type DocumentAiResponse = {
  document?: {
    text?: string;
    pages?: Array<{
      layout?: { textAnchor?: TextAnchor };
    }>;
  };
  error?: { message?: string; status?: string };
};

type TextAnchor = {
  textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }>;
};

type StsPayload = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type SafeOidcClaims = {
  issuer?: string;
  audience?: string | string[];
  subject?: string;
  issuedAt?: number;
  notBefore?: number;
  expiresAt?: number;
};

export async function extractPolicyDocument(formData: FormData): Promise<PolicyOcrResult> {
  await requirePolicyEditor();

  const file = formData.get("policy_document");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Select a policy PDF or image." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Only PDF, JPG, PNG and WebP policy copies are supported." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "The policy document must be 15 MB or smaller." };

  const config = getGoogleConfig();
  if (!config) return { ok: false, error: "Google policy OCR is not configured on this environment." };

  const requestHeaders = await headers();
  const subjectToken = process.env.VERCEL_OIDC_TOKEN
    || requestHeaders.get("x-vercel-oidc-token")
    || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN;
  if (!subjectToken) {
    return { ok: false, error: "Secure Google authentication is unavailable. Redeploy the production application with Vercel OIDC enabled." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const googleAccessToken = await getGoogleAccessToken(config, subjectToken, controller.signal);
    const content = Buffer.from(await file.arrayBuffer()).toString("base64");
    const endpoint = `https://${config.location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/processors/${encodeURIComponent(config.processorId)}:process`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rawDocument: { content, mimeType: file.type },
        processOptions: {
          ocrConfig: {
            enableNativePdfParsing: true,
            enableImageQualityScores: true,
          },
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as DocumentAiResponse | null;
    if (!response.ok) {
      console.error("Google Document AI request failed", response.status, payload?.error?.status);
      return { ok: false, error: documentAiError(response.status, payload?.error?.message) };
    }

    const pages = extractPageTexts(payload?.document);
    if (!pages.length) return { ok: false, error: "Google Document AI could not find readable policy text in this document." };

    const baseParsed = parsePolicyDocument(pages);
    const parsed = baseParsed.parserId === "digit_commercial_motor_v1"
      ? refineDigitCommercialPolicy(pages, baseParsed)
      : baseParsed;
    if (!parsed.fields.length) return { ok: false, error: "No supported policy fields could be extracted from this document." };

    return {
      ok: true,
      fields: parsed.fields,
      model: "Google Document AI Enterprise OCR",
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractionMethod: "google_document_ai",
      warnings: parsed.warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Policy OCR exceeded the two-minute processing limit. Please try the document again." };
    }
    console.error("Google policy OCR failed", safeErrorName(error));
    return { ok: false, error: "Google policy OCR could not process this document." };
  } finally {
    clearTimeout(timeout);
  }
}

function getGoogleConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim();
  const poolId = process.env.GOOGLE_WORKLOAD_IDENTITY_POOL_ID?.trim();
  const providerId = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();

  if (!projectId || !projectNumber || !poolId || !providerId || !serviceAccountEmail || !location || !processorId) return null;
  return { projectId, projectNumber, poolId, providerId, serviceAccountEmail, location, processorId };
}

async function getGoogleAccessToken(config: NonNullable<ReturnType<typeof getGoogleConfig>>, subjectToken: string, signal: AbortSignal) {
  const audience = `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
  const stsResponse = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      audience,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: CLOUD_PLATFORM_SCOPE,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: subjectToken,
    }),
    cache: "no-store",
    signal,
  });

  const stsPayload = await stsResponse.json().catch(() => null) as StsPayload | null;
  if (!stsResponse.ok || !stsPayload?.access_token) {
    console.error(
      "Google STS exchange failed",
      stsResponse.status,
      stsPayload?.error,
      stsPayload?.error_description,
      decodeSafeOidcClaims(subjectToken),
    );
    throw new Error("google_sts_exchange_failed");
  }

  const serviceAccount = encodeURIComponent(config.serviceAccountEmail);
  const impersonationResponse = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stsPayload.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scope: [CLOUD_PLATFORM_SCOPE], lifetime: "900s" }),
    cache: "no-store",
    signal,
  });

  const impersonationPayload = await impersonationResponse.json().catch(() => null) as { accessToken?: string; error?: { status?: string } } | null;
  if (!impersonationResponse.ok || !impersonationPayload?.accessToken) {
    console.error("Google service-account impersonation failed", impersonationResponse.status, impersonationPayload?.error?.status);
    throw new Error("google_service_account_impersonation_failed");
  }
  return impersonationPayload.accessToken;
}

function decodeSafeOidcClaims(token: string): SafeOidcClaims {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return {};
    const payload = JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8")) as Record<string, unknown>;
    return {
      issuer: typeof payload.iss === "string" ? payload.iss : undefined,
      audience: typeof payload.aud === "string" || Array.isArray(payload.aud)
        ? payload.aud as string | string[]
        : undefined,
      subject: typeof payload.sub === "string" ? payload.sub : undefined,
      issuedAt: typeof payload.iat === "number" ? payload.iat : undefined,
      notBefore: typeof payload.nbf === "number" ? payload.nbf : undefined,
      expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
    };
  } catch {
    return {};
  }
}

function extractPageTexts(document: DocumentAiResponse["document"]): string[] {
  const text = document?.text ?? "";
  if (!text.trim()) return [];
  const pages = document?.pages ?? [];
  if (!pages.length) return [text];

  return pages.map((page) => textFromAnchor(text, page.layout?.textAnchor)).map((page) => page.trim()).filter(Boolean);
}

function textFromAnchor(text: string, anchor: TextAnchor | undefined) {
  const segments = anchor?.textSegments ?? [];
  if (!segments.length) return "";
  return segments.map((segment) => {
    const start = Number(segment.startIndex ?? 0);
    const end = Number(segment.endIndex ?? 0);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? text.slice(start, end) : "";
  }).join("\n");
}

function documentAiError(status: number, providerMessage?: string) {
  if (status === 400) return "Google could not process this file. Check that it is a valid, readable policy PDF or image.";
  if (status === 401 || status === 403) return "Google policy OCR authentication or permission is not active yet.";
  if (status === 413) return "The policy document is too large for online OCR processing.";
  if (status === 429) return "Google policy OCR is temporarily busy. Please try again shortly.";
  if (providerMessage?.toLowerCase().includes("page")) return "This policy has more pages than the current online OCR limit.";
  return `Google policy OCR returned ${status}.`;
}

function safeErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
