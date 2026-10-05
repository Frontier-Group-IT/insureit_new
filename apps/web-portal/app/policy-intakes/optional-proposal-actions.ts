"use server";

import { revalidatePath } from "next/cache";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePolicyIntakeCreator, requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const LIFE_HEALTH_TYPES = new Set(["life", "health"]);

type LifeHealthPolicyType = "life" | "health";

type SubmitWithoutProposalResult =
  | { ok: true; id: string; number: string; status: "ready_for_review" }
  | { ok: false; error: string };

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function intakeNumber() {
  return `PIR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function isLifeHealthPolicyType(value: string): value is LifeHealthPolicyType {
  return LIFE_HEALTH_TYPES.has(value);
}

export async function submitLifeHealthIntakeWithoutProposal(input: {
  leadSourceId: string;
  policyType: string;
  customerMobile: string;
}): Promise<SubmitWithoutProposalResult> {
  const profile = await requirePolicyIntakeCreator();
  if (!isLifeHealthPolicyType(input.policyType)) {
    return { ok: false, error: "A proposal form can only be skipped for Life or Health policy intake." };
  }

  const customerMobile = cleanMobile(input.customerMobile);
  if (customerMobile.length !== 10) {
    return { ok: false, error: "Enter a valid 10 digit customer mobile number." };
  }
  if (!input.leadSourceId) {
    return { ok: false, error: "Select an assigned Partner, POSP or MISP." };
  }

  const allowed = await canAccessIntermediary(
    profile.id,
    profile.role,
    input.leadSourceId,
    "create_policy_intakes",
  );
  if (!allowed) {
    return { ok: false, error: "This lead source is outside your permitted sales scope." };
  }

  const admin = createSupabaseAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .eq("id", input.leadSourceId)
    .maybeSingle<{
      id: string;
      intermediary_type: "posp" | "misp" | "partner";
      display_name: string;
      intermediary_code: string | null;
      account_status: string;
    }>();

  if (sourceError || !source || source.account_status !== "active") {
    return { ok: false, error: "The selected lead source is no longer active." };
  }

  const id = crypto.randomUUID();
  const number = intakeNumber();
  const { error: insertError } = await admin.from("policy_intake_requests").insert({
    id,
    intake_number: number,
    status: "ready_for_review",
    policy_type: input.policyType,
    submitted_by_profile_id: profile.id,
    lead_source_id: source.id,
    lead_source_type: source.intermediary_type,
    lead_source_name: source.display_name,
    lead_source_code: source.intermediary_code,
    customer_mobile: customerMobile,
    matched_customer_id: null,
    storage_bucket: BUCKET,
    storage_path: "",
    file_name: "",
    mime_type: null,
    file_size: null,
    ocr_status: "completed",
    ocr_fields: [],
    ocr_warnings: [],
  });

  if (insertError) {
    return { ok: false, error: "Policy intake could not be created. Please try again." };
  }

  revalidatePath("/policy-intakes");
  revalidatePath(`/policy-intakes/${id}`);
  return { ok: true, id, number, status: "ready_for_review" };
}

export async function getPolicyIntakeDocumentAvailability(id: string) {
  await requirePolicyIntakeViewer();
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("policy_intake_requests")
    .select("storage_path,file_name,policy_type")
    .eq("id", id)
    .maybeSingle<{ storage_path: string; file_name: string; policy_type: string | null }>();

  if (!data) return { ok: false as const, hasDocument: false, proposal: false };
  const proposal = data.policy_type === "life" || data.policy_type === "health";
  return {
    ok: true as const,
    hasDocument: Boolean(data.storage_path?.trim() && data.file_name?.trim()),
    proposal,
  };
}
