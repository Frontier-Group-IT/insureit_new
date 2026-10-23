import { NextResponse } from "next/server";

import { requirePolicyCreator } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireOperationsHeadRecordOwnership } from "@/lib/operations-head-record-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type DocumentRow = {
  id: string;
  case_id: string;
  storage_bucket: string;
  storage_path: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  if (requester?.role !== "operations_head_life") await requirePolicyCreator();
  const { documentId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: document, error } = await admin
    .from("life_health_case_documents")
    .select("id,case_id,storage_bucket,storage_path")
    .eq("id", documentId)
    .maybeSingle<DocumentRow>();

  if (error || !document) {
    return new NextResponse("Document not found.", { status: 404 });
  }

  if (requester?.role === "operations_head_life") await requireOperationsHeadRecordOwnership("life_health_case", document.case_id);

  const { data: signed, error: signedError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 5 * 60);

  if (signedError || !signed?.signedUrl) {
    return new NextResponse("Document is temporarily unavailable.", { status: 503 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
