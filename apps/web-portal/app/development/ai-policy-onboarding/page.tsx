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
const PAGE_SIZE = 75;
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
  // Never include completed Intakes, canonical duplicates or untrained parsers.
  const reprocessCandidates = workspaceRows.filter(row => {
    const q = queue.get(row.id);
    return row.policy_type === "motor" && !duplicateIds.has(row.id)
      && (q?.state === "exception" || q?.state === "failed");
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
      ai_processed_at: queue.get(row.id)?.processed_at ?? null,
    }));
  return (
    <AppShell title="AI Policy Onboarding">
      <main className="mx-auto max-w-[1500px] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#d7e3f2] bg-white p-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#446ca4]">Development / {primaryN8n ? "All open Intakes" : "Motor policies"}</p>
            <h1 className="mt-1 text-[19px] font-bold tracking-tight text-[#122b4a]">{primaryN8n ? "AI Policy Onboarding · n8n primary" : "Semi-Automated Policy Onboarding"}</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#54667e]">
              {primaryN8n
                ? queueActive
                  ? "The server-only queue processes current PDF revisions with n8n automatically. Open each exception to review its next action. Booking remains locked until canonical preflight and exception resolution are verified."
                  : "n8n is the primary extraction engine for this workbench. The unattended processing queue is not enabled yet; selecting an Intake still runs the current read-only n8n preview. No policies are booked automatically."
                : "Select an existing Policy Intake to run a read-only eligibility check. Correct individual errors in its saved onboarding draft. Verified policies can then be booked through the existing transactional workflow with your explicit confirmation."}
            </p>
          </div>
          <Link href="/policy-intakes" className="inline-flex h-9 items-center rounded-lg border border-[#c9d7e8] px-3 text-[11px] font-semibold text-[#183b66]">Policy Intake Register</Link>
        </div>
        {unavailable ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[12px] font-semibold text-rose-800">
            Existing Policy Intakes could not be loaded. Refresh this page or contact your administrator.
          </div>
        ) : (
          <>
            <nav className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#dce5f0] bg-white px-3 py-3" aria-label="Policy Intake workflow status filters">
              <span className="mr-1 text-[10px] font-bold text-[#415b7c]">Intake status</span>
              {OPEN_INTAKE_VIEWS.map(item=>(
                <Link key={item.view} href={viewLink(item.view)}
                  aria-current={selectedView===item.view ? "page" : undefined}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-[10px] font-semibold ${selectedView===item.view?"border-[#17365d] bg-[#17365d] text-white":"border-[#d5dfeb] bg-white text-[#375474] hover:bg-[#f5f8fd]"}`}>
                  {item.label} <span className="tabular-nums opacity-80">{intakeCounts[item.view as IntakeStatusBucket]}</span>
                </Link>
              ))}
              <span className="ml-auto text-[9px] text-[#6d7f98]">Same status rules as Policy Intake Register · duplicate items excluded from Action Required and In Review</span>
            </nav>
            <SemiAutoPolicyWorkspace rows={pageRows} profileId={profile.id} primaryN8n={primaryN8n}
              queueActive={queueActive} queueCounts={queueCounts} bulkCandidates={bulkCandidates} reprocessCandidates={reprocessCandidates}
              initialIntakeId={requestedId && pageRows.some(row => row.id === requestedId) ? requestedId : null} />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e0e6ed] bg-white px-4 py-3 text-[11px] text-[#52657f]">
              <span>{statusRows.length} in {OPEN_INTAKE_VIEWS.find(v=>v.view===selectedView)?.label} · {total} open {primaryN8n ? "Policy" : "Motor"} Intake(s) · {duplicateCount} open duplicate(s) · page {safePage} of {Math.max(1, Math.ceil(statusRows.length / PAGE_SIZE))}</span>
              <div className="flex items-center gap-2">
                {safePage > 1 ? <Link href={viewLink(selectedView,safePage - 1)} className="rounded-lg border border-[#d9e2ed] px-3 py-1.5 font-semibold">Previous</Link> : null}
                {safePage * PAGE_SIZE < statusRows.length ? <Link href={viewLink(selectedView,safePage + 1)} className="rounded-lg border border-[#d9e2ed] px-3 py-1.5 font-semibold">Next</Link> : null}
              </div>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
