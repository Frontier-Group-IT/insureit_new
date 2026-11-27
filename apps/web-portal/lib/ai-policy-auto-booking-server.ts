import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { withVerifiedPartnerApiToken } from "@/lib/partner-ai-studio-api-context";
import { convertVerifiedAiIntake } from "@/app/development/ai-policy-onboarding/actions";
import { withAutomaticPolicyBooking } from "@/lib/ai-policy-auto-booking-context";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyIntakeReviewer,requirePolicyIntakeFinalizer } from "@/lib/policy-intake-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";

type Claim={intake_id:string;document_id:string;extraction_fingerprint:string;recovery?:boolean;stranded?:boolean;canonicalRecovery?:boolean;iciciRecovery?:boolean;reconciledDigit?:boolean};
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
  ["Product variant evidence","product_variant_review"],
  ["Product variant premium","product_variant_premium_review"],
  ["Verified commercial fields","commercial_identity_review"],
  ["PDF reconciliation","pdf_reconciliation_review"],
  ["Owner-driver CPA","cpa_selection_review"],
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
  const {data,error}=await admin.rpc(claim.reconciledDigit?"finish_ai_auto_booking_reconciled_digit_v1":claim.iciciRecovery?"finish_ai_auto_booking_icici_recovery_v1":claim.canonicalRecovery
    ?"finish_ai_auto_booking_canonical_recovery_v1":claim.stranded
    ?"finish_ai_auto_booking_stranded_v1":claim.recovery
    ?"finish_ai_auto_booking_liberty_recovery_v1":"finish_ai_auto_booking_v1",{
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
  if(error){
    // Supabase error codes are protocol metadata (e.g. 42702), not customer
    // information. Preserve only the bounded SQLSTATE to diagnose a blocked
    // scheduler; never log exception messages, PDFs or credentials.
    const pgCode=typeof error.code==="string" && /^[0-9A-Z]{5}$/.test(error.code)
      ?error.code:"unknown";
    console.error("[ai-auto-booking] claim unavailable",{pgCode});
    throw Error("auto_booking_claim_unavailable");
  }
  const claims=(data??[]) as Claim[];
  let booked=0,review=0,uncertain=0;
  const processClaim=async(claim:Claim):Promise<void>=>{
    if(!UUID.test(claim.intake_id)||!UUID.test(claim.document_id)||!HASH.test(claim.extraction_fingerprint)){
      uncertain++;
      return; // Malformed persisted evidence: no booking and no guessed repair.
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
  };
  // Finish every newly claimed policy before attempting the independent
  // Liberty recovery RPC. A broken recovery function must NEVER strand a
  // regular batch in the irreversible "claimed" state.
  for(const claim of claims)await processClaim(claim);
  // Only deterministic pre-commit Liberty failures qualify, as checked in
  // the service-role SQL RPC. Uncertain/booked outcomes remain excluded.
  const recovered=await admin.rpc("claim_ai_auto_booking_liberty_recovery_v1",{
    p_operator_profile_id:operatorId,p_limit:3,
  });
  if(recovered.error){
    // Preserve the database SQLSTATE for fault diagnosis, without leaking
    // customer data, PDF content, or credentials into application logs.
    const pgCode=typeof recovered.error.code==="string"
      && /^[0-9A-Z]{5}$/.test(recovered.error.code)
      ?recovered.error.code:"unknown";
    const missing=["PGRST202","42883"].includes(recovered.error.code??"");
    if(!missing){
      console.error("[ai-auto-booking] recovery claim unavailable",{pgCode});
      throw Error("auto_booking_recovery_claim_unavailable");
    }
  }else{
    for(const item of (recovered.data??[]) as Claim[]){
      const claim={...item,recovery:true};
      claims.push(claim);
      await processClaim(claim);
    }
  }
  // Exactly-once incident recovery for four named deterministic canonical
  // authorization failures. The SQL claim function enforces the four-ID
  // allowlist, current PDF/hash, immutable terminal failure ledgers and a
  // saved draft. It NEVER claims uncertain, booked or assigned intakes.
  const canonicalRecovery=await admin.rpc("claim_ai_auto_booking_canonical_recovery_v1",{
    p_operator_profile_id:operatorId,p_limit:4,
  });
  if(canonicalRecovery.error){
    const missing=["PGRST202","42883"].includes(canonicalRecovery.error.code??"");
    const pgCode=typeof canonicalRecovery.error.code==="string"
      && /^[0-9A-Z]{5}$/.test(canonicalRecovery.error.code)
      ?canonicalRecovery.error.code:"unknown";
    if(!missing){
      console.error("[ai-auto-booking] canonical recovery claim unavailable",{pgCode});
      throw Error("auto_booking_canonical_recovery_unavailable");
    }
  }else{
    for(const item of (canonicalRecovery.data??[]) as Claim[]){
      const claim={...item,canonicalRecovery:true};
      claims.push(claim);
      await processClaim(claim);
    }
  }
  // Only three original ICICI 3005 exact-document 13/13 review failures are
  // eligible for an isolated, one-time new claim after handoff correction.
  // Terminal claims are never reset or reused. An uncertain or booked
  // outcome remains excluded by the SQL claim function.
  const iciciRecovered=await admin.rpc("claim_ai_auto_booking_icici_recovery_v1",{
    p_operator_profile_id:operatorId,p_limit:3,
  });
  if(iciciRecovered.error){
    const missing=["PGRST202","42883"].includes(iciciRecovered.error.code??"");
    const pgCode=typeof iciciRecovered.error.code==="string"
      && /^[0-9A-Z]{5}$/.test(iciciRecovered.error.code)
      ?iciciRecovered.error.code:"unknown";
    if(!missing){
      console.error("[ai-auto-booking] ICICI recovery claim unavailable",{pgCode});
      throw Error("auto_booking_icici_recovery_unavailable");
    }
  }else{
    for(const item of (iciciRecovered.data??[]) as Claim[]){
      const claim={...item,iciciRecovery:true};
      claims.push(claim);
      await processClaim(claim);
    }
  }
  // Single exact Go Digit 7A source/transaction reconciliation. The
  // service-role SQL performs atomic Policy Register, vehicle/chassis,
  // document, audit and terminal-ledger proof BEFORE creating one new
  // irreversible claim. Unknown or already-booked outcomes stay excluded.
  const digitReconciliation=await admin.rpc("claim_ai_auto_booking_reconciled_digit_v1",{
    p_operator_profile_id:operatorId,p_limit:1,
  });
  if(digitReconciliation.error){
    const missing=["PGRST202","42883"].includes(digitReconciliation.error.code??"");
    if(!missing){
      const pgCode=typeof digitReconciliation.error.code==="string"
        &&/^[0-9A-Z]{5}$/.test(digitReconciliation.error.code)
        ?digitReconciliation.error.code:"unknown";
      console.error("[ai-auto-booking] Digit reconciliation unavailable",{pgCode});
      throw Error("auto_booking_digit_reconciliation_unavailable");
    }
  }else{
    for(const item of (digitReconciliation.data??[]) as Claim[]){
      const claim={...item,reconciledDigit:true};
      claims.push(claim);
      await processClaim(claim);
    }
  }
  // The nine Tata AIG historical claims remain excluded from this release.
  // The unrelated stranded-claim recovery is separately opt-in via env flag.
  if(process.env.INSUREIT_AI_STRANDED_RECOVERY_ENABLED==="true"){
  // One incident-limited replay for claims stranded before conversion by
  // the 2026-11-27 PostgreSQL 42702 worker crash. Service-role SQL checks
  // exact intake IDs, minute window, zero drafts, current PDF fingerprint,
  // verified 18/18 Tata source, no assignment/policy and no prior recovery.
  // This is never a generic "retry claimed" capability.
  const stranded=await admin.rpc("claim_ai_auto_booking_stranded_v1",{
    p_operator_profile_id:operatorId,p_limit:1,
  });
  if(stranded.error){
    const missing=["PGRST202","42883"].includes(stranded.error.code??"");
    const pgCode=typeof stranded.error.code==="string"
      && /^[0-9A-Z]{5}$/.test(stranded.error.code)
      ?stranded.error.code:"unknown";
    if(!missing){
      console.error("[ai-auto-booking] stranded-claim recovery unavailable",{pgCode});
      throw Error("auto_booking_stranded_claim_unavailable");
    }
  }else{
    for(const item of (stranded.data??[]) as Claim[]){
      const claim={...item,stranded:true};
      claims.push(claim);
      await processClaim(claim);
    }
  }
  }
  return{enabled:true,claimed:claims.length,booked,review,uncertain};
}
