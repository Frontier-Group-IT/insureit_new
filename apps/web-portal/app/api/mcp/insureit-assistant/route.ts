import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const MAX_DOCUMENTS_PER_POLICY = 10;
const SERVER_INFO = { name: "insureit-assistant", version: "1.0.0" };
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2026-07-28", "2025-06-18", "2025-03-26"]);

type JsonRpcId = string | number | null;
type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
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

type PolicyDocumentReference = {
  documentId?: string | null;
  policyId?: string | null;
  policyCode?: string | null;
  policyNo?: string | null;
};

export async function GET() {
  return new NextResponse(null, {
    status: 405,
    headers: secureHeaders({ Allow: "POST, OPTIONS" }),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: secureHeaders({ Allow: "POST, OPTIONS" }),
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: secureHeaders({ "WWW-Authenticate": "Bearer" }) },
    );
  }

  const payload = await request.json().catch(() => null) as JsonRpcRequest | JsonRpcRequest[] | null;
  if (!payload) return rpcHttpError(-32700, "Parse error", null, 400);

  if (Array.isArray(payload)) {
    if (!payload.length) return rpcHttpError(-32600, "Invalid Request", null, 400);
    const responses = (await Promise.all(payload.map(handleRpcMessage))).filter(Boolean);
    if (!responses.length) return new NextResponse(null, { status: 202, headers: secureHeaders() });
    return NextResponse.json(responses, { headers: secureHeaders() });
  }

  const response = await handleRpcMessage(payload);
  if (!response) return new NextResponse(null, { status: 202, headers: secureHeaders() });
  return NextResponse.json(response, { headers: secureHeaders() });
}

async function handleRpcMessage(message: JsonRpcRequest) {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id ?? null, -32600, "Invalid Request");
  }

  const id = message.id ?? null;
  const isNotification = message.id === undefined;

  switch (message.method) {
    case "initialize": {
      if (isNotification) return null;
      const requested = cleanString(message.params?.protocolVersion, 32);
      const protocolVersion = requested && SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : "2025-06-18";
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Read-only INSUREIT policy-document connector. It returns metadata and short-lived signed URLs for policy copies only.",
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return null;
    case "ping":
      return isNotification ? null : rpcResult(id, {});
    case "tools/list":
      return isNotification ? null : rpcResult(id, {
        tools: [
          {
            name: "get_policy_document",
            title: "Get policy document",
            description: "Find an INSUREIT policy copy by exactly one policy/document reference and return short-lived signed download URLs.",
            inputSchema: {
              type: "object",
              properties: {
                documentId: { type: "string", description: "Exact policy_documents UUID." },
                policyId: { type: "string", description: "Exact policies UUID." },
                policyCode: { type: "string", description: "Exact INSUREIT policy code." },
                policyNo: { type: "string", description: "Exact insurer policy number." },
              },
              additionalProperties: false,
            },
            annotations: {
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false,
            },
          },
        ],
      });
    case "tools/call": {
      if (isNotification) return null;
      const name = cleanString(message.params?.name, 120);
      if (name !== "get_policy_document") return rpcError(id, -32602, "Unknown tool");
      const args = isRecord(message.params?.arguments) ? message.params?.arguments : {};
      const reference: PolicyDocumentReference = {
        documentId: cleanString(args.documentId, 80),
        policyId: cleanString(args.policyId, 80),
        policyCode: cleanString(args.policyCode, 120),
        policyNo: cleanString(args.policyNo, 160),
      };
      const supplied = Object.values(reference).filter(Boolean);
      if (supplied.length !== 1) {
        return rpcResult(id, toolError("Provide exactly one of documentId, policyId, policyCode, or policyNo."));
      }

      const result = await fetchPolicyDocuments(reference);
      if (!result.ok) return rpcResult(id, toolError(result.error));

      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result.data) }],
        structuredContent: result.data,
        isError: false,
      });
    }
    default:
      return isNotification ? null : rpcError(id, -32601, "Method not found");
  }
}

async function fetchPolicyDocuments(reference: PolicyDocumentReference) {
  const admin = createSupabaseAdminClient();

  if (reference.documentId) {
    const { data: documentRow, error } = await admin
      .from("policy_documents")
      .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
      .eq("id", reference.documentId)
      .eq("document_type", "policy_copy")
      .maybeSingle<PolicyDocumentRow>();

    if (error) return { ok: false as const, error: "Could not look up the policy document." };
    if (!documentRow) return { ok: false as const, error: "Policy document not found." };

    const signed = await signDocument(admin, documentRow);
    if (!signed) return { ok: false as const, error: "Could not create a signed policy-document URL." };
    return { ok: true as const, data: { expiresInSeconds: SIGNED_URL_TTL_SECONDS, documents: [signed] } };
  }

  let policyQuery = admin.from("policies").select("id, policy_code, policy_no");
  if (reference.policyId) policyQuery = policyQuery.eq("id", reference.policyId);
  if (reference.policyCode) policyQuery = policyQuery.eq("policy_code", reference.policyCode);
  if (reference.policyNo) policyQuery = policyQuery.eq("policy_no", reference.policyNo);

  const { data: policies, error: policyError } = await policyQuery.limit(2).returns<PolicyRow[]>();
  if (policyError) return { ok: false as const, error: "Could not look up the policy." };
  if (!policies?.length) return { ok: false as const, error: "Policy not found." };
  if (policies.length > 1) return { ok: false as const, error: "Policy reference is ambiguous." };

  const policy = policies[0];
  const { data: documentRows, error: documentError } = await admin
    .from("policy_documents")
    .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
    .eq("policy_id", policy.id)
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .limit(MAX_DOCUMENTS_PER_POLICY)
    .returns<PolicyDocumentRow[]>();

  if (documentError) return { ok: false as const, error: "Could not look up policy documents." };
  if (!documentRows?.length) return { ok: false as const, error: "No policy copy is attached to this policy." };

  const signed = await Promise.all(documentRows.map((row) => signDocument(admin, row)));
  if (signed.some((item) => !item)) return { ok: false as const, error: "Could not create a signed policy-document URL." };

  return {
    ok: true as const,
    data: {
      policy: { id: policy.id, policyCode: policy.policy_code, policyNo: policy.policy_no },
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      documents: signed.filter(Boolean),
    },
  };
}

async function signDocument(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  row: PolicyDocumentRow,
) {
  const { data, error } = await admin.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return {
    id: row.id,
    documentType: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    url: data.signedUrl,
  };
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.INSUREIT_ASSISTANT_API_KEY?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const provided = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  return Boolean(expected && provided && safeEqual(expected, provided));
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function rpcHttpError(code: number, message: string, id: JsonRpcId, status: number) {
  return NextResponse.json(rpcError(id, code, message), { status, headers: secureHeaders() });
}

function toolError(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function secureHeaders(extra: Record<string, string> = {}) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}
