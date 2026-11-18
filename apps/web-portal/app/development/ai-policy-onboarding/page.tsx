import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { SemiAutoPolicyWorkspace, type SemiAutoIntakeRow } from "@/components/development/semi-auto-policy-workspace";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { policyIntakeBucket, policyIntakeStatusCounts, type IntakeStatusBucket } from "@/lib/policy-intake-status-buckets";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { isN8nWorkbenchPrimary, semiAutoN8nEnabledForIntake } from "@/lib/policy-intake-semi-auto-n8n";
import type { PolicyIntakeOcrField } from "@/lib/policy-intake-ocr-service";
import { aiQueueEnabled, loadAiQueueDisplay } from "@/lib/ai-policy-onboarding-queue-server";

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
  const duplicateIds = duplicates?.ok ? new Set(duplicates.matches.keys()) : new Set<string>();
  // Every open Motor Intake appears, including duplicates and unfinished OCR.
  // Duplicate status is display-only: normal edit/booking still uses independent
  // canonical authorization, duplicate detection and readiness checks.
  const workspaceRows = !unavailable && duplicates?.ok ? candidates : [];
  // The Policy Intake Register uses this exact bucketing function across
  // the entire authorized result set, BEFORE search/status/page filters.
  // Duplicates are a distinct derived status and must not inflate the Action
  // Required or In Review tabs. These open-only counts intentionally exclude
  // rejected/completed Intakes visible in the full register.
  const intakeCounts = policyIntakeStatusCounts(workspaceRows,duplicateIds);
  const duplicateCount = intakeCounts.duplicate;
  const total = intakeCounts.all;
  const queueActive = primaryN8n && aiQueueEnabled();
  const queue = queueActive ? await loadAiQueueDisplay(workspaceRows.map(row=>row.id)) : new Map();
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
  const bulkCandidates = workspaceRows.filter(row => {
    const q=queue.get(row.id);
    return row.policy_type==="motor" && !duplicateIds.has(row.id)
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
      ? policyIntakeBucket(requestedRow,duplicateIds.has(requestedRow.id)) as OpenIntakeView
      : "action_required";
  const statusRows = selectedView==="all" ? workspaceRows : workspaceRows.filter(row=>
    policyIntakeBucket(row,duplicateIds.has(row.id)) === selectedView);
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
      intake_bucket: policyIntakeBucket(row, duplicateIds.has(row.id)),
      is_duplicate: policyIntakeBucket(row, duplicateIds.has(row.id)) === "duplicate",
      n8n_enabled: semiAutoN8nEnabledForIntake(row.id),
      ai_state: queue.get(row.id)?.state ?? null,
      // A duplicate is derived from its OCR policy number. The raw database
      // row has no is_duplicate property, so NEVER read row.is_duplicate here.
      ai_exceptions: policyIntakeBucket(row, duplicateIds.has(row.id)) === "duplicate"
        ? [...new Set(["duplicate_policy",...(queue.get(row.id)?.exception_codes??[])])]
        : queue.get(row.id)?.exception_codes??[],
      ai_field_keys: queue.get(row.id)?.field_keys ?? [],
      ai_processed_at: queue.get(row.id)?.processed_at ?? null,
    }));
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
                {queueActive ? "n8n queue enabled" : primaryN8n ? "n8n review mode" : "Manual review"}
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
              initialIntakeId={requestedId && pageRows.some(row => row.id === requestedId) ? requestedId : null} />
                      </>
        )}
      </main>
    </AppShell>
  );
}
