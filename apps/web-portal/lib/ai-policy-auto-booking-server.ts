import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { withVerifiedPartnerApiToken } from "@/lib/partner-ai-studio-api-context";
import { convertVerifiedAiIntake } from "@/app/development/ai-policy-onboarding/actions";
import { withAutomaticPolicyBooking } from "@/lib/ai-policy-auto-booking-context";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyIntakeReviewer,requirePolicyIntakeFinalizer } from "@/lib/policy-intake-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";

type Claim={intake_id:string;document_id:string;extraction_fingerprint:string};
type FinalState="booked"|"review_required"|"uncertain";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/i;
const ALLOWED_REVIEW_FIELDS=new Map([
  ["Date approval","date_approval"],["Customer identity","customer_identity"],
  ["Vehicle ownership","vehicle_ownership"],["Policy history","coverage_conflict"],
  ["Existing active policy","coverage_conflict"],["Insured name","insured_name_mismatch"],
  ["Canonical booking","canonical_booking_review"],["Source PDF","source_pdf_review"],
  ["Canonical Intake handoff","canonical_handoff_review"],
  ["Policy issuance date","issuance_date_review"],["Premium","premium_review"],
  ["Manufacturer","manufacturer_review"],["Automation","automation_disabled"],
]);
export function autoBookingEnabled(){
  return process.env.INSUREIT_AI_AUTO_BOOKING_ENABLED==="true";
}
function configuredCredentials(){
  const email=process.env.INSUREIT_AI_AUTO_BOOKING_OPERATOR_EMAIL;
  const password=process.env.INSUREIT_AI_AUTO_BOOKING_OPERATOR_PASSWORD;
  if(!email||!password||password.length<16)throw Error("auto_booking_operator_not_configured");
  return {email,password};
}

/** Always obtain a fresh server-verified session for an actual active IT operator.
 * Never use the service-role key as a replacement for policy authorization.
 */
async function verifiedOperatorToken(){
  const {email,password}=configuredCredentials();
  const client=createSupabaseWithAccessToken();
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.session?.access_token||!data.user)throw Error("auto_booking_operator_auth_failed");
  // Existing finalizer, reviewer, create-policy and manage-system gates are
  // independently enforced by convertVerifiedAiIntake for this JWT.
  return data.session.access_token;
}
function safeReason(fields:readonly {field:string}[]):{state:FinalState;code:string}{
  const candidate=fields.map(f=>ALLOWED_REVIEW_FIELDS.get(f.field)).find(Boolean);
  // A controlled validation rejection is review-required; an unclassified
  // result is uncertain and MUST NOT be replayed automatically.
  return candidate?{state:"review_required",code:candidate}:{state:"uncertain",code:"conversion_outcome_unknown"};
}
async function finish(claim:Claim,state:FinalState,code:string|null,policyId:string|null){
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("finish_ai_auto_booking_v1",{
    p_intake_id:claim.intake_id,p_document_id:claim.document_id,
    p_fingerprint:claim.extraction_fingerprint,p_state:state,
    p_policy_id:policyId,p_failure_code:code,
  });
  if(error||data!==true)throw Error("auto_booking_finish_not_confirmed");
}

/** One isolated bounded batch. Existing verified rows form the old backlog.
 * Insertion into the unique ledger is the irreversible claim; no auto retry.
 * A crash leaves a claimed row for human reconciliation, not double booking.
 */
export async function runAutoBookingBatch():Promise<{
 enabled:boolean;claimed:number;booked:number;review:number;uncertain:number;
}>{
  if(!autoBookingEnabled())return{enabled:false,claimed:0,booked:0,review:0,uncertain:0};
  // Authenticate BEFORE claiming so missing credentials never strand records.
  const operatorToken=await verifiedOperatorToken();
  // Fail closed BEFORE acquiring any irreversible ledger claims if the
  // dedicated actor's live IT permissions were revoked or misconfigured.
  const operatorId=await withVerifiedPartnerApiToken(operatorToken,async()=>{
    const actor=await requireCapability("manage_system","approve");
    if(actor.role!=="it_super_user"&&actor.role!=="super_admin")
      throw Error("auto_booking_operator_role_invalid");
    await requirePolicyIntakeReviewer();
    await requirePolicyIntakeFinalizer();
    await requirePolicyCreator();
    if(!UUID.test(actor.id))throw Error("auto_booking_operator_id_invalid");
    return actor.id;
  });
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("claim_ai_auto_booking_v1",{
    p_operator_profile_id:operatorId,p_limit:3,
  });
  if(error)throw Error("auto_booking_claim_unavailable");
  const claims=(data??[]) as Claim[];
  let booked=0,review=0,uncertain=0;
  for(const claim of claims){
    if(!UUID.test(claim.intake_id)||!UUID.test(claim.document_id)||!HASH.test(claim.extraction_fingerprint)){
      uncertain++;
      continue; // Malformed persisted evidence: no booking and no guessed repair.
    }
    try{
      const result=await withAutomaticPolicyBooking(()=>withVerifiedPartnerApiToken(operatorToken,
        ()=>convertVerifiedAiIntake(claim.intake_id,true)));
      if(result.ok&&result.policyId&&UUID.test(result.policyId)){
        await finish(claim,"booked",null,result.policyId);
        booked++;
      }else{
        const reason=safeReason(result.issues??[]);
        await finish(claim,reason.state,reason.code,null);
        if(reason.state==="review_required")review++;
        else uncertain++;
      }
    }catch{
      // The canonical transaction MAY have committed. Persist a terminal hold,
      // never retry a transport/error outcome without Policy Register reconciliation.
      try{await finish(claim,"uncertain","conversion_outcome_unknown",null);}
      catch{console.error("[ai-auto-booking] attempt needs ledger reconciliation");}
      uncertain++;
    }
  }
  return{enabled:true,claimed:claims.length,booked,review,uncertain};
}
