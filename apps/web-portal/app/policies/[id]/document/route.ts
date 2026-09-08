import { NextResponse } from "next/server";
import { canAccessPolicy } from "@/lib/policy-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_policies");
  if (!profile?.id) return NextResponse.redirect(new URL("/access-denied", _request.url));

  const { id } = await params;
  if (!(await canAccessPolicy(profile.id, profile.role, id, "view_policies"))) {
    return NextResponse.redirect(new URL("/access-denied", _request.url));
  }

  const admin = createSupabaseAdminClient();
  const { data: intake } = await admin
    .from("policy_intake_requests")
    .select("id")
    .eq("final_policy_id", id)
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!intake) return NextResponse.redirect(new URL(`/policies/${id}`, _request.url));

  const { data: document } = await admin
    .from("policy_intake_documents")
    .select("storage_bucket,storage_path")
    .eq("intake_id", intake.id)
    .eq("is_current", true)
    .maybeSingle<{ storage_bucket: string; storage_path: string }>();
  if (!document?.storage_bucket?.trim() || !document.storage_path?.trim()) {
    return NextResponse.redirect(new URL(`/policies/${id}`, _request.url));
  }

  const { data: signed } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 300);
  if (!signed?.signedUrl) return NextResponse.redirect(new URL(`/policies/${id}`, _request.url));

  return NextResponse.redirect(signed.signedUrl);
}
