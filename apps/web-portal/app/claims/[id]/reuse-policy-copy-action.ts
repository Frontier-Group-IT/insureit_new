"use server";

import { revalidatePath } from "next/cache";
import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { findExistingLinkedClaimCopy, findLinkedClaimPolicyCopy } from "@/lib/linked-claim-policy-copy";

export async function reuseLinkedPolicyCopy(claimId: string): Promise<{ok:boolean;message:string}> {
  const { supabase } = await requireClaimWorkflowAccess(claimId, "You do not have permission to manage claim documents.");
  const { data: claim, error: claimError } = await supabase.from("claims")
    .select("id,customer_id,vehicle_id,policy_id,external_policy_id,claim_service_mode,policy_service_source")
    .eq("id",claimId).maybeSingle();
  if (claimError || !claim) return {ok:false,message:"Claim could not be loaded."};
  if (claim.claim_service_mode !== "broker_managed" && claim.policy_service_source !== "external" && !claim.external_policy_id) {
    return {ok:false,message:"This claim cannot reuse a linked policy copy."};
  }
  const admin = createSupabaseAdminClient();
  try {
    const policyDocument = await findLinkedClaimPolicyCopy(admin, claim);
    if (!policyDocument) return {ok:false,message:"No stored copy was found for this claim's linked policy."};
    const existing = await findExistingLinkedClaimCopy(admin, claim.id, claim.customer_id, policyDocument);
    if (existing) return {ok:true,message:"The linked policy copy is already available in claim documents."};
    const {error:insertError} = await admin.from("claim_documents").insert({
      claim_id:claim.id,customer_id:claim.customer_id,document_type:"Insurance Copy",
      file_name:policyDocument.file_name,storage_bucket:policyDocument.storage_bucket,
      storage_path:policyDocument.storage_path,mime_type:policyDocument.mime_type,file_size:policyDocument.file_size,
      verification_status:"pending",verification_required:true,
    });
    if (insertError) return {ok:false,message:"Could not attach the existing policy copy to this claim."};
    revalidatePath(`/claims/${claim.id}`);
    return {ok:true,message:"Existing policy copy linked. Please verify it before continuing."};
  } catch {
    return {ok:false,message:"Unable to check this claim's linked policy copy."};
  }
}
