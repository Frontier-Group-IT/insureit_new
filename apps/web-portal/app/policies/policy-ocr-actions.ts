"use server";

import { headers } from "next/headers";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import {
  buildTrainingProposal,
  compareTrainingProposalToReference,
  type TrainingDatabaseReference,
} from "@/lib/policy-ocr-training";
import { parsePolicyDocument, type ParsedPolicyField } from "@/lib/policy-ocr-parsers";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { refineAdditionalMotorPolicy } from "@/lib/policy-ocr-additional-motor-refiner";
import { refineDigitCommercialPolicyV2 } from "@/lib/policy-ocr-digit-refiner-v2";
import { refineIffcoCommercialPolicyV2 } from "@/lib/policy-ocr-iffco-refiner-v2";
import {
  refineIffcoStructuredFinancials,
  type StructuredPolicyTable,
} from "@/lib/policy-ocr-iffco-structured-refiner";
import { refineNewIndiaCommercialPolicy } from "@/lib/policy-ocr-new-india-refiner";
import { refineNewIndiaStructuredPolicy } from "@/lib/policy-ocr-new-india-structured-refiner";
import { refineApprovedMotorPolicyLayout } from "@/lib/policy-ocr-approved-layout-refiner";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { loadPolicyOcrTrainingReference } from "@/lib/policy-ocr-training-reference";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const OCR_TIMEOUT_MS = 120 * 1000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LAYOUT_PROCESSOR_ID = "b630ad846c5137a1";

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
    documentLayout?: {
      blocks?: DocumentLayoutBlock[];
    };
  };
  error?: { message?: string; status?: string };
};

type DocumentLayoutBlock = {
  blockId?: string;
  pageSpan?: { pageStart?: number; pageEnd?: number };
  textBlock?: {
    text?: string;
    blocks?: DocumentLayoutBlock[];
  };
  tableBlock?: {
    headerRows?: DocumentLayoutTableRow[];
    bodyRows?: DocumentLayoutTableRow[];
  };
  listBlock?: {
    listEntries?: Array<{ blocks?: DocumentLayoutBlock[] }>;
  };
};

type DocumentLayoutTableRow = {
  cells?: Array<{
    blocks?: DocumentLayoutBlock[];
  }>;
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
  return extractPolicyFile(file);
}

async function extractPolicyFile(
  file: FormDataEntryValue | null,
  subjectTokenOverride?: string | null,
): Promise<PolicyOcrResult> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Select a policy PDF or image." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Only PDF, JPG, PNG and WebP policy copies are supported." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "The policy document must be 15 MB or smaller." };

  const config = getGoogleConfig();
  if (!config) return { ok: false, error: "Policy document reading is temporarily unavailable. Please contact the administrator if the issue continues." };

  const requestHeaders = subjectTokenOverride ? null : await headers();
  const subjectToken = subjectTokenOverride
    || process.env.VERCEL_OIDC_TOKEN
    || requestHeaders?.get("x-vercel-oidc-token")
    || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN;
  if (!subjectToken) {
    return { ok: false, error: "Policy document reading is temporarily unavailable. Please contact the administrator if the issue continues." };
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
    if (!pages.length) return { ok: false, error: "No readable policy text was found in this document. Try a clearer PDF or image." };

    const baseParsed = parsePolicyDocument(pages);
    let parsed = baseParsed.parserId === "digit_commercial_motor_v1"
      ? refineDigitCommercialPolicyV2(pages, baseParsed)
      : baseParsed.parserId === "iffco_tokio_commercial_motor_v1"
        ? refineIffcoCommercialPolicyV2(pages, baseParsed)
        : baseParsed.parserId === "new_india_motor_v1"
          ? refineNewIndiaCommercialPolicy(pages, baseParsed)
          : refineAdditionalMotorPolicy(pages, baseParsed);

    const tables = file.type === "application/pdf"
      ? await processLayoutTables({ config, content, mimeType: file.type, accessToken: googleAccessToken, signal: controller.signal })
      : [];
    if (baseParsed.parserId === "iffco_tokio_commercial_motor_v1" && parsed.fields.find((field) => field.key === "policy_product")?.value !== "SAOD") {
      parsed = refineIffcoStructuredFinancials(tables, parsed);
    }
    if (baseParsed.parserId === "new_india_motor_v1") {
      parsed = refineNewIndiaStructuredPolicy(tables, parsed);
    }
    parsed = refineApprovedMotorPolicyLayout(pages, tables, parsed);

    if (!parsed.fields.length) return { ok: false, error: "No supported policy details could be read from this document. Please review the file and enter the details manually if needed." };

    return {
      ok: true,
      fields: parsed.fields,
      model: "Google Document AI Enterprise OCR + Layout Parser",
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractionMethod: "google_document_ai",
      warnings: parsed.warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The policy document took too long to read. Please try again." };
    }
    console.error("Google policy OCR failed", safeErrorName(error));
    return { ok: false, error: "The policy document could not be read. Please try again." };
  } finally {
    clearTimeout(timeout);
  }
}

type ClaimedTrainingJob = {
  label_id: string;
  policy_document_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  lease_token: string;
  attempt_count: number;
};

export async function processPolicyOcrTrainingDocument(
  labelId: string,
) {
  await requirePolicyOcrTrainingOperator();

  if (!getGoogleConfig()) {
    console.error(JSON.stringify({ level: "error", message: "Policy OCR manual run preflight failed", code: "google_ocr_configuration_missing" }));
    return { ok: false as const, error: "google_ocr_configuration_missing", processed: 0 };
  }
  const requestHeaders = await headers();
  const subjectToken = process.env.VERCEL_OIDC_TOKEN
    || requestHeaders?.get("x-vercel-oidc-token")
    || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN;
  if (!subjectToken?.trim()) {
    console.error(JSON.stringify({ level: "error", message: "Policy OCR manual run preflight failed", code: "google_oidc_subject_token_missing" }));
    return { ok: false as const, error: "google_oidc_subject_token_missing", processed: 0 };
  }

  const admin = createSupabaseAdminClient();
  const normalizedLabelId = labelId.trim();
  if (!normalizedLabelId) return { ok: false as const, error: "label_missing", processed: 0 };

  const { data: label, error: labelError } = await admin
    .from("policy_ocr_training_labels")
    .select("id,policy_document_id,processing_status,processing_attempts")
    .eq("id", normalizedLabelId)
    .maybeSingle<{
      id: string;
      policy_document_id: string;
      processing_status: string;
      processing_attempts: number;
    }>();
  if (labelError || !label) {
    console.error("Policy OCR selected label lookup failed", labelError?.code ?? "not_found");
    return { ok: false as const, error: "label_not_found", processed: 0 };
  }
  if (label.processing_status === "processing") {
    return { ok: false as const, error: "label_not_runnable", processed: 0 };
  }

  const { data: document, error: documentError } = await admin
    .from("policy_documents")
    .select("id,file_name,storage_bucket,storage_path,mime_type,file_size")
    .eq("id", label.policy_document_id)
    .eq("document_type", "policy_copy")
    .maybeSingle<{
      id: string;
      file_name: string;
      storage_bucket: string;
      storage_path: string;
      mime_type: string | null;
      file_size: number | null;
    }>();
  if (documentError || !document) {
    console.error("Policy OCR selected document lookup failed", documentError?.code ?? "not_found");
    return { ok: false as const, error: "policy_copy_not_found", processed: 0 };
  }

  const leaseToken = crypto.randomUUID();
  const attemptCount = label.processing_status === "failed"
    ? Math.min(label.processing_attempts + 1, 3)
    : 1;
  const leaseExpiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("policy_ocr_training_labels")
    .update({
      processing_status: "processing",
      processing_attempts: attemptCount,
      lease_token: leaseToken,
      lease_expires_at: leaseExpiresAt,
      failure_code: null,
      proposal: null,
      parser_id: null,
      parser_version: null,
      extraction_method: null,
      proposed_at: null,
      status: "needs_review",
      reviewed_by: null,
      reviewed_at: null,
      owner_approved_by: null,
      owner_approved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", label.id)
    .eq("processing_status", label.processing_status)
    .eq("processing_attempts", label.processing_attempts)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (claimError) {
    console.error("Policy OCR selected claim failed", claimError.code);
    return { ok: false as const, error: "claim_failed", processed: 0 };
  }
  if (!claimed) return { ok: false as const, error: "already_claimed", processed: 0 };
  await admin.from("policy_ocr_training_candidates").delete().eq("training_label_id", label.id);

  const outcome = await processTrainingJob({
    label_id: label.id,
    policy_document_id: document.id,
    file_name: document.file_name,
    storage_bucket: document.storage_bucket,
    storage_path: document.storage_path,
    mime_type: document.mime_type,
    file_size: document.file_size,
    lease_token: leaseToken,
    attempt_count: attemptCount,
  }, subjectToken);
  return {
    ok: true as const,
    processed: 1,
    succeeded: outcome.ok ? 1 : 0,
    exactMatches: outcome.ok && outcome.exactMatch ? 1 : 0,
    needsReview: outcome.ok && !outcome.exactMatch ? 1 : 0,
  };
}

async function processTrainingJob(job: ClaimedTrainingJob, subjectToken?: string | null) {
  const admin = createSupabaseAdminClient();
  try {
    if (Number(job.file_size) > MAX_FILE_SIZE) {
      await failTrainingJob(job, "file_too_large", false);
      return { ok: false as const };
    }
    if (!ALLOWED_TYPES.has(job.mime_type ?? "")) {
      await failTrainingJob(job, "unsupported_file_type", false);
      return { ok: false as const };
    }

    const { data: blob, error } = await admin.storage
      .from(job.storage_bucket)
      .download(job.storage_path);
    if (error || !blob) {
      await failTrainingJob(job, "private_copy_unavailable", true);
      return { ok: false as const };
    }

    const file = new File([blob], job.file_name, {
      type: job.mime_type || blob.type || "application/pdf",
    });
    const result = await extractPolicyFile(file, subjectToken);
    if (!result.ok) {
      await failTrainingJob(job, classifyTrainingFailure(result.error), isRetryableTrainingFailure(result.error));
      return { ok: false as const };
    }

    const proposal = buildTrainingProposal(result);
    const reference = await loadTrainingDatabaseReference(job.policy_document_id);
    if (!reference) {
      await failTrainingJob(job, "database_reference_missing", false);
      return { ok: false as const };
    }

    const { error: referenceError } = await admin
      .from("policy_ocr_training_labels")
      .update({
        insurer_name: reference.insurer_name,
        policy_product: reference.policy_product,
        policy_number: reference.policy_number,
        valid_from: reference.valid_from,
        valid_upto: reference.valid_upto,
        idv: reference.idv,
        od_premium: reference.od_premium,
        tp_premium: reference.tp_premium,
        cpa_opted: reference.cpa_opted,
        cpa_premium: reference.cpa_premium,
        printed_net_premium: reference.printed_net_premium,
        printed_gst: reference.printed_gst,
        printed_gross_premium: reference.printed_gross_premium,
        section_02_reference: section02Reference(reference),
        evidence_note: "Automated comparison reference from saved Section 02 and Section 03 data.",
      })
      .eq("id", job.label_id)
      .eq("processing_status", "processing")
      .eq("lease_token", job.lease_token);
    if (referenceError) throw new Error("training_reference_update_failed");

    const { data: completed, error: completeError } = await admin.rpc(
      "complete_policy_ocr_training_job",
      {
        p_label_id: job.label_id,
        p_lease_token: job.lease_token,
        p_proposal: proposal,
        p_parser_id: result.parserId,
        p_parser_version: result.parserVersion,
        p_extraction_method: result.extractionMethod,
      },
    );
    if (completeError || completed !== true) {
      console.error("Policy OCR training completion failed", completeError?.code ?? "lease_rejected");
      return { ok: false as const };
    }
    const comparison = compareTrainingProposalToReference(proposal, reference);
    return { ok: true as const, exactMatch: comparison.exactMatch };
  } catch (error) {
    console.error("Policy OCR training processing failed", safeErrorName(error));
    await failTrainingJob(job, "processing_failed", true);
    return { ok: false as const };
  }
}

async function loadTrainingDatabaseReference(policyDocumentId: string): Promise<TrainingDatabaseReference | null> {
  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin
    .from("policy_documents")
    .select("policy_id")
    .eq("id", policyDocumentId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ policy_id: string }>();
  if (documentError) throw new Error("training_document_lookup_failed");
  if (!document?.policy_id) return null;

  return loadPolicyOcrTrainingReference(document.policy_id);
}

function section02Reference(reference: TrainingDatabaseReference) {
  return {
    vehicle_registration_status: reference.vehicle_registration_status,
    vehicle_registration_number: reference.vehicle_registration_number,
    vehicle_class: reference.vehicle_class,
    vehicle_make: reference.vehicle_make,
    vehicle_model: reference.vehicle_model,
    vehicle_fuel_type: reference.vehicle_fuel_type,
    vehicle_manufacturing_year: reference.vehicle_manufacturing_year,
    vehicle_capacity: reference.vehicle_capacity,
    vehicle_chassis_number: reference.vehicle_chassis_number,
    vehicle_engine_number: reference.vehicle_engine_number,
    vehicle_rto_name: reference.vehicle_rto_name,
    vehicle_rto_state: reference.vehicle_rto_state,
  };
}

async function failTrainingJob(job: ClaimedTrainingJob, code: string, retryable: boolean) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("fail_policy_ocr_training_job", {
    p_label_id: job.label_id,
    p_lease_token: job.lease_token,
    p_failure_code: code,
    p_retryable: retryable,
  });
  if (error) console.error("Policy OCR training failure update failed", error.code);
}

function classifyTrainingFailure(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("15 mb") || normalized.includes("smaller")) return "file_too_large";
  if (normalized.includes("supported") || normalized.includes("pdf")) return "unsupported_document";
  if (normalized.includes("no readable") || normalized.includes("no supported")) return "no_supported_fields";
  if (normalized.includes("too long")) return "provider_timeout";
  if (normalized.includes("unavailable")) return "provider_unavailable";
  return "processing_failed";
}

function isRetryableTrainingFailure(message: string) {
  const code = classifyTrainingFailure(message);
  return code === "provider_timeout" || code === "provider_unavailable" || code === "processing_failed";
}

function getGoogleConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim();
  const poolId = process.env.GOOGLE_WORKLOAD_IDENTITY_POOL_ID?.trim();
  const providerId = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  const layoutProcessorId = process.env.GOOGLE_DOCUMENT_AI_LAYOUT_PROCESSOR_ID?.trim() || DEFAULT_LAYOUT_PROCESSOR_ID;

  if (!projectId || !projectNumber || !poolId || !providerId || !serviceAccountEmail || !location || !processorId) return null;
  return { projectId, projectNumber, poolId, providerId, serviceAccountEmail, location, processorId, layoutProcessorId };
}

async function processLayoutTables(args: {
  config: NonNullable<ReturnType<typeof getGoogleConfig>>;
  content: string;
  mimeType: string;
  accessToken: string;
  signal: AbortSignal;
}): Promise<StructuredPolicyTable[]> {
  const endpoint = `https://${args.config.location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(args.config.projectId)}/locations/${encodeURIComponent(args.config.location)}/processors/${encodeURIComponent(args.config.layoutProcessorId)}:process`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawDocument: { content: args.content, mimeType: args.mimeType },
      processOptions: {
        layoutConfig: {
          enableTableAnnotation: true,
        },
      },
    }),
    cache: "no-store",
    signal: args.signal,
  });

  const payload = await response.json().catch(() => null) as DocumentAiResponse | null;
  if (!response.ok) {
    console.error("Google Layout Parser request failed", response.status, payload?.error?.status);
    return [];
  }
  return extractDocumentLayoutTables(payload?.document);
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

function extractDocumentLayoutTables(document: DocumentAiResponse["document"]): StructuredPolicyTable[] {
  const result: StructuredPolicyTable[] = [];
  walkLayoutBlocks(document?.documentLayout?.blocks ?? [], result);
  return result;
}

function walkLayoutBlocks(blocks: DocumentLayoutBlock[], result: StructuredPolicyTable[]) {
  for (const block of blocks) {
    if (block.tableBlock) {
      const rows = [...(block.tableBlock.headerRows ?? []), ...(block.tableBlock.bodyRows ?? [])]
        .map((row) => (row.cells ?? []).map((cell) => layoutBlocksText(cell.blocks ?? []).trim()))
        .filter((row) => row.some(Boolean));
      if (rows.length) result.push({ page: normalizeLayoutPage(block.pageSpan?.pageStart), rows });
    }
    if (block.textBlock?.blocks?.length) walkLayoutBlocks(block.textBlock.blocks, result);
    for (const entry of block.listBlock?.listEntries ?? []) {
      if (entry.blocks?.length) walkLayoutBlocks(entry.blocks, result);
    }
  }
}

function layoutBlocksText(blocks: DocumentLayoutBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.textBlock?.text) parts.push(block.textBlock.text);
    if (block.textBlock?.blocks?.length) parts.push(layoutBlocksText(block.textBlock.blocks));
    if (block.tableBlock) {
      const nestedRows = [...(block.tableBlock.headerRows ?? []), ...(block.tableBlock.bodyRows ?? [])];
      for (const row of nestedRows) {
        parts.push((row.cells ?? []).map((cell) => layoutBlocksText(cell.blocks ?? [])).join(" "));
      }
    }
    for (const entry of block.listBlock?.listEntries ?? []) {
      if (entry.blocks?.length) parts.push(layoutBlocksText(entry.blocks));
    }
  }
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizeLayoutPage(pageStart: number | undefined) {
  if (!Number.isFinite(pageStart)) return 1;
  return Math.max(1, Number(pageStart));
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
  if (status === 400) return "This file could not be read. Check that it is a valid, clear policy PDF or image.";
  if (status === 401 || status === 403) return "Policy document reading is temporarily unavailable. Please try again later.";
  if (status === 413) return "The policy document is too large to process online.";
  if (status === 429) return "Policy document reading is temporarily busy. Please try again shortly.";
  if (providerMessage?.toLowerCase().includes("page")) return "This policy has more pages than the current processing limit.";
  return "The policy document could not be read. Please try again.";
}

function safeErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
