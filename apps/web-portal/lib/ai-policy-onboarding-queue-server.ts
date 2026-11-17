import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isN8nWorkbenchPrimary, previewSemiAutoN8nExtraction } from "@/lib/policy-intake-semi-auto-n8n";
import { assessAiPolicyIntake, type AiPolicyExceptionCode } from "@/lib/ai-policy-onboarding-eligibility";

export type AiQueueState =
  | "pending" | "processing" | "exception" | "verified" | "unsupported" | "failed";

export type AiQueueDisplay = {
  state: AiQueueState;
  exception_codes: AiPolicyExceptionCode[];
  processed_at: string | null;
  document_id: string;
};

type Claimed = { intake_id: string; document_id: string; lease_id: string };
type QueueIntake = {
  id: string;
  policy_type: string | null;
  status: string;
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

const MAX_BATCH = 2;
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
  const {data,error} = await admin.from("policy_intake_ai_processing_queue")
    .select("intake_id,document_id,state,exception_codes,processed_at")
    .in("intake_id",ids.slice(0,100));
  if (error) return result; // Migration not yet applied: remain visibly unprocessed.
  for (const r of data??[]) {
    if (!UUID.test(r.intake_id)) continue;
    result.set(r.intake_id,{
      state:r.state as AiQueueState,
      exception_codes:safeCodes(Array.isArray(r.exception_codes)?r.exception_codes:[]),
      processed_at:r.processed_at??null,
      document_id:r.document_id,
    });
  }
  return result;
}

/** Claims are exclusively service-role RPC with FOR UPDATE SKIP LOCKED. */
export async function processAiQueueBatch(): Promise<{
  enabled:boolean; claimed:number; processed:number; failed:number;
}> {
  if (!aiQueueEnabled()) return {enabled:false,claimed:0,processed:0,failed:0};
  const admin = createSupabaseAdminClient();
  const parserRevision = (process.env.INSUREIT_AI_QUEUE_PARSER_REVISION||"bridge-v1").trim();
  if (parserRevision.length < 1 || parserRevision.length > 80) {
    throw new Error("AI queue parser revision configuration invalid");
  }
  const {data,error}=await admin.rpc("claim_policy_intake_ai_queue_v1",{
    p_max:MAX_BATCH,p_parser_revision:parserRevision,
  });
  if (error) throw new Error("AI processing queue is not available; verify its reviewed migration");
  const claimed = (data??[]) as Claimed[];
  let processed=0, failed=0;
  // Sequential and capped: no large bursts of private-PDF fetches.
  for(const item of claimed) {
    try {
      await processClaim(item);
      processed++;
    } catch {
      failed++;
      await finishClaim(item,{
        state:"failed",exception_codes:["extraction_failed"],field_keys:[],
        parser_id:null,checks_passed:0,extraction_fingerprint:null,
        last_error_code:"worker_retryable_failure",processed_at:null,retry_after:retryAfter(5),
      });
    }
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
    .select("id,policy_type,status,customer_mobile,matched_customer_id,assigned_to_profile_id")
    .eq("id",item.intake_id).maybeSingle<QueueIntake>();
  if(error || !intake || !["processing","ready_for_review","in_review","needs_attention"].includes(intake.status)){
    await finishClaim(item,{
      state:"exception",exception_codes:["stale_document"],field_keys:[],
      parser_id:null,checks_passed:0,extraction_fingerprint:null,
      last_error_code:"intake_not_open",processed_at:null,retry_after:retryAfter(60),
    });
    return;
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
    {data:brands,error:brandsError}] = await Promise.all([
    admin.from("customers").select("id,phone,contact_name,company_name")
      .eq("phone",intake.customer_mobile).limit(50).returns<Customer[]>(),
    admin.from("policy_intake_onboarding_drafts")
      .select("revision,draft_payload").eq("intake_id",intake.id).maybeSingle<Draft>(),
    admin.from("vehicle_manufacturer_brands")
      .select("brand_name").eq("is_active",true).limit(1000),
  ]);
  if(customerError||draftError||brandsError)throw new Error("AI assessment master lookup failed");
  const phoneMatches=(matches??[]).filter(x=>normalizedPhone(x.phone)===phone);
  const exact=phoneMatches.filter(x=>[x.company_name,x.contact_name].some(n=>normalizedName(n??"")===customerName));
  const customerMatch=exact.length>1?"multiple"
    :exact.length===1?"unique_exact":phoneMatches.length?"name_conflict":"none";
  // Multiple distinct customers with the same phone are an exception even if
  // one exact record matches. Never assume a shared phone is unique identity.
  const sharedDifferentNames=phoneMatches.some(x=>
    ![x.company_name,x.contact_name].some(n=>normalizedName(n??"")===customerName));
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
  const issuanceDateVerified=Boolean(values.get("policy_issuance_date"));
  const bundled=normalizedName(values.get("policy_product")??"")==="BUNDLED";
  const bundledPeriodsVerified=!bundled; // CPA/TP expiry approval needs canonical preflight.
  const evidence = {
    policyType:intake.policy_type, intakeStatus:intake.status,
    isDuplicate:false, // Canonical duplicate checks run separately, never assumed safe.
    hasCurrentDocument:true,documentStillCurrent:true,
    parserId:"icici_3005_n8n_native_pdf",
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
    issuanceDateVerified,needsDateApproval:false, // Separately checked during preflight.
    bundledPeriodsVerified,canonicalPreflightPassed:false,
  };
  const assessment=assessAiPolicyIntake(evidence);
  const codes=assessment.exceptions.map(e=>e.code);
  // Since no canonical policy/ownership/date preflight has run, "eligible"
  // is never produced by this worker, including for parse-perfect PDFs.
  const state=assessment.state==="unsupported"?"unsupported":"exception";
  await finishClaim(item,{
    state, exception_codes:codes,field_keys:extraction.preview.fields.map(f=>f.key),
    parser_id:"icici_3005_n8n_native_pdf",
    checks_passed:extraction.preview.checksPassed,
    extraction_fingerprint:extraction.preview.fingerprint,
    last_error_code:null,processed_at:new Date().toISOString(),
    retry_after:retryAfter(1440),
  });
}
