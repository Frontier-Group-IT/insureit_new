import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const CUSTOM_TYPES = new Set(["custom_1", "custom_2", "custom_3", "custom_4"]);
const MAX_LABEL_LENGTH = 60;

type CustomPayload = {
  application_id?: string;
  document_type?: string;
  document_label?: string;
};

export async function PATCH(request: Request) {
  const payload = (await request.json().catch(() => null)) as CustomPayload | null;
  const applicationId = payload?.application_id?.trim();
  const documentType = payload?.document_type?.trim();
  const label = payload?.document_label?.trim();

  if (!applicationId || !documentType || !CUSTOM_TYPES.has(documentType) || !validLabel(label)) {
    return NextResponse.json({ ok: false, message: "Enter a valid document name of up to 60 characters." }, { status: 400 });
  }

  const manager = await getScopedPospMispManager(applicationId);
  if (!manager?.id) {
    return NextResponse.json({ ok: false, message: "You are not authorized to update this document." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intermediary_onboarding_documents")
    .update({ document_label: label })
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .select("document_type,document_label,file_name")
    .maybeSingle<{ document_type: string; document_label: string | null; file_name: string }>();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "The custom document could not be renamed." }, { status: 400 });
  }

  revalidate(applicationId);
  return NextResponse.json({ ok: true, document: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const payload = (await request.json().catch(() => null)) as CustomPayload | null;
  const applicationId = payload?.application_id?.trim();
  const documentType = payload?.document_type?.trim();

  if (!applicationId || !documentType || !CUSTOM_TYPES.has(documentType)) {
    return NextResponse.json({ ok: false, message: "The custom document request is invalid." }, { status: 400 });
  }

  const manager = await getScopedPospMispManager(applicationId);
  if (!manager?.id) {
    return NextResponse.json({ ok: false, message: "You are not authorized to delete this document." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("intermediary_onboarding_documents")
    .select("id,storage_bucket,storage_path")
    .eq("application_id", applicationId)
    .eq("document_type", documentType)
    .maybeSingle<{ id: string; storage_bucket: string; storage_path: string }>();

  if (!existing) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const { error } = await admin
    .from("intermediary_onboarding_documents")
    .delete()
    .eq("id", existing.id);
  if (error) {
    return NextResponse.json({ ok: false, message: "The custom document could not be deleted." }, { status: 500 });
  }

  await removeStorageObjectIfUnreferenced(admin, existing.storage_bucket, existing.storage_path);
  revalidate(applicationId);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function validLabel(value: string | undefined): value is string {
  return Boolean(value && value.length <= MAX_LABEL_LENGTH && /[A-Za-z0-9]/.test(value));
}

function revalidate(applicationId: string) {
  revalidatePath(`/intermediaries/applications/${applicationId}`);
  revalidatePath(`/intermediaries/applications/${applicationId}/workflow`);
}

async function removeStorageObjectIfUnreferenced(admin: ReturnType<typeof createSupabaseAdminClient>, bucket: string, path: string) {
  const { count } = await admin
    .from("intermediary_onboarding_documents")
    .select("id", { count: "exact", head: true })
    .eq("storage_bucket", bucket)
    .eq("storage_path", path);
  if (!count) await admin.storage.from(bucket).remove([path]);
}
