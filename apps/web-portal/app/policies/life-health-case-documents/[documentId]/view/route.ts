import { NextResponse } from "next/server";

import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type DocumentRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  await requirePolicyCreator();
  const { documentId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: document, error } = await admin
    .from("life_health_case_documents")
    .select("id,storage_bucket,storage_path")
    .eq("id", documentId)
    .maybeSingle<DocumentRow>();

  if (error || !document) {
    return new NextResponse("Document not found.", { status: 404 });
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 5 * 60);

  if (signedError || !signed?.signedUrl) {
    return new NextResponse("Document is temporarily unavailable.", { status: 503 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
