import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { canOpenClaimWorkflowResource } from "@/lib/claim-workflow-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const FRESH_SIGNED_URL_SECONDS = 60 * 10;

type ClaimDocumentStorageRow = {
  id: string;
  claim_id: string;
  customer_id: string;
  storage_bucket: string;
  storage_path: string;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin
    .from("claim_documents")
    .select("id, claim_id, customer_id, storage_bucket, storage_path")
    .eq("id", id)
    .maybeSingle<ClaimDocumentStorageRow>();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const employeeAllowed = await hasEffectiveCapability(profile, "view_claims")
    && await canAccessCustomer(profile.id, profile.role, document.customer_id, "view_claims");
  const partnerAllowed = profile.role === "intermediary" && await canOpenClaimWorkflowResource(document.claim_id);
  if (!employeeAllowed && !partnerAllowed) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, FRESH_SIGNED_URL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: signedError?.message ?? "Unable to open document." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
