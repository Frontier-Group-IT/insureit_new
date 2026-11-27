import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SemiAutoPolicyWorkspace, type SemiAutoIntakeRow } from "@/components/development/semi-auto-policy-workspace";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { inferLegacyAiReviewReason } from "@/lib/ai-intake-legacy-review";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { policyIntakeBucket, policyIntakeStatusCounts, type IntakeStatusBucket } from "@/lib/policy-intake-status-buckets";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { isN8nWorkbenchPrimary, semiAutoN8nEnabledForIntake } from "@/lib/policy-intake-semi-auto-n8n";
import type { PolicyIntakeOcrField } from "@/lib/policy-intake-ocr-service";
import { aiQueueEnabled, loadAiQueueDisplay } from "@/lib/ai-policy-onboarding-queue-server";
import { autoBookingEnabled } from "@/lib/ai-policy-auto-booking-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_SIZE = 30;
type OpenIntakeView = "action_required" | "in_review" | "processing" | "duplicate" | "all";
const OPEN_INTAKE_VIEWS: { view: OpenIntakeView; label: string }[] = [
  { view: "action_required", label: "Action Required" },
  { view: "in_review", label: "In Review" },
  { view: "processing", label: "Processing" },
  { view: "duplicate", label: "Duplicate" },
  { view: "all", label: "All Open" },
];
type Params = { page?: string; intake_id?: string; view?: string };
type CandidateIntake = SemiAutoIntakeRow & { ocr_fields: PolicyIntakeOcrField[] | null };

export default async function SemiAutoPolicyOnboardingPage({ searchParams }: { searchParams?: Promise<Params> }) {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user" && profile.role !== "super_admin") redirect("/access-denied");
  const params = searchParams ? await searchParams : {};
  const parsed = Number(params.page || "1");
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 1;
  const admin = createSupabaseAdminClient();
  const primaryN8n = isN8nWorkbenchPrimary();
  // Apply the exact same organization, hierarchy and submission scope as
  // /policy-intakes, even when the AI workbench account has extra privileges.
  const intakeScope = await getPartnerEmployeeIntakeReadScope({actor_kind:"employee",profile_id:profile.id});
  // Match the Policy Intake register: duplicates are derived from OCR policy numbers,
  // not necessarily the stored status. Keep duplicates visible for read-only n8n
  // preview; canonical booking continues to block duplicates server-side.
  const list = await fetchAllPages<CandidateIntake, unknown>((from, to) => {
    const current = admin.from("policy_intake_requests")
      .select("id,intake_number,status,policy_type,lead_source_name,customer_mobile,ocr_status,created_at,assigned_to_profile_id,ocr_fields")
      .in("status", ["ready_for_review", "in_review", "needs_attention", "processing"]);
    // n8n is the only extractor in this workbench. Include every open Intake
    // policy type, even older rows without a classified policy_type; untrained
    // formats receive a review-needed response, not a fabricated extraction.
    let scoped = primaryN8n ? current : current.eq("policy_type", "motor");
    if (intakeScope.mode === "or") scoped = scoped.or(intakeScope.predicates);
    else if (intakeScope.mode === "submitter") scoped = scoped.eq("submitted_by_profile_id", intakeScope.profileId);
    else if (intakeScope.mode === "none") scoped = scoped.eq("id","00000000-0000-0000-0000-000000000000");
    return scoped.order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, to).returns<CandidateIntake[]>();
  });
  const duplicates = list.error ? null : await loadPolicyIntakeDuplicateMatches(admin, list.data ?? []);
  const unavailable = Boolean(list.error || !duplicates?.ok);
  const candidates = list.data ?? [];
  // Every open Motor Intake appears, including duplicates and unfinished OCR.
  // The shared OCR policy-number matcher may have no policy number yet when
  // the separate AI queue has independently verified the current PDF.
  const workspaceRows = !unavailable && duplicates?.ok ? candidates : [];
  const queueActive = primaryN8n && aiQueueEnabled();
  const queue = queueActive ? await loadAiQueueDisplay(workspaceRows.map(row=>row.id)) : new Map();
  // Effective duplicate status is the union of canonical OCR matches and
  // *confirmed* AI queue duplicates. In particular, a queue-only duplicate
  // must not linger in Processing just because intake OCR is still pending.
  // Never accept a generic exception/diagnostic as proof of a duplicate.
  // This is display-only; booking still independently checks duplicates.
  const duplicateIds = duplicates?.ok ? new Set(duplicates.matches.keys()) : new Set<string>();
  for (const row of workspaceRows) {
    const item = queue.get(row.id);
    if (item?.state === "duplicate" && item.exception_codes.includes("duplicate_policy"))
      duplicateIds.add(row.id);
  }
  // Compute all tabs/counts from the SAME effective duplicate set before
  // pagination, bulk-convert, retries, and row rendering. No database writes.
  const autoRequested=autoBookingEnabled();
  // A verified, unassigned Intake is awaiting automatic preflight, NOT
  // awaiting human action. Its canonical DB status remains unchanged, and
  // the worker still revalidates all booking rules before registration.
  const displayBucket=(row:CandidateIntake):Exclude<IntakeStatusBucket,"all">=>{
    const canonical=policyIntakeBucket(row,duplicateIds.has(row.id));
    const q=queue.get(row.id);
    if(!autoRequested || row.assigned_to_profile_id!==null || row.policy_type!=="motor")
      return canonical;
    // Unassigned records must not appear in the human In Review lane just
    // because an automatic handoff set an internal workflow state.
    if(q?.state==="verified" && q.exception_codes.length===0
      && (canonical==="action_required"||canonical==="in_review"))
      return "processing";
    if(q?.state==="exception" && canonical==="in_review")
      return "action_required";
    return canonical;
  };
  const intakeCounts=policyIntakeStatusCounts(workspaceRows,duplicateIds);
  if(autoRequested){
    for(const row of workspaceRows){
      const canonical=policyIntakeBucket(row,duplicateIds.has(row.id));
      const displayed=displayBucket(row);
      if(canonical!==displayed){
        intakeCounts[canonical]--;
        intakeCounts[displayed]++;
      }
    }
  }
  const duplicateCount = intakeCounts.duplicate;
  const total = intakeCounts.action_required + intakeCounts.in_review + intakeCounts.processing;
  const queueCounts = { eligible:0, extracted:0, duplicates:duplicateCount, queued:0, extracting:0,
    exceptions:0, unprocessed:0, unsupported:0, failed:0 };
  for (const row of workspaceRows) {
    const duplicate = policyIntakeBucket(row,duplicateIds.has(row.id)) === "duplicate";
    // Canonically known duplicates never contribute to the extraction backlog.
    if(duplicate)continue;
    const item=queue.get(row.id);
    if(!item) {queueCounts.unprocessed++;continue;}
    if(item.state==="pending")queueCounts.queued++;
    else if(item.state==="processing")queueCounts.extracting++;
    else if(item.state==="unsupported")queueCounts.unsupported++;
    else if(item.state==="failed")queueCounts.failed++;
    else if(item.state==="verified" && !item.exception_codes.length) { queueCounts.extracted++; if(row.policy_type==="motor")queueCounts.eligible++; }
    else if(item.state!=="duplicate")queueCounts.exceptions++;
  }
  // Pre-filter only verified, non-duplicate, authorized Motor Intakes.
  // This list is a set of CANDIDATES, not proof of booking eligibility:
  // convertVerifiedAiIntake revalidates every policy against the original PDF
  // and canonical booking engine. Includes all pages, not just current 75.
  // A durable claim is NEVER an unattempted booking candidate. Load ledger
  // claims separately from OCR queue state so an uncertain outcome cannot
  // be presented as automatically retryable.
  const attemptedIds=new Set<string>();
  const bookingAttemptByIntake=new Map<string,{state:string;failure_code:string|null}>();
  let autoLedgerAvailable=!autoRequested;
  let autoClaimedCount=0,autoBookedCount=0,autoReviewCount=0,autoUncertainCount=0;
  if(autoRequested){
    const aggregate=await Promise.all(["claimed","booked","review_required","uncertain"].map(state=>
      admin.from("policy_intake_ai_auto_booking_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    autoLedgerAvailable=aggregate.every(result=>!result.error);
    if(autoLedgerAvailable){
      autoClaimedCount=aggregate[0].count??0;
      autoBookedCount=aggregate[1].count??0;
      autoReviewCount=aggregate[2].count??0;
      autoUncertainCount=aggregate[3].count??0;
      for(let offset=0;offset<workspaceRows.length;offset+=100){
        const result=await admin.from("policy_intake_ai_auto_booking_attempts")
          .select("intake_id,state,failure_code").in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
        if(result.error){autoLedgerAvailable=false;break;}
        for(const item of result.data??[]){
          attemptedIds.add(item.intake_id);
          bookingAttemptByIntake.set(item.intake_id,{state:item.state,failure_code:item.failure_code});
        }
      }
    }
  }
  // All recovery claims originated from old review_required rows. Counts
  // represent the latest attempt, so do not report recovered bookings as
  // both completed and still under review.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_auto_booking_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(result=>!result.error)){
      const values=counts.map(result=>result.count??0);
      autoReviewCount=Math.max(0,autoReviewCount-values.reduce((a,b)=>a+b,0));
      autoClaimedCount+=values[0];
      autoBookedCount+=values[1];
      autoReviewCount+=values[2];
      autoUncertainCount+=values[3];
    }
  }
  // The second immutable recovery ledger supersedes the original known
  // pre-commit Liberty mismatch for display only. It does not delete history,
  // make held records new candidates, or permit retries after uncertainty.
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_auto_booking_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break; // Older deployment before migration.
      for(const attempt of recovery.data??[])
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
    }
  }
  // A one-time stranded-claim recovery supersedes an older 'claimed'
  // booking attempt. Aggregate counts and individual rows show the latest
  // audited attempt, while preserving the original immutable ledger.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_stranded_claim_recovery")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(result=>!result.error)){
      const values=counts.map(result=>result.count??0);
      autoClaimedCount=Math.max(0,autoClaimedCount-values.reduce((a,b)=>a+b,0))+values[0];
      autoBookedCount+=values[1];
      autoReviewCount+=values[2];
      autoUncertainCount+=values[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_stranded_claim_recovery")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break;
      for(const attempt of recovery.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  // Third immutable, incident-only canonical-claim recovery: these exact four
  // records previously had terminal review_required attempts. Show ONLY the
  // latest ledger outcome without resetting their original claim history.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_canonical_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(result=>!result.error)){
      const values=counts.map(result=>result.count??0);
      autoReviewCount=Math.max(0,autoReviewCount-values.reduce((a,b)=>a+b,0));
      autoClaimedCount+=values[0];
      autoBookedCount+=values[1];
      autoReviewCount+=values[2];
      autoUncertainCount+=values[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_canonical_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break; // Website can deploy before DB migration.
      for(const attempt of recovery.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  // Supersede old ICICI review for the exact-once, audited 3005 recovery.
  // Keep the old attempt ledgers intact and never display a recovered
  // policy as still awaiting booking review.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_icici_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(result=>!result.error)){
      const values=counts.map(result=>result.count??0);
      autoReviewCount=Math.max(0,autoReviewCount-values.reduce((a,b)=>a+b,0));
      autoClaimedCount+=values[0];
      autoBookedCount+=values[1];
      autoReviewCount+=values[2];
      autoUncertainCount+=values[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovered=await admin.from("policy_intake_ai_icici_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovered.error)break;
      for(const attempt of recovered.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  // A separately reconciled Go Digit source supersedes only its ORIGINAL
  // uncertain display count. Never hide an unresolved uncertain record.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_reconciled_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(r=>!r.error)){
      const n=counts.map(r=>r.count??0);
      autoUncertainCount=Math.max(0,autoUncertainCount-n.reduce((a,b)=>a+b,0));
      autoClaimedCount+=n[0];
      autoBookedCount+=n[1];
      autoReviewCount+=n[2];
      autoUncertainCount+=n[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_reconciled_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break;
      for(const attempt of recovery.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  // The UIIC tractor recovery supersedes exactly one original terminal
  // uncertain booking result, without hiding any unresolved second outcome.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_uiic_tractor_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(r=>!r.error)){
      const n=counts.map(r=>r.count??0);
      autoUncertainCount=Math.max(0,autoUncertainCount-n.reduce((a,b)=>a+b,0));
      autoClaimedCount+=n[0];
      autoBookedCount+=n[1];
      autoReviewCount+=n[2];
      autoUncertainCount+=n[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_uiic_tractor_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break;
      for(const attempt of recovery.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  // Show the latest ICICI 1C79A4 one-time reconciliation result, if present.
  // Original uncertain history remains immutable; never suppress a second
  // uncertain outcome or claim an unbooked policy was completed.
  if(autoRequested&&autoLedgerAvailable){
    const states=["claimed","booked","review_required","uncertain"] as const;
    const counts=await Promise.all(states.map(state=>
      admin.from("policy_intake_ai_icici_uncertain_recovery_attempts")
        .select("intake_id",{count:"exact",head:true}).eq("state",state)));
    if(counts.every(r=>!r.error)){
      const n=counts.map(r=>r.count??0);
      autoUncertainCount=Math.max(0,autoUncertainCount-n.reduce((a,b)=>a+b,0));
      autoClaimedCount+=n[0];
      autoBookedCount+=n[1];
      autoReviewCount+=n[2];
      autoUncertainCount+=n[3];
    }
  }
  if(autoRequested&&autoLedgerAvailable&&workspaceRows.length){
    for(let offset=0;offset<workspaceRows.length;offset+=100){
      const recovery=await admin.from("policy_intake_ai_icici_uncertain_recovery_attempts")
        .select("intake_id,state,failure_code")
        .in("intake_id",workspaceRows.slice(offset,offset+100).map(row=>row.id));
      if(recovery.error)break;
      for(const attempt of recovery.data??[]){
        bookingAttemptByIntake.set(attempt.intake_id,{
          state:attempt.state,failure_code:attempt.failure_code,
        });
      }
    }
  }
  const bulkCandidates = workspaceRows.filter(row => {
    const q=queue.get(row.id);
    return row.policy_type==="motor" && !duplicateIds.has(row.id)
      && (!autoRequested || row.assigned_to_profile_id===null)
      && !attemptedIds.has(row.id)
      && q?.state==="verified" && q.exception_codes.length===0;
  }).map(row=>({id:row.id,intake_number:row.intake_number}));
  // An explicit operator action can re-queue prior failed/exceptions for fresh
  // n8n validation. This is not conversion eligibility or permission to book.
  // Never include completed Intakes or canonical duplicates. Previously
  // unsupported/untrained queue rows can be explicitly retried after a parser is added.
  // The server action independently checks document identity, cooldown and authorization.
  const reprocessCandidates = workspaceRows.filter(row => {
    const q = queue.get(row.id);
    return row.policy_type === "motor" && !duplicateIds.has(row.id)
      && (q?.state === "exception" || q?.state === "failed" || q?.state === "unsupported");
  }).map(row => ({ id: row.id, intake_number: row.intake_number }));
  const requestedId = typeof params.intake_id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.intake_id)
    ? params.intake_id : null;
  const requestedRow = requestedId ? workspaceRows.find(row=>row.id===requestedId) : null;
  const rawView = params.view;
  const selectedView: OpenIntakeView = OPEN_INTAKE_VIEWS.some(v=>v.view===rawView)
    ? rawView as OpenIntakeView
    : requestedRow
      ? displayBucket(requestedRow) as OpenIntakeView
      : "action_required";
  const statusRows = selectedView==="all"
    ? workspaceRows.filter(row => displayBucket(row) !== "duplicate")
    : workspaceRows.filter(row => displayBucket(row) === selectedView);
  const targetIndex = requestedId ? statusRows.findIndex(row => row.id === requestedId) : -1;
  const wantedPage = targetIndex >= 0 ? Math.floor(targetIndex / PAGE_SIZE) + 1 : page;
  const safePage = Math.min(wantedPage, Math.max(1, Math.ceil(statusRows.length / PAGE_SIZE)));
  const viewLink=(view:OpenIntakeView, pageNumber?:number)=>
    "/development/ai-policy-onboarding?view="+view+(pageNumber?"&page="+pageNumber:"");
  const pageRows: SemiAutoIntakeRow[] = statusRows
    .slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    .map(row => ({
      id: row.id,
      intake_number: row.intake_number,
      status: row.status,
      policy_type: row.policy_type,
      lead_source_name: row.lead_source_name,
      customer_mobile: row.customer_mobile,
      ocr_status: row.ocr_status,
      ocr_fields: Array.isArray(row.ocr_fields) ? row.ocr_fields : [],
      created_at: row.created_at,
      assigned_to_profile_id: row.assigned_to_profile_id,
      intake_bucket: displayBucket(row),
      is_duplicate: policyIntakeBucket(row, duplicateIds.has(row.id)) === "duplicate",
      n8n_enabled: semiAutoN8nEnabledForIntake(row.id),
      ai_state: queue.get(row.id)?.state ?? null,
      ai_booking_state:bookingAttemptByIntake.get(row.id)?.state??null,
      ai_booking_failure_code:bookingAttemptByIntake.get(row.id)?.failure_code??null,
      // A duplicate is derived from its OCR policy number. The raw database
      // row has no is_duplicate property, so NEVER read row.is_duplicate here.
      ai_exceptions: policyIntakeBucket(row, duplicateIds.has(row.id)) === "duplicate"
        ? [...new Set(["duplicate_policy",...(queue.get(row.id)?.exception_codes??[])])]
        : queue.get(row.id)?.exception_codes??[],
      ai_processed_at: queue.get(row.id)?.processed_at ?? null,
      ai_diagnostic_code: queue.get(row.id)?.diagnostic_code ?? null,
      ai_source_verified: queue.get(row.id)?.source_verified ?? false,
    }));
  // Historical bulk conversion failures stored only a generic code.
  // Explain a hold from verified current-document OCR, saved draft and
  // existing customer/vehicle master records. Display-only, no mutations.
  const legacyRows=pageRows.filter(row=>!row.is_duplicate
    &&row.ocr_status==="completed"
    &&row.ai_state==="exception"
    &&row.ai_exceptions?.length===1
    &&row.ai_exceptions[0]==="booking_review_required"
    &&Boolean(queue.get(row.id)?.document_id));
  if(legacyRows.length){
    const ids=legacyRows.map(row=>row.id);
    const [dr,documents]=await Promise.all([
      admin.from("policy_intake_onboarding_drafts")
        .select("intake_id,draft_payload").in("intake_id",ids),
      admin.from("policy_intake_documents")
        .select("intake_id,id").in("intake_id",ids).eq("is_current",true),
    ]);
    if(!dr.error&&!documents.error){
      const current=new Map((documents.data??[]).map(d=>[d.intake_id,d.id]));
      const drafts=new Map((dr.data??[]).map(d=>[d.intake_id,
        d.draft_payload as {insuredName?:string;chassisNo?:string}]));
      const candidates=legacyRows.filter(row=>current.get(row.id)===queue.get(row.id)?.document_id
        &&drafts.has(row.id));
      const chassis=[...new Set(candidates.map(row=>drafts.get(row.id)?.chassisNo?.trim()??"")
        .filter(value=>value.length>=8&&value.length<=24))];
      const vehicles=chassis.length
        ?await admin.from("vehicles").select("chassis_no,customer_id").in("chassis_no",chassis)
        :{data:[],error:null};
      if(!vehicles.error){
        const linkedIds=[...new Set((vehicles.data??[]).map(v=>v.customer_id).filter(Boolean))];
        const owners=linkedIds.length
          ?await admin.from("customers").select("id,contact_name,company_name,phone").in("id",linkedIds)
          :{data:[],error:null};
        if(!owners.error){
          const byChassis=new Map<string,typeof vehicles.data>();
          for(const vehicle of vehicles.data??[]){
            const found=byChassis.get(vehicle.chassis_no)??[];
            byChassis.set(vehicle.chassis_no,[...found,vehicle]);
          }
          const byId=new Map((owners.data??[]).map(owner=>[owner.id,owner]));
          for(const row of candidates){
            const draft=drafts.get(row.id);
            const saved=row.ocr_fields?.find(field=>field.key==="insured_name")?.value?.trim()??"";
            const linked=byChassis.get(draft?.chassisNo?.trim()??"")??[];
            // Multiple matching vehicle masters are ambiguous, never guess.
            const owner=linked.length===1?byId.get(linked[0].customer_id):null;
            row.ai_legacy_review_hint=inferLegacyAiReviewReason({
              sourceInsuredName:saved,draftInsuredName:draft?.insuredName??"",
              intakeMobile:row.customer_mobile,
              hasCurrentVehicle:linked.length===1&&Boolean(owner),
              currentVehicleOwnerName:owner?.company_name||owner?.contact_name,
              currentVehicleOwnerMobile:owner?.phone,
            });
          }
        }
      }
    }
  }
  return (
    <AppShell title="AI Policy Studio">
      <main className="mx-auto max-w-[1560px] space-y-2 pb-4">
        <header className="relative overflow-hidden rounded-xl border border-[#253c5b] bg-[#101f36] px-4 py-3 text-white shadow-sm">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/3 opacity-30"
            style={{backgroundImage:"linear-gradient(90deg,transparent,#102c4b),repeating-linear-gradient(90deg,transparent 0,transparent 19px,#4fb6d5 20px),repeating-linear-gradient(0deg,transparent 0,transparent 19px,#4fb6d5 20px)"}}/>
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#4b789a] bg-[#213d5b] text-base font-bold text-[#8ce2ee]">AI</div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[.19em] text-[#8fc5d9]">INSUREIT / Policy intelligence</p>
                <h1 className="text-[18px] font-semibold tracking-tight">AI Policy Studio</h1>
                <p className="text-[10px] text-[#b6c9d9]">Extract · verify · review · onboard — human approval for every registration</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#45627e] bg-[#1c344f] px-3 text-[10px] font-semibold text-[#c1d7e5]">
                <span aria-hidden="true" className={queueActive ? "h-1.5 w-1.5 rounded-full bg-[#65dec4]" : "h-1.5 w-1.5 rounded-full bg-amber-300"}/>
                {queueActive ? "n8n queue enabled" : primaryN8n ? "n8n review mode" : "AI review unavailable"}
              </span>
              <Link href="/policy-intakes" className="inline-flex h-8 items-center rounded-md border border-[#607a97] bg-white px-3 text-[10px] font-bold text-[#163a5b] hover:bg-[#f0f7ff]">Policy Intake Register</Link>
            </div>
          </div>
        </header>
        {unavailable ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[12px] font-semibold text-rose-800">
            Existing Policy Intakes could not be loaded. Refresh this page or contact your administrator.
          </div>
        ) : (
          <>
            <nav className="flex flex-wrap items-center gap-1 rounded-lg border border-[#dae5ef] bg-white px-2 py-2" aria-label="Policy Intake workflow status filters">
               <span className="mr-2 px-1 text-[10px] font-bold text-[#566b82]">STATUS</span>
               {OPEN_INTAKE_VIEWS.map(item=>(
                 <Link key={item.view} href={viewLink(item.view)}
                   aria-current={selectedView===item.view ? "page" : undefined}
                   className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10.5px] font-semibold transition-colors ${selectedView===item.view?"bg-[#153454] text-white":"text-[#47627f] hover:bg-[#ecf3fa]"}`}>
                   {item.label} <span className={`rounded px-1.5 py-0.5 text-[9px] tabular-nums ${selectedView===item.view?"bg-[#315575]":"bg-[#edf2f8]"}`}>{intakeCounts[item.view as IntakeStatusBucket]}</span>
                 </Link>
               ))}
               <span className="ml-auto px-1 text-[10px] text-[#72849a]">{total} open Intakes</span>
             </nav>
             <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dae5ef] bg-white px-3 py-2 text-[10.5px] text-[#52657f]">
               <span><strong className="text-[#163b61]">{statusRows.length}</strong> records in {OPEN_INTAKE_VIEWS.find(v=>v.view===selectedView)?.label} · Page {safePage} / {Math.max(1, Math.ceil(statusRows.length / PAGE_SIZE))}</span>
               <div className="flex items-center gap-2">
                 <span className="mr-1 text-[#8392a5]">{PAGE_SIZE} per page</span>
                 {safePage > 1 ? <Link href={viewLink(selectedView,safePage - 1)} className="rounded-md border border-[#cad9e8] px-3 py-1 font-bold text-[#204b78]">Previous</Link> : null}
                 {safePage * PAGE_SIZE < statusRows.length ? <Link href={viewLink(selectedView,safePage + 1)} className="rounded-md border border-[#cad9e8] px-3 py-1 font-bold text-[#204b78]">Next</Link> : null}
               </div>
             </div>
             <SemiAutoPolicyWorkspace rows={pageRows} profileId={profile.id} primaryN8n={primaryN8n}
              queueActive={queueActive} queueCounts={queueCounts} bulkCandidates={bulkCandidates} reprocessCandidates={reprocessCandidates}
              autoBooking={{enabled:autoRequested&&autoLedgerAvailable,configured:autoRequested,ledgerAvailable:autoLedgerAvailable,
                pending:autoLedgerAvailable?bulkCandidates.length:0,claimed:autoClaimedCount,booked:autoBookedCount,
                review:autoReviewCount,uncertain:autoUncertainCount}}
              initialIntakeId={requestedId && pageRows.some(row => row.id === requestedId) ? requestedId : null} />
                      </>
        )}
      </main>
    </AppShell>
  );
}
