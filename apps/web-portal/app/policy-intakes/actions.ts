"use server";

import { revalidatePath } from "next/cache";
import { extractPolicyIntakeDocument, type PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePolicyIntakeCreator, requirePolicyIntakeReviewer, requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function cleanMobile(value: string) { return value.replace(/\D/g, "").slice(-10); }
function safeName(value: string) { return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "policy-copy"; }
function intakeNumber() { return `PIR-${new Date().toISOString().slice(2,10).replace(/-/g, "")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`; }

export type SubmitPolicyIntakeResult =
  | { ok: true; id: string; number: string; status: "ready_for_review" | "needs_attention" }
  | { ok: false; error: string };

export async function submitPolicyIntake(formData: FormData): Promise<SubmitPolicyIntakeResult> {
  const profile = await requirePolicyIntakeCreator();
  const admin = createSupabaseAdminClient();
  const leadSourceId = String(formData.get("lead_source_id") ?? "").trim();
  const customerMobile = cleanMobile(String(formData.get("customer_mobile") ?? ""));
  const file = formData.get("policy_document");

  if (!leadSourceId) return { ok: false, error: "Select an assigned Partner, POSP or MISP." };
  if (customerMobile.length !== 10) return { ok: false, error: "Enter a valid 10 digit customer mobile number." };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Upload the policy PDF or image." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Upload a PDF, JPG, PNG or WebP policy copy." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Policy copy must be 15 MB or smaller." };

  const sourceAllowed = await canAccessIntermediary(profile.id, profile.role, leadSourceId, "view_intermediaries");
  if (!sourceAllowed) return { ok: false, error: "This lead source is outside your permitted sales scope." };

  const { data: source, error: sourceError } = await admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .eq("id", leadSourceId)
    .maybeSingle<{ id:string; intermediary_type:"posp"|"misp"|"partner"; display_name:string; intermediary_code:string|null; account_status:string }>();
  if (sourceError || !source || source.account_status !== "active") return { ok:false, error:"The selected lead source is no longer active." };

  const { data: customers } = await admin.from("customers").select("id").eq("phone", customerMobile).limit(1).returns<Array<{id:string}>>();
  const matchedCustomerId = customers?.[0]?.id ?? null;
  const id = crypto.randomUUID();
  const number = intakeNumber();
  const storagePath = `intakes/${id}/${crypto.randomUUID()}-${safeName(file.name)}`;

  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, file, { contentType:file.type, upsert:false });
  if (uploadError) return { ok:false, error:"Policy copy could not be uploaded. Please try again." };

  const { error: insertError } = await admin.from("policy_intake_requests").insert({
    id,
    intake_number:number,
    status:"processing",
    submitted_by_profile_id:profile.id,
    lead_source_id:source.id,
    lead_source_type:source.intermediary_type,
    lead_source_name:source.display_name,
    lead_source_code:source.intermediary_code,
    customer_mobile:customerMobile,
    matched_customer_id:matchedCustomerId,
    storage_bucket:BUCKET,
    storage_path:storagePath,
    file_name:file.name,
    mime_type:file.type,
    file_size:file.size,
    ocr_status:"processing",
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { ok:false, error:"Policy intake could not be created. Please try again." };
  }

  const ocrForm = new FormData();
  ocrForm.set("policy_document", file);
  const ocr = await extractPolicyIntakeDocument(ocrForm);
  if (!ocr.ok) {
    await admin.from("policy_intake_requests").update({ status:"needs_attention", ocr_status:"failed", attention_reason:ocr.error }).eq("id", id);
    revalidatePath("/policy-intakes");
    return { ok:true, id, number, status:"needs_attention" };
  }

  await admin.from("policy_intake_requests").update({
    status:"ready_for_review",
    ocr_status:"completed",
    ocr_fields:ocr.fields,
    ocr_parser_id:ocr.parserId,
    ocr_parser_version:ocr.parserVersion,
    ocr_warnings:ocr.warnings,
  }).eq("id", id);
  revalidatePath("/policy-intakes");
  return { ok:true, id, number, status:"ready_for_review" };
}

export async function openPolicyIntakeDocument(id: string) {
  const profile = await requirePolicyIntakeViewer();
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("policy_intake_requests")
    .select("submitted_by_profile_id,storage_bucket,storage_path")
    .eq("id", id)
    .maybeSingle<{submitted_by_profile_id:string;storage_bucket:string;storage_path:string}>();
  if (!data) return { ok:false as const, error:"Policy copy is unavailable." };
  const canReview = await reviewerAccess(profile.id, profile.role);
  if (!canReview && data.submitted_by_profile_id !== profile.id) return { ok:false as const, error:"You do not have access to this intake." };
  const { data:signed } = await admin.storage.from(data.storage_bucket).createSignedUrl(data.storage_path, 300);
  return signed?.signedUrl ? { ok:true as const, url:signed.signedUrl } : { ok:false as const, error:"Could not open the policy copy." };
}

export async function claimPolicyIntakeForReview(id: string) {
  const profile = await requirePolicyIntakeReviewer();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("policy_intake_requests")
    .update({ status:"in_review", assigned_to_profile_id:profile.id, attention_reason:null })
    .eq("id", id)
    .in("status", ["ready_for_review", "in_review"])
    .or(`assigned_to_profile_id.is.null,assigned_to_profile_id.eq.${profile.id}`)
    .select("id")
    .maybeSingle<{id:string}>();
  if (error || !data) return { ok:false as const, error:"This intake is already being reviewed by another Operations user." };
  revalidatePath(`/policy-intakes/${id}`);
  revalidatePath("/policy-intakes");
  return { ok:true as const };
}

export async function updatePolicyIntakeStatus(id:string, status:"needs_attention"|"rejected", reason:string) {
  const profile = await requirePolicyIntakeReviewer();
  const clean = reason.trim();
  if (!clean) return { ok:false as const, error:"Add a short reason." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("policy_intake_requests")
    .update({ status, attention_reason:clean, assigned_to_profile_id:profile.id })
    .eq("id", id)
    .in("status", ["ready_for_review", "in_review", "needs_attention"]);
  if (error) return { ok:false as const, error:"Could not update this intake." };
  revalidatePath(`/policy-intakes/${id}`);
  revalidatePath("/policy-intakes");
  return { ok:true as const };
}

export async function completePolicyIntakeByPolicyCode(id:string, policyCode:string) {
  const profile = await requirePolicyIntakeReviewer();
  const admin = createSupabaseAdminClient();
  const { data:policy } = await admin.from("policies").select("id").eq("policy_code", policyCode).maybeSingle<{id:string}>();
  if (!policy) return { ok:false as const, error:"Final policy could not be linked to the intake." };
  const { error } = await admin.from("policy_intake_requests").update({
    status:"completed",
    final_policy_id:policy.id,
    finalized_by_profile_id:profile.id,
    finalized_at:new Date().toISOString(),
    assigned_to_profile_id:profile.id,
    attention_reason:null,
  }).eq("id", id).neq("status", "rejected");
  if (error) return { ok:false as const, error:"Policy was booked but the intake could not be closed automatically." };
  revalidatePath("/policy-intakes");
  return { ok:true as const };
}

async function reviewerAccess(profileId:string, role:string|null|undefined) {
  const { hasEffectiveCapability } = await import("@/lib/effective-permissions");
  return hasEffectiveCapability({id:profileId,role}, "review_policy_intakes", "edit");
}

export type StoredPolicyIntakeField = PolicyIntakeOcrField;
