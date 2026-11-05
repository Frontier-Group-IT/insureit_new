"use server";

import { revalidatePath } from "next/cache";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCustomerWebSession } from "@/lib/customer-web";
import { findExistingLinkedClaimCopy, findLinkedClaimPolicyCopy } from "@/lib/linked-claim-policy-copy";

type ReuseResult = {
  ok: boolean;
  message: string;
  uploaded?: { id: string; document_type: string; created_at: string; file_name: string | null; verification_status: string | null };
};

/** Reuse only a policy document owned by the customer's linked policy on this claim. */
export async function reuseCustomerLinkedPolicyCopy(accountId: string, claimId: string, stage: string): Promise<ReuseResult> {
  if (stage !== "spot_intimation" && stage !== "claim_intimation")
    return {ok:false,message:"Policy copy reuse is not available at this stage."};
  const { account } = await resolveCustomerWebScope(accountId);
  // loadCustomerClaimDetail verifies this claim belongs to the authorized customer.
  const { claim, milestones, internal_projection } = await loadCustomerClaimDetail(account.id, claimId);
  if (stage === "spot_intimation" && claim.claim_service_mode === "broker_managed"
      && !claim.external_policy_id && ((internal_projection?.completedStageCount ?? 0) >= 2
      || milestones.some(item => item.milestone_key === "claim_intimation"
          && ["completed","not_applicable"].includes(item.milestone_status))))
    return {ok:false,message:"Claim Intimation is complete. Spot Intimation documents are locked."};
  if (claim.claim_service_mode === "broker_managed" && ["Settled","Closed","Claim Complete"].includes(claim.current_status))
    return {ok:false,message:"Completed managed claims cannot accept new customer documents."};
  const admin = createSupabaseAdminClient();
  try {
    const source = await findLinkedClaimPolicyCopy(admin, claim);
    if (!source) return {ok:false,message:"No uploaded copy was found for the policy linked to this claim."};
    const existing = await findExistingLinkedClaimCopy(admin, claim.id, account.id, source);
    if (existing) return {ok:true,message:"This policy copy is already attached.",uploaded:{
      id:existing.id,document_type:existing.document_type,file_name:existing.file_name,
      created_at:existing.created_at,verification_status:existing.verification_status
    }};
    const session = await getCustomerWebSession();
    const { data: attached, error } = await admin.from("claim_documents").insert({
      claim_id:claim.id,customer_id:account.id,document_type:"Insurance Copy",
      file_name:source.file_name,storage_bucket:source.storage_bucket,storage_path:source.storage_path,
      mime_type:source.mime_type,file_size:source.file_size,uploaded_by:session.user.id,
      verification_status:"pending",verification_required:true,
    }).select("id,document_type,created_at,file_name,verification_status").single();
    if (error || !attached) return {ok:false,message:"Could not attach the existing policy copy."};
    revalidatePath(`/customer/claims/${claim.id}/stage/${stage}`);
    revalidatePath("/customer/spot-intimation");
    return {ok:true,message:"Existing policy copy attached for claim verification.",uploaded:attached};
  } catch {
    return {ok:false,message:"Unable to reuse this policy copy. Please try again."};
  }
}
