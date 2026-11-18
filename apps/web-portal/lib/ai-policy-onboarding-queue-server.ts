import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isN8nWorkbenchPrimary, previewSemiAutoN8nExtraction } from "@/lib/policy-intake-semi-auto-n8n";
import { assessAiPolicyIntake, type AiPolicyEvidence, type AiPolicyExceptionCode } from "@/lib/ai-policy-onboarding-eligibility";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { policyDateDecision } from "@/lib/policy-date-rule";
import type { PolicyIntakeOcrField } from "@/lib/policy-intake-ocr-service";
import { fetchAllPages } from "@/lib/fetch-all-pages";

export type AiQueueState =
  | "pending" | "processing" | "exception" | "verified" | "unsupported" | "failed" | "duplicate";

export type AiQueueDisplay = {
  state: AiQueueState;
  exception_codes: AiPolicyExceptionCode[];
  processed_at: string | null;
  document_id: string;
};

type Claimed = { intake_id: string; document_id: string; lease_id: string };
type QueueIntake = {
  id: string;
  intake_number: string;
  created_at: string;
  policy_type: string | null;
  status: string;
  ocr_status: string;
  ocr_fields: PolicyIntakeOcrField[] | null;
  customer_mobile: string;
  matched_customer_id: string | null;
  assigned_to_profile_id: string | null;
};
type Customer = { id: string; phone: string; contact_name: string; company_name: string | null };
type Draft = { revision: number; draft_payload: {
  issuanceDate?: string; vehicleClass?: string; make?: string; model?: string;
  capacity?: string; insuredName?: string;
} };
type QueueUpdate = {
  state: AiQueueState; exception_codes: AiPolicyExceptionCode[];
  field_keys: string[]; parser_id: string | null; checks_passed: number;
  extraction_fingerprint: string | null; last_error_code: string | null;
  processed_at: string | null; retry_after: string;
};

const MAX_BATCH = 6; // Drain a bounded backlog without overloading n8n Cloud.
const MAX_CONCURRENT = 3; // Each n8n call can take up to 60 seconds.
const UUID = /^[0-9a-f-]{36}$/i;

function normalizedName(v: string) {
  return v.normalize("NFKC").trim().replace(/\s+/g," ").toUpperCase();
}
function normalizedPhone(v: string) {
  return v.replace(/\D/g,"").slice(-10);
}
function safeCodes(codes: string[]): AiPolicyExceptionCode[] {
  // Each code is from the closed internal taxonomy, never a remote n8n error.
  return [...new Set(codes)] as AiPolicyExceptionCode[];
}
function retryAfter(minutes: number) {
  return new Date(Date.now()+minutes*60_000).toISOString();
}

export function aiQueueEnabled() {
  return process.env.INSUREIT_AI_QUEUE_ENABLED === "true" && isN8nWorkbenchPrimary();
}

/**
 * Browser list never triggers extraction. Reading this table is entirely
 * optional until its migration is deployed. The table is private and only
 * accessed through this authenticated server-side service client.
 */
export async function loadAiQueueDisplay(ids: readonly string[]): Promise<Map<string,AiQueueDisplay>> {
  const result = new Map<string,AiQueueDisplay>();
  if (!aiQueueEnabled() || !ids.length) return result;
  const admin = createSupabaseAdminClient();
  // Fetch every authorized open Intake in bounded batches, not just the
  // first 75/100 visible rows. Partial reads must not invent eligibility.
  for(let offset=0;offset<ids.length;offset+=100){
    const {data,error} = await admin.from("policy_intake_ai_processing_queue")
      .select("intake_id,document_id,state,exception_codes,processed_at")
      .in("intake_id",ids.slice(offset,offset+100));
    if (error) return new Map<string,AiQueueDisplay>(); // Migration not applied.
    for (const r of data??[]) {
      if (!UUID.test(r.intake_id)) continue;
      result.set(r.intake_id,{
        state:r.state as AiQueueState,
        exception_codes:safeCodes(Array.isArray(r.exception_codes)?r.exception_codes:[]),
        processed_at:r.processed_at??null,
        document_id:r.document_id,
      });
    }
  }
  return result;
}

/** Claims are exclusively service-role RPC with FOR UPDATE SKIP LOCKED. */
export async function processAiQueueBatch(options?: {preferredIntakeId?:string;maxBatch?:number}): Promise<{
  enabled:boolean; claimed:number; processed:number; failed:number;
}> {
  if (!aiQueueEnabled()) return {enabled:false,claimed:0,processed:0,failed:0};
  const admin = createSupabaseAdminClient();
  // One coordinated parser revision bumps old exception rows into the bounded
  // recovery worker after deployment, without rewriting OCR/drafts or booking.
  // Include the configured base to preserve operator-controlled versioning;
  // this stable suffix also works when production has a pinned base revision.
  const parserRevision = ((process.env.INSUREIT_AI_QUEUE_PARSER_REVISION||"bridge-v1").trim()+"-issue-date-v2");
  if (parserRevision.length < 1 || parserRevision.length > 80) {
    throw new Error("AI queue parser revision configuration invalid");
  }
  const preferredIntakeId=options?.preferredIntakeId;
  if(preferredIntakeId && !UUID.test(preferredIntakeId)) {
    throw new Error("Invalid immediate policy Intake reference");
  }
  const boundedMax=preferredIntakeId?1:Math.max(1,Math.min(MAX_BATCH,options?.maxBatch??MAX_BATCH));
  const {data,error}=await admin.rpc("claim_policy_intake_ai_queue_v2",{
    p_max:boundedMax,p_parser_revision:parserRevision,
    p_preferred_intake_id:preferredIntakeId??null,
  });
  if (error) throw new Error("AI processing queue is not available; verify its reviewed migration");
  const claimed = (data??[]) as Claimed[];
  let processed=0, failed=0;
  // Bounded concurrency improves throughput while preserving the per-Intake
  // lease and retry budgets. One failed parser cannot fail the whole batch.
  for(let offset=0;offset<claimed.length;offset+=MAX_CONCURRENT){
    const wave=claimed.slice(offset,offset+MAX_CONCURRENT);
    await Promise.all(wave.map(async item=>{
      try {
        await processClaim(item);
        processed++;
      } catch {
        failed++;
        try {
          await finishClaim(item,{
            state:"failed",exception_codes:["extraction_failed"],field_keys:[],
            parser_id:null,checks_passed:0,extraction_fingerprint:null,
            last_error_code:"worker_retryable_failure",processed_at:null,retry_after:retryAfter(5),
          });
        } catch {
          // Expired leases remain reclaimable; never forge a successful state.
        }
      }
    }));
  }
  return {enabled:true,claimed:claimed.length,processed,failed};
}

async function finishClaim(item: Claimed, update: QueueUpdate) {
  const admin=createSupabaseAdminClient();
  // Lease, document and status compare-and-set prevent stale workers from
  // marking a replaced PDF or superseded queue row as verified.
  const {data,error}=await admin.from("policy_intake_ai_processing_queue")
    .update({
      ...update,lease_id:null,leased_until:null,updated_at:new Date().toISOString(),
    }).eq("intake_id",item.intake_id).eq("document_id",item.document_id)
      .eq("lease_id",item.lease_id).eq("state","processing")
      .select("intake_id").maybeSingle<{intake_id:string}>();
  if(error) throw new Error("AI queue completion failed");
  // If no row was updated the claim expired or the current PDF changed.
  return Boolean(data?.intake_id);
}

async function processClaim(item: Claimed) {
  const admin=createSupabaseAdminClient();
  const {data:intake,error}=await admin.from("policy_intake_requests")
    .select("id,intake_number,created_at,policy_type,status,ocr_status,ocr_fields,customer_mobile,matched_customer_id,assigned_to_profile_id")
    .eq("id",item.intake_id).maybeSingle<QueueIntake>();
  if(error || !intake || !["processing","ready_for_review","in_review","needs_attention"].includes(intake.status)){
    await finishClaim(item,{
      state:"exception",exception_codes:["stale_document"],field_keys:[],
      parser_id:null,checks_passed:0,extraction_fingerprint:null,
      last_error_code:"intake_not_open",processed_at:null,retry_after:retryAfter(60),
    });
    return;
  }

  // A policy number already classified as a duplicate by the canonical
  // Register must be retired from the extraction queue WITHOUT downloading
  // or calling n8n. Never delete the original Intake or its policy copy.
  if (intake.ocr_fields?.some(f=>f.key==="policy_number"&&f.value?.trim())) {
    const existingDuplicate=await loadPolicyIntakeDuplicateMatches(admin,[{
      id:intake.id,intake_number:intake.intake_number,status:intake.status,
      created_at:intake.created_at,ocr_fields:intake.ocr_fields,
    }]);
    if(!existingDuplicate.ok)throw new Error("Canonical duplicate lookup unavailable");
    if(existingDuplicate.matches.has(intake.id)){
      await finishClaim(item,{
        state:"duplicate",exception_codes:["duplicate_policy"],field_keys:[],
        parser_id:null,checks_passed:0,extraction_fingerprint:null,
        last_error_code:null,processed_at:new Date().toISOString(),
        retry_after:retryAfter(1440),
      });
      return;
    }
  }

  // Only a verified ICICI 3005 Motor PDF is trained. Never run an
  // experimental parser on explicitly non-Motor business lines.
  if (intake.policy_type!==null && intake.policy_type!=="motor") {
    await finishClaim(item,{
      state:"unsupported",exception_codes:["unsupported_layout"],field_keys:[],
      parser_id:null,checks_passed:0,extraction_fingerprint:null,
      last_error_code:null,processed_at:new Date().toISOString(),retry_after:retryAfter(1440),
    });
    return;
  }

  const extraction=await previewSemiAutoN8nExtraction(item.intake_id);
  if (!extraction.ok) {
    const untrained=extraction.reason==="untrained_or_unverified";
    await finishClaim(item,{
      state:untrained?"unsupported":"failed",
      exception_codes:[untrained?"unsupported_layout":"extraction_failed"],
      field_keys:[],parser_id:null,checks_passed:0,extraction_fingerprint:null,
      last_error_code:untrained?"parser_not_trained":"n8n_unavailable",
      processed_at:untrained?new Date().toISOString():null,
      retry_after:retryAfter(untrained?1440:5),
    });
    return;
  }
  if (extraction.preview.documentId !== item.document_id) {
    await finishClaim(item,{
      state:"exception",exception_codes:["stale_document"],
      field_keys:[],parser_id:null,checks_passed:0,extraction_fingerprint:null,
      last_error_code:"document_changed",processed_at:null,retry_after:retryAfter(10),
    });
    return;
  }

  const values=new Map(extraction.preview.fields.map(f=>[f.key,f.value]));
  const customerName=normalizedName(values.get("insured_name")??"");
  const phone=normalizedPhone(intake.customer_mobile);
  // All matching is read-only. Never select or create a customer in the worker.
  const [{data:matches,error:customerError},{data:draft,error:draftError},
    {data:brands,error:brandsError},{data:related,error:relatedError}] = await Promise.all([
    fetchAllPages<Customer,unknown>((from,to)=>admin.from("customers")
      .select("id,phone,contact_name,company_name").ilike("phone","%"+phone)
      .order("id",{ascending:true}).range(from,to).returns<Customer[]>(),200),
    admin.from("policy_intake_onboarding_drafts")
      .select("revision,draft_payload").eq("intake_id",intake.id).maybeSingle<Draft>(),
    admin.from("vehicle_manufacturer_brands")
      .select("brand_name").eq("is_active",true).limit(1000),
    admin.from("policy_intake_requests").select("id,ocr_fields")
      .eq("customer_mobile",intake.customer_mobile).neq("id",intake.id)
      .in("status",["processing","ready_for_review","in_review","needs_attention"])
      .limit(51).returns<Array<{id:string;ocr_fields:PolicyIntakeOcrField[]|null}>>(),
  ]);
  if(customerError||draftError||brandsError||relatedError)throw new Error("AI assessment master lookup failed");
  const phoneMatches=(matches??[]).filter(x=>normalizedPhone(x.phone)===phone);
  const exact=phoneMatches.filter(x=>[x.company_name,x.contact_name].some(n=>normalizedName(n??"")===customerName));
  const customerMatch:AiPolicyEvidence["customerMatch"]=((matches?.length??0)>2000) || exact.length>1?"multiple"
    :exact.length===1?"unique_exact":phoneMatches.length?"name_conflict":"none";
  // Multiple distinct customers with the same phone are an exception even if
  // one exact record matches. Never assume a shared phone is unique identity.
  const otherPolicyInsuredDiffers=(related??[]).some(other=>{
    const previousName=normalizedName(other.ocr_fields?.find(f=>f.key==="insured_name")?.value??"");
    return Boolean(previousName&&customerName&&previousName!==customerName);
  });
  const sharedDifferentNames=phoneMatches.some(x=>
    ![x.company_name,x.contact_name].some(n=>normalizedName(n??"")===customerName))
    || otherPolicyInsuredDiffers;
  // The normal register duplicate detector must also run on the NEW n8n
  // policy number. Otherwise a failed Google OCR Intake remains undetectable.
  const duplicate=await loadPolicyIntakeDuplicateMatches(admin,[{
    id:intake.id,intake_number:intake.intake_number,status:intake.status,
    created_at:intake.created_at,ocr_fields:extraction.preview.fields,
  }]);
  if(!duplicate.ok)throw new Error("Canonical duplicate protection unavailable");
  const isDuplicate=duplicate.matches.has(intake.id);
  // Copy ONLY strictly validated n8n OCR into an empty, unchanged Intake.
  // An atomic SQL compare-and-set checks current document, lease, empty OCR,
  // status, and absence of saved draft. This never books a policy.
  // The existing sync_verified_ai_intake_ocr_v1 RPC pins the bundled parser
  // and its revision. Keep OD-only extraction review-only until a separate,
  // reviewed database migration supports its parser identity explicitly.
  if(extraction.preview.parserId==="icici_3005_n8n_native_pdf"
    && extraction.preview.checksPassed===13 && extraction.preview.warnings.length===0){
    const synced=await admin.rpc("sync_verified_ai_intake_ocr_v1",{
      p_intake_id:intake.id,p_document_id:item.document_id,p_lease_id:item.lease_id,
      p_parser_revision:(process.env.INSUREIT_AI_QUEUE_PARSER_REVISION||"bridge-v1").trim(),
      p_verified_fields:extraction.preview.fields,p_checks_passed:13,
    });
    if(synced.error)throw new Error("Canonical verified OCR synchronization unavailable");
  }
  const model=normalizedName(values.get("vehicle_model")??"");
  const rawMake=normalizedName(values.get("vehicle_make")??"");
  const recognizedChetak=/^(?:C|CHETAK[ -]+)(2501|3001|3501|3502|3503)$/.test(model)
    && rawMake==="CHETAK";
  const make=recognizedChetak?"BAJAJ":rawMake;
  const enabledMakes=new Set((brands??[]).map(x=>normalizedName(x.brand_name)));
  const matchedManufacturer=enabledMakes.has(make)
    || (recognizedChetak&&[...enabledMakes].some(x=>x.startsWith("BAJAJ AUTO")));

  const savedDraft=draft?.draft_payload;
  const savedDraftConflictsWithPdf=Boolean(savedDraft && (
    (savedDraft.insuredName && normalizedName(savedDraft.insuredName)!==customerName)
    || (savedDraft.model && normalizedName(savedDraft.model)!==model)
  ));
  // An old default issue date is not authoritative PDF evidence. No auto
  // booking until a parser field explicitly verifies the policy issue date.
  const pdfIssuanceDate=values.get("policy_issuance_date")??"";
  const issuanceDecision=pdfIssuanceDate?policyDateDecision(pdfIssuanceDate):"invalid";
  const issuanceDateVerified=issuanceDecision!=="invalid"&&issuanceDecision!=="future";
  const bundled=normalizedName(values.get("policy_product")??"")==="BUNDLED";
  const ownDamageOnly=extraction.preview.parserId==="icici_3005_od_n8n_native_pdf";
  // The strict 3005 bridge independently verifies both OD and Third Party
  // dates. Bundled itself is not an exception once both periods were validated.
  // Canonical form derives the associated CPA schedule from verified cover
  // dates; final booking independently validates it through existing rules.
  const bundledPeriodsVerified=ownDamageOnly || !bundled || (
    extraction.preview.checksPassed===13
    && extraction.preview.warnings.length===0
    && ["policy_start_date","policy_end_date","third_party_start_date","third_party_end_date"]
      .every(key=>Boolean(values.get(key)))
  );
  const evidence:AiPolicyEvidence = {
    // The strict 3005 parser verifies the Motor business line even for
    // older Intakes lacking the upstream policy_type classification.
    policyType:intake.policy_type??"motor", intakeStatus:intake.status,
    isDuplicate, // Derived from the canonical registered-policy / earlier-Intake detector.
    hasCurrentDocument:true,documentStillCurrent:true,
    parserId:extraction.preview.parserId,
    parserChecksPassed:extraction.preview.checksPassed,
    extractionState:"success" as const,
    extractionWarnings:extraction.preview.warnings,
    fields:extraction.preview.fields.map(f=>({key:f.key,value:f.value})),
    premiumReconciled:extraction.preview.checksPassed===13
      && extraction.preview.warnings.length===0,
    matchedManufacturer,customerMatch,
    sharedPhoneHasDistinctNames:sharedDifferentNames,
    existingCustomerSameIdentity:exact.length>0,
    reviewerAssignedToAnother:false, // A user-specific reviewer check is still mandatory on conversion.
    vehicleOwnerConflict:false,coverageConflict:false, // Preflight must check these, not extraction worker.
    savedDraftConflictsWithPdf,
    issuanceDateVerified,needsDateApproval:issuanceDecision==="otp_required",
    bundledPeriodsVerified,canonicalPreflightPassed:false,
  };
  const assessment=assessAiPolicyIntake(evidence);
  // "Canonical preflight pending" is a future booking step, NOT an error in
  // an extracted PDF. Record correctly extracted Intakes as verified, while
  // never labelling them eligible to book until the real transaction preflight
  // has passed. True duplicate policy numbers remain non-bookable.
  const codes=assessment.exceptions
    .filter(e=>e.code!=="preflight_pending").map(e=>e.code);
  const state:AiQueueState=isDuplicate?"duplicate"
    :assessment.state==="unsupported"?"unsupported"
    :codes.length?"exception":"verified";
  const completed=await finishClaim(item,{
    state, exception_codes:codes,field_keys:extraction.preview.fields.map(f=>f.key),
    parser_id:extraction.preview.parserId,
    checks_passed:extraction.preview.checksPassed,
    extraction_fingerprint:extraction.preview.fingerprint,
    last_error_code:null,processed_at:new Date().toISOString(),
    retry_after:retryAfter(1440),
  });
  // The same canonical, current-document guard fills only an EMPTY saved
  // n8n issue-date field, never a manual value. A missing PDF-issued date
  // stays blank: do not replace it with today's date or OD/TP start.
  if(completed && (state==="verified" || state==="exception") && !isDuplicate
    && extraction.preview.checksPassed===13 && extraction.preview.warnings.length===0
    && issuanceDateVerified && pdfIssuanceDate){
    const backfill=await admin.rpc("fill_verified_ai_draft_issuance_date_v1",{
      p_intake_id:item.intake_id,p_document_id:item.document_id,
      p_fingerprint:extraction.preview.fingerprint,
      p_issuance_date:pdfIssuanceDate,
    });
    if(backfill.error)console.error("[ai-policy] verified issuance draft sync unavailable");
  }
}
