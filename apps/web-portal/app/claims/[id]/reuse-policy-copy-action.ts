"use server";

import { revalidatePath } from "next/cache";
import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function reuseLinkedPolicyCopy(claimId: string): Promise<{ok:boolean;message:string}> {
  const { supabase } = await requireClaimWorkflowAccess(claimId, "You do not have permission to manage claim documents.");
  const { data: claim, error: claimError } = await supabase.from("claims")
    .select("id,customer_id,policy_id,claim_service_mode,policy_service_source")
    .eq("id",claimId).maybeSingle();
  if (claimError || !claim) return {ok:false,message:"Claim could not be loaded."};
  if (claim.claim_service_mode !== "broker_managed" || claim.policy_service_source === "external" || !claim.policy_id) {
    return {ok:false,message:"An internal linked policy is required."};
  }
  const admin = createSupabaseAdminClient();
  const {data: policyDocument,error:policyError} = await admin.from("policy_documents")
    .select("id,file_name,storage_bucket,storage_path,mime_type,file_size")
    .eq("policy_id",claim.policy_id).eq("document_type","policy_copy")
    .order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(policyError || !policyDocument?.storage_bucket || !policyDocument.storage_path) return {ok:false,message:"No stored policy copy was found."};
  const {data:existing,error:existingError}=await admin.from("claim_documents")
    .select("id").eq("claim_id",claim.id).eq("customer_id",claim.customer_id)
    .eq("storage_bucket",policyDocument.storage_bucket).eq("storage_path",policyDocument.storage_path)
    .limit(1);
  if(existingError) return {ok:false,message:"Could not check existing claim documents."};
  if(existing?.length) return {ok:true,message:"The linked policy copy is already available in claim documents."};
  const {error:insertError}=await admin.from("claim_documents").insert({
    claim_id:claim.id,customer_id:claim.customer_id,document_type:"Insurance Copy",
    file_name:policyDocument.file_name,storage_bucket:policyDocument.storage_bucket,
    storage_path:policyDocument.storage_path,mime_type:policyDocument.mime_type,file_size:policyDocument.file_size,
    verification_status:"pending",verification_required:true,
  });
  if(insertError) return {ok:false,message:"Could not attach the existing policy copy to this claim."};
  revalidatePath(`/claims/${claim.id}`);
  return {ok:true,message:"Existing policy copy linked. Please verify it before continuing."};
}
