"use server";

import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { previewSemiAutoN8nExtraction } from "@/lib/policy-intake-semi-auto-n8n";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { policyDateDecision } from "@/lib/policy-date-rule";
import { findVerifiedDraftDifferences, projectVerifiedPdfFields,
  RECONCILABLE_FIELDS, type DraftDifference, type ReconciliableField,
} from "@/lib/policy-intake-verified-draft-reconcile";
import type { PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";
import { revalidatePath } from "next/cache";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT=/^[0-9a-f]{64}$/i;
const ERROR={ok:false as const,error:"The saved draft or current PDF could not be verified. Refresh this Intake; no records changed."};
type Context={
  revision:number;draft:PolicyIntakeDraft;fingerprint:string;documentId:string;
  differences:DraftDifference[];intakeNumber:string;operatorId:string;
};
export type VerifiedDraftReview =
  | {ok:true;revision:number;fingerprint:string;documentId:string;
      intakeNumber:string;differences:DraftDifference[];dateApprovalRequired:boolean}
  | {ok:false;error:string};
export type VerifiedDraftApply =
  | {ok:true;revision:number;updatedFields:string[]}
  | {ok:false;error:string};

async function getReviewedContext(id:string):Promise<Context|{error:string}> {
  if(!UUID.test(id))return {error:"Invalid Intake reference."};
  const operator=await requireCapability("manage_system","approve");
  if(!["it_super_user","super_admin"].includes(operator.role))
    return {error:"This recovery requires authorized IT/Admin policy approval access."};
  await requirePolicyCreator();
  await requirePolicyIntakeReviewer(id);
  await requirePolicyIntakeFinalizer(id);
  const admin=createSupabaseAdminClient();
  const [{data:intake,error:intakeError},{data:q,error:qError},{data:stored,error:draftError}]=await Promise.all([
    admin.from("policy_intake_requests")
      .select("id,intake_number,status,created_at,policy_type,final_policy_id")
      .eq("id",id).maybeSingle<{
        id:string;intake_number:string;status:string;created_at:string;
        policy_type:string|null;final_policy_id:string|null;
      }>(),
    admin.from("policy_intake_ai_processing_queue")
      .select("state,document_id,extraction_fingerprint,exception_codes")
      .eq("intake_id",id).maybeSingle<{
        state:string;document_id:string;extraction_fingerprint:string|null;
        exception_codes:string[];
      }>(),
    admin.from("policy_intake_onboarding_drafts")
      .select("revision,draft_payload").eq("intake_id",id).maybeSingle<{
        revision:number;draft_payload:PolicyIntakeDraft;
      }>(),
  ]);
  if(intakeError||qError||draftError||!intake||!q||!stored
    ||intake.final_policy_id||intake.policy_type!=="motor"
    ||!["processing","in_review","ready_for_review","needs_attention"].includes(intake.status)
    ||!["verified","exception"].includes(q.state)
    ||(q.state==="exception"
      &&!q.exception_codes?.some(code=>["booking_review_required","draft_conflict"].includes(code)))
    ||!q.document_id||!q.extraction_fingerprint)return ERROR;
  const parsed=await previewSemiAutoN8nExtraction(id);
  if(!parsed.ok)return {error:parsed.error};
  if(parsed.preview.documentId!==q.document_id
      ||parsed.preview.fingerprint!==q.extraction_fingerprint
      ||parsed.preview.checksPassed!==13
      ||parsed.preview.warnings.length!==0
      ||!["icici_3005_n8n_native_pdf","icici_3005_od_n8n_native_pdf"].includes(parsed.preview.parserId))
    return {error:"The current private PDF or verified parser output differs from the queue. Reprocess/review this Intake before reconciling its draft."};
  const duplicate=await loadPolicyIntakeDuplicateMatches(admin,[{
    id:intake.id,intake_number:intake.intake_number,status:intake.status,
    created_at:intake.created_at,ocr_fields:parsed.preview.fields,
  }]);
  if(!duplicate.ok||duplicate.matches.has(id))
    return {error:"The policy number has a duplicate or the Register check is unavailable. Resolve duplicate identity first."};
  const fields=parsed.preview.fields;
  const name=fields.find(f=>f.key==="insured_name")?.value??"";
  const normalized=(x:string)=>x.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
  if(!name||normalized(stored.draft_payload.insuredName??"")!==normalized(name))
    return {error:"The saved insured name differs from the current PDF. Resolve legal customer identity in standard onboarding; no automatic overwrite."};
  const rawDate=fields.find(f=>f.key==="policy_issuance_date")?.value??"";
  const dateDecision=policyDateDecision(rawDate);
  if(dateDecision==="invalid"||dateDecision==="future")
    return {error:"The current PDF does not provide a valid issued-on date. No date will be inferred from the coverage period or today's date."};
  const [manufacturers,brands,insurers]=await Promise.all([
    admin.from("vehicle_manufacturers").select("id").eq("is_active",true),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true),
    admin.from("insurance_companies").select("id,name").eq("is_active",true),
  ]);
  if(manufacturers.error||brands.error||insurers.error)return ERROR;
  const active=new Set((manufacturers.data??[]).map(x=>x.id));
  let projected;
  try{
    projected=projectVerifiedPdfFields(fields,parsed.preview.premium,
      (brands.data??[]).filter(x=>active.has(x.manufacturer_id)).map(x=>x.brand_name),
      (insurers.data??[]).map(x=>({value:x.id,label:x.name})));
  }catch{return {error:"Premium or master-data reconciliation failed. Review the policy manually; no draft fields were changed."};}
  const differences=findVerifiedDraftDifferences(stored.draft_payload,projected);
  return {revision:stored.revision,draft:stored.draft_payload,
    fingerprint:parsed.preview.fingerprint,documentId:parsed.preview.documentId,
    differences,intakeNumber:intake.intake_number,operatorId:operator.id};
}

export async function reviewVerifiedAiLegacyDraft(id:string):Promise<VerifiedDraftReview>{
  const result=await getReviewedContext(id);
  if("error" in result)return {ok:false,error:result.error};
  return {ok:true,revision:result.revision,fingerprint:result.fingerprint,
    documentId:result.documentId,intakeNumber:result.intakeNumber,
    differences:result.differences,
    dateApprovalRequired:result.differences.some(d=>d.key==="issuanceDate")};
}

/** This action only edits explicitly selected fields on the SAME draft revision,
 * after independently re-reading the current PDF and matching its fingerprint.
 * It never registers a policy or changes customer/vehicle/assignment records. */
export async function applyVerifiedAiLegacyDraft(
  id:string,expectedRevision:number,expectedFingerprint:string,keys:string[],
):Promise<VerifiedDraftApply>{
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1
    ||!FINGERPRINT.test(expectedFingerprint)
    ||!Array.isArray(keys)||!keys.length||keys.length>RECONCILABLE_FIELDS.length
    ||new Set(keys).size!==keys.length
    ||keys.some(k=>!RECONCILABLE_FIELDS.includes(k as ReconciliableField)))
    return {ok:false,error:"Select explicit verified fields to reconcile; the saved review reference is invalid."};
  const current=await getReviewedContext(id);
  if("error" in current)return {ok:false,error:current.error};
  if(current.revision!==expectedRevision||current.fingerprint!==expectedFingerprint)
    return {ok:false,error:"The draft or source PDF changed. Review the differences again before saving."};
  const diffByKey=new Map(current.differences.map(d=>[d.key,d]));
  if(keys.some(k=>!diffByKey.has(k as ReconciliableField)))
    return {ok:false,error:"At least one selected field is no longer different. Reload the verified comparison."};
  const corrected={...current.draft};
  for(const key of keys){
    const diff=diffByKey.get(key as ReconciliableField)!;
    (corrected as unknown as Record<string,string>)[key]=diff.verifiedPdfValue;
  }
  const summary="Verified PDF reconciliation: "+keys.join(", ");
  corrected.remarks=(current.draft.remarks||"").slice(0,3000)+"\n"+summary;
  const admin=createSupabaseAdminClient();
  const {data:updated,error}=await admin.from("policy_intake_onboarding_drafts")
    .update({draft_payload:corrected,revision:expectedRevision+1,
      updated_by_profile_id:current.operatorId,updated_at:new Date().toISOString()})
    .eq("intake_id",id).eq("revision",expectedRevision)
    .select("revision").maybeSingle<{revision:number}>();
  if(error||!updated)return {ok:false,error:"Saved draft changed during reconciliation. Refresh and inspect it; no unconfirmed retry was started."};
  revalidatePath("/development/ai-policy-onboarding");
  return {ok:true,revision:updated.revision,updatedFields:keys};
}
