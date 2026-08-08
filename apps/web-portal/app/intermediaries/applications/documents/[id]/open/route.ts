import { NextResponse } from "next/server";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const SIGNED_URL_SECONDS = 60 * 10;

type IntermediaryDocumentStorageRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePospMispManager();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: document, error } = await admin
    .from("intermediary_onboarding_documents")
    .select("id,storage_bucket,storage_path")
    .eq("id", id)
    .maybeSingle<IntermediaryDocumentStorageRow>();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Unable to open document." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.redirect(signed.signedUrl);
}
