import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const MAX_DOCUMENTS_PER_POLICY = 10;

type PolicyDocumentRequest = {
  documentId?: string;
  policyId?: string;
  policyCode?: string;
  policyNo?: string;
};

type PolicyRow = {
  id: string;
  policy_code: string | null;
  policy_no: string | null;
};

type PolicyDocumentRow = {
  id: string;
  policy_id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const unauthorized = authorizeAssistant(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as PolicyDocumentRequest;
  const documentId = clean(body.documentId, 80);
  const policyId = clean(body.policyId, 80);
  const policyCode = clean(body.policyCode, 120);
  const policyNo = clean(body.policyNo, 160);

  const suppliedReferences = [documentId, policyId, policyCode, policyNo].filter(Boolean);
  if (suppliedReferences.length !== 1) {
    return json(
      { error: "provide_exactly_one_reference", accepted: ["documentId", "policyId", "policyCode", "policyNo"] },
      400,
    );
  }

  const admin = createSupabaseAdminClient();

  if (documentId) {
    const { data: documentRow, error: documentError } = await admin
      .from("policy_documents")
      .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
      .eq("id", documentId)
      .eq("document_type", "policy_copy")
      .maybeSingle<PolicyDocumentRow>();

    if (documentError) {
      console.error("Assistant policy document lookup failed", documentError);
      return json({ error: "document_lookup_failed" }, 500);
    }
    if (!documentRow) return json({ error: "policy_document_not_found" }, 404);

    const signedDocument = await signDocument(admin, documentRow);
    if (!signedDocument.ok) return json({ error: "signed_url_failed" }, 500);

    return json({
      ok: true,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      documents: [signedDocument.document],
    });
  }

  let policyQuery = admin.from("policies").select("id, policy_code, policy_no");
  if (policyId) policyQuery = policyQuery.eq("id", policyId);
  if (policyCode) policyQuery = policyQuery.eq("policy_code", policyCode);
  if (policyNo) policyQuery = policyQuery.eq("policy_no", policyNo);

  const { data: policies, error: policyError } = await policyQuery.limit(2).returns<PolicyRow[]>();
  if (policyError) {
    console.error("Assistant policy lookup failed", policyError);
    return json({ error: "policy_lookup_failed" }, 500);
  }
  if (!policies?.length) return json({ error: "policy_not_found" }, 404);
  if (policies.length > 1) return json({ error: "policy_reference_ambiguous" }, 409);

  const policy = policies[0];
  const { data: documentRows, error: documentError } = await admin
    .from("policy_documents")
    .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
    .eq("policy_id", policy.id)
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .limit(MAX_DOCUMENTS_PER_POLICY)
    .returns<PolicyDocumentRow[]>();

  if (documentError) {
    console.error("Assistant policy documents lookup failed", documentError);
    return json({ error: "document_lookup_failed" }, 500);
  }
  if (!documentRows?.length) return json({ error: "policy_document_not_found" }, 404);

  const signedResults = await Promise.all(documentRows.map((documentRow) => signDocument(admin, documentRow)));
  if (signedResults.some((result) => !result.ok)) {
    return json({ error: "signed_url_failed" }, 500);
  }

  return json({
    ok: true,
    policy: {
      id: policy.id,
      policyCode: policy.policy_code,
      policyNo: policy.policy_no,
    },
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    documents: signedResults.map((result) => (result.ok ? result.document : null)).filter(Boolean),
  });
}

function authorizeAssistant(request: NextRequest) {
  const expected = process.env.INSUREIT_ASSISTANT_API_KEY?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;

  if (!expected) {
    console.error("INSUREIT_ASSISTANT_API_KEY is not configured");
    return json({ error: "assistant_api_not_configured" }, 503);
  }

  if (!provided || !safeEqual(expected, provided)) {
    return json({ error: "unauthorized" }, 401);
  }

  return null;
}

async function signDocument(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  documentRow: PolicyDocumentRow,
) {
  const { data: signed, error: signedError } = await admin.storage
    .from(documentRow.storage_bucket)
    .createSignedUrl(documentRow.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    console.error("Assistant policy document signing failed", {
      documentId: documentRow.id,
      policyId: documentRow.policy_id,
      error: signedError?.message ?? "missing_signed_url",
    });
    return { ok: false as const };
  }

  return {
    ok: true as const,
    document: {
      id: documentRow.id,
      documentType: documentRow.document_type,
      fileName: documentRow.file_name,
      mimeType: documentRow.mime_type,
      fileSize: documentRow.file_size,
      createdAt: documentRow.created_at,
      url: signed.signedUrl,
    },
  };
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
