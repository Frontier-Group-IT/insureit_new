import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});
type DocumentRow = { id: string; document_type: string; file_name: string | null; mime_type: string | null; file_size: number | null; storage_bucket: string; storage_path: string; created_at: string | null };
type DocumentItem = { id: string; type: string; name: string; mimeType: string | null; size: number | null; source: "policy" | "life_health" };
const ALLOWED_BUCKET = "policy-documents";

async function authorized(request: Request, policyId: string) {
  const bearer = /^Bearer ([A-Za-z0-9._-]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!bearer) return { error: respond({ ok: false, error: "Sign in to view policy documents." }, 401) };
  const scoped = createSupabaseWithAccessToken(bearer);
  const { data: identity, error: userError } = await scoped.auth.getUser(bearer);
  if (userError || !identity.user) return { error: respond({ ok: false, error: "Partner session has expired." }, 401) };
  // The existing policy detail RPC is the authorization boundary for all actor kinds,
  // including employee, assigned intermediary, POSP/MISP and branch/group accounts.
  const { data: detail, error: accessError } = await scoped.rpc("partner_app_policy_detail", { p_policy_id: policyId });
  if (accessError || !detail || detail.policy?.id !== policyId)
    return { error: respond({ ok: false, error: "Policy documents are not available in your Partner scope." }, 403) };
  return { admin: createSupabaseAdminClient() };
}
async function loadDocuments(admin: ReturnType<typeof createSupabaseAdminClient>, policyId: string) {
  const { data: policyFiles, error: policyError } = await admin.from("policy_documents")
    .select("id,document_type,file_name,mime_type,file_size,storage_bucket,storage_path,created_at")
    .eq("policy_id", policyId).order("created_at", { ascending: false }).limit(100);
  if (policyError) throw new Error("Policy documents could not be loaded.");
  const { data: cases, error: caseError } = await admin.from("life_health_cases")
    .select("id").eq("final_policy_id", policyId).limit(10);
  if (caseError) throw new Error("Linked Life/Health cases could not be checked.");
  const caseIds = (cases ?? []).map(row => row.id as string);
  let caseFiles: DocumentRow[] = [];
  if (caseIds.length) {
    const { data, error } = await admin.from("life_health_case_documents")
      .select("id,document_type,file_name,mime_type,file_size,storage_bucket,storage_path,created_at")
      .in("case_id", caseIds).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Linked Life/Health documents could not be loaded.");
    caseFiles = (data ?? []) as DocumentRow[];
  }
  const entries = [
    ...(policyFiles as DocumentRow[] ?? []).map(row => ({ ...row, source: "policy" as const })),
    ...caseFiles.map(row => ({ ...row, source: "life_health" as const })),
  ].filter(row => row.storage_bucket === ALLOWED_BUCKET && Boolean(row.storage_path));
  return entries;
}
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return respond({ ok: false, error: "Invalid policy reference." }, 400);
  try {
    const access = await authorized(request, id);
    if (access.error) return access.error;
    const admin = access.admin!;
    const url = new URL(request.url);
    const documentId = url.searchParams.get("document");
    const source = url.searchParams.get("source");
    const files = await loadDocuments(admin, id);
    if (documentId !== null) {
      if (!UUID.test(documentId) || (source !== "policy" && source !== "life_health"))
        return respond({ ok: false, error: "Invalid document reference." }, 400);
      const file = files.find(row => row.id === documentId && row.source === source);
      if (!file) return respond({ ok: false, error: "Document not available for this policy." }, 404);
      const download = url.searchParams.get("download") === "true";
      const { data, error } = await admin.storage.from(ALLOWED_BUCKET).createSignedUrl(
        file.storage_path, 120, download ? { download: file.file_name || "policy-document" } : {},
      );
      if (error || !data?.signedUrl) return respond({ ok: false, error: "Could not open this document." }, 503);
      return respond({ ok: true, url: data.signedUrl });
    }
    const documents: DocumentItem[] = files.map(row => ({
      id: row.id, type: row.document_type, name: row.file_name || row.document_type.replaceAll("_", " "),
      mimeType: row.mime_type, size: row.file_size, source: row.source,
    }));
    return respond({ ok: true, documents });
  } catch {
    return respond({ ok: false, error: "Policy documents are temporarily unavailable. Please retry." }, 503);
  }
}
