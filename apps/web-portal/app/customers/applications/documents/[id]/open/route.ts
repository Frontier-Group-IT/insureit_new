import { NextResponse } from "next/server";
import { requireApplicationReviewer } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type OnboardingDocument = {
  application_id: string;
  storage_bucket: string;
  storage_path: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin
    .from("customer_onboarding_documents")
    .select("application_id,storage_bucket,storage_path")
    .eq("id", id)
    .maybeSingle<OnboardingDocument>();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  await requireApplicationReviewer(document.application_id);

  const { data, error: signedUrlError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 600);

  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ error: "Document unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
