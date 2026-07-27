"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePospMispManager } from "@/lib/master-data-server";
import { decryptSensitiveValue } from "@/lib/sensitive-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const applicationPath = (id: string) => `/intermediaries/applications/${id}`;

export async function prepareIntermediaryIibPayload(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = text(formData, "application_id");
  if (!reviewer?.id || !applicationId) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }, { data: assignment }, { data: intermediary }, { data: documents }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,final_type,registration_status").eq("id", applicationId).maybeSingle<{ id:string; final_type:"posp"|"misp"|"partner"|null; registration_status:string }>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_type,pos_name,misp_name,applicant_phone,applicant_email,date_of_birth,pan_number,aadhaar_number_encrypted,address,city,state,postal_code,dp_name,dp_phone,dp_email,dp_pan_number,dp_date_of_birth,dp_aadhaar_number_encrypted").eq("application_id", applicationId).maybeSingle<any>(),
    admin.from("intermediary_training_exam_assignments").select("training_status,training_completed_at,exam_status,exam_score,exam_completed_at,agreement_status,agreement_signed_at").eq("application_id", applicationId).maybeSingle<any>(),
    admin.from("intermediaries").select("id").eq("application_id", applicationId).maybeSingle<{id:string}>(),
    admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,verification_status").eq("application_id", applicationId)
  ]);

  if (!application || !profile || application.final_type === "partner") redirect(`${applicationPath(applicationId)}?stage=review&error=iib_not_available`);
  if (assignment?.agreement_status !== "signed") redirect(`${applicationPath(applicationId)}?stage=review&error=iib_agreement_required`);

  const type = (application.final_type ?? profile.partner_type) as "posp"|"misp";
  const identity = type === "misp" ? {
    name: profile.dp_name,
    mobile: profile.dp_phone,
    email: profile.dp_email,
    pan: profile.dp_pan_number,
    date_of_birth: profile.dp_date_of_birth,
    aadhaar: decryptSensitiveValue(profile.dp_aadhaar_number_encrypted)
  } : {
    name: profile.pos_name,
    mobile: profile.applicant_phone,
    email: profile.applicant_email,
    pan: profile.pan_number,
    date_of_birth: profile.date_of_birth,
    aadhaar: decryptSensitiveValue(profile.aadhaar_number_encrypted)
  };

  const payload = {
    application_id: applicationId,
    intermediary_type: type,
    identity,
    address: {
      line: profile.address,
      city: profile.city,
      state: profile.state,
      postal_code: profile.postal_code
    },
    qualification: {
      training_status: assignment?.training_status ?? null,
      training_completed_at: assignment?.training_completed_at ?? null,
      exam_status: assignment?.exam_status ?? null,
      exam_score: assignment?.exam_score ?? null,
      exam_completed_at: assignment?.exam_completed_at ?? null,
      agreement_status: assignment?.agreement_status ?? null,
      agreement_signed_at: assignment?.agreement_signed_at ?? null
    },
    documents: (documents ?? []).map((document:any) => ({
      type: document.document_type,
      file_name: document.file_name,
      bucket: document.storage_bucket,
      path: document.storage_path,
      verification_status: document.verification_status
    }))
  };

  const required: Array<[string, unknown]> = [
    ["Name", identity.name], ["Mobile", identity.mobile], ["Email", identity.email], ["PAN", identity.pan],
    ["Date of birth", identity.date_of_birth], ["Aadhaar", identity.aadhaar], ["Address", profile.address],
    ["City", profile.city], ["State", profile.state], ["Postal code", profile.postal_code]
  ];
  const missingFields = required.filter(([, value]) => !value).map(([label]) => label);
  if (assignment?.training_status !== "completed") missingFields.push("Training completion");
  if (assignment?.exam_status !== "passed") missingFields.push("Passed examination");
  if (!(documents ?? []).length) missingFields.push("Documents");

  const now = new Date().toISOString();
  const status = missingFields.length ? "draft" : "ready";
  const { error } = await admin.from("intermediary_iib_submission_packets").upsert({
    application_id: applicationId,
    intermediary_id: intermediary?.id ?? null,
    intermediary_type: type,
    status,
    payload,
    missing_fields: missingFields,
    prepared_at: now,
    prepared_by: reviewer.id,
    updated_at: now
  }, { onConflict: "application_id" });
  if (error) redirect(`${applicationPath(applicationId)}?stage=review&error=iib_prepare_failed`);

  await admin.from("intermediary_onboarding_applications").update({
    registration_status: status === "ready" ? "iib_submission_pending" : application.registration_status,
    updated_at: now
  }).eq("id", applicationId);

  revalidatePath(applicationPath(applicationId));
  redirect(`${applicationPath(applicationId)}?stage=review&success=${status === "ready" ? "iib_payload_ready" : "iib_payload_incomplete"}#iib-submission`);
}

export async function startIntermediaryIibHandoff(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = text(formData, "application_id");
  if (!reviewer?.id || !applicationId) redirect("/customers/posp-misp");
  const admin = createSupabaseAdminClient();
  const { data: packet } = await admin.from("intermediary_iib_submission_packets").select("status,missing_fields").eq("application_id", applicationId).maybeSingle<{status:string;missing_fields:string[]}>();
  if (!packet || packet.status !== "ready" || packet.missing_fields.length) redirect(`${applicationPath(applicationId)}?stage=review&error=iib_payload_not_ready#iib-submission`);
  const now = new Date().toISOString();
  await admin.from("intermediary_iib_submission_packets").update({ status:"handoff_started", handoff_started_at:now, handoff_started_by:reviewer.id, updated_at:now }).eq("application_id", applicationId);
  revalidatePath(applicationPath(applicationId));
  redirect(`${applicationPath(applicationId)}?stage=review&success=iib_handoff_started#iib-submission`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
