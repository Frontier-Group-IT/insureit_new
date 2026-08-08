import { NextResponse } from "next/server";
import { requireCustomerManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type RouteParams = {
  params: Promise<{ id: string }>;
};

type CustomerDocument = {
  customer_id: string;
  storage_bucket: string;
  storage_path: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: document, error } = await admin
    .from("customer_documents")
    .select("customer_id,storage_bucket,storage_path")
    .eq("id", id)
    .maybeSingle<CustomerDocument>();

  if (error || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  await requireCustomerManager(document.customer_id);

  const { data, error: signedUrlError } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 600);

  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ error: "Document unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
