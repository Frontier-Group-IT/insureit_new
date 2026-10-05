"use server";

import { revalidatePath } from "next/cache";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePolicyIntakeCreator } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type OptionalProposalPolicyType = "life" | "health";

type SubmitOptionalProposalResult =
  | { ok: true; id: string; number: string; status: "ready_for_review" }
  | { ok: false; error: string };

function cleanMobile(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function intakeNumber() {
  return `PIR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function submitPolicyIntakeWithoutProposal(input: {
  leadSourceId: string;
  policyType: string;
  customerMobile: string;
}): Promise<SubmitOptionalProposalResult> {
  const profile = await requirePolicyIntakeCreator();
  if (input.policyType !== "life" && input.policyType !== "health") {
    return { ok: false, error: "A policy copy is required for Motor and Non-Motor intake." };
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
    storage_bucket: null,
    storage_path: null,
    file_name: null,
    mime_type: null,
    file_size: null,
    ocr_status: "completed",
    ocr_fields: [],
    ocr_warnings: [],
    ocr_parser_id: null,
    ocr_parser_version: null,
  });

  if (insertError) {
    return { ok: false, error: "Policy intake could not be created. Please try again." };
  }

  revalidatePath("/policy-intakes");
  revalidatePath(`/policy-intakes/${id}`);
  return { ok: true, id, number, status: "ready_for_review" };
}
