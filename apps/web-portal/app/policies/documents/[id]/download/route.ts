import { NextResponse } from "next/server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_policies");
  if (!profile?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: document } = await admin
    .from("policy_documents")
    .select("storage_bucket,storage_path,policies!inner(customer_id)")
    .eq("id", id)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ storage_bucket: string; storage_path: string; policies: { customer_id: string } | null }>();
  if (!document?.policies?.customer_id || !(await canAccessCustomer(profile.id, profile.role, document.policies.customer_id, "view_policies"))) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  const { data: signed, error } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
  if (error || !signed?.signedUrl) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
