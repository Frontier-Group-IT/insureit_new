"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IntakeStatusBucket } from "@/lib/policy-intake-status-buckets";
import { hasVerifiedN8nParserEvidence } from "@/lib/ai-policy-onboarding-eligibility";
import { AlertCircle, ArrowUpRight, CheckCircle2, ClipboardCheck, FileSearch, Loader2, PencilLine, RefreshCw, Search, ShieldAlert, Sparkles, Eye, RotateCcw, ArrowRight, X } from "lucide-react";
import { applySemiAutoN8nIntake, bookSemiAutoIntake, convertVerifiedAiIntake, checkSemiAutoIntake, continueVerifiedN8nIntakeToOnboarding, editSemiAutoIntake, previewSemiAutoN8nIntake, reprocessAiPolicyIntake, reparseAndReplaceAiPolicyIntakeDraft, reviewAiIntakeCustomerCandidates, reviewIciciVerifiedDraftRepair, applyReviewedIciciDraftRepair, transferFailedAiIntakeToManual, type ReviewedIciciDraftComparison, type AiCustomerCandidateReview, type SemiAutoActionResult, type SemiAutoN8nResult } from "@/app/development/ai-policy-onboarding/actions";

export type SemiAutoIntakeRow = {
  id: string;
  intake_number: string;
  status: string;
  policy_type: string | null;
  lead_source_name: string;
  customer_mobile: string;
  ocr_status: string;
  // Historical OCR is display-only, never authoritative n8n verification.
  ocr_fields?: Array<{key:string;label:string;value:string;page?:number|null;evidence?:string|null}> | null;
  created_at: string;
  assigned_to_profile_id: string | null;
  n8n_enabled?: boolean;
  is_duplicate?: boolean;
  intake_bucket?: Exclude<IntakeStatusBucket, "all">;
  ai_state?: "pending" | "processing" | "exception" | "verified" | "unsupported" | "failed" | null;
  ai_exceptions?: string[];
  ai_processed_at?: string | null;
  ai_diagnostic_code?: string | null;
};

const aiIssueTitles: Record<string,string> = {
  unsupported_layout:"Parser not trained",
  document_missing:"Current policy PDF missing",
  extraction_pending:"Waiting for n8n",
  extraction_failed:"n8n extraction failed",
  unverified_parser:"Parser checks need review",
  registration_pending_review:"Confirm unregistered vehicle / RTO prefix",
  duplicate_policy:"Duplicate policy detected",
  reviewer_conflict:"Reviewer or review status conflict",
  customer_identity:"Same mobile / different insured",
  customer_ambiguous:"Multiple customer matches",
  customer_duplicate:"Existing customer needs confirmation",
  customer_master_unverified:"Customer matching not verified",
  customer_creation_required:"Create or select customer",
  vehicle_ownership:"Vehicle ownership conflict",
  missing_field:"Mandatory field missing",
  manufacturer_unmatched:"Vehicle make not matched",
  financial_reconciliation:"Premium mismatch",
  issuance_date_unverified:"Policy issue date needs review",
  date_approval:"Email OTP date approval",
  bundled_validity:"OD/TP/CPA validity review",
  coverage_conflict:"Policy coverage conflict",
  draft_conflict:"Saved field differs from PDF",
  preflight_pending:"Canonical booking preflight pending",
  booking_review_required:"Bulk booking requires manual review",
  stale_document:"Source PDF changed",
};
/** Saved OCR offers diagnostics only; source PDF and canonical checks remain authoritative. */
function commercialBookingIssue(row:SemiAutoIntakeRow,code:string):
  {title:string;detail:string}|null {
  const values=new Map((row.ocr_fields??[]).map(f=>[f.key,f.value?.trim()??""]));
  const insurer=values.get("insurer_name")??"";
  if(/New India Assurance/i.test(insurer) && code==="coverage_conflict"){
    return {title:"Active policy already exists for this chassis",
      detail:"The verified PDF refers to a chassis already linked to an active policy with overlapping cover dates. Compare the prior Policy Register record and resolve its coverage or replacement status before registering another policy. Reprocessing the same PDF will not remove this conflict."};
  }
  if(/New India Assurance/i.test(insurer) && ["booking_review_required","missing_field"].includes(code)){
    const rawRto=values.get("vehicle_rto_name")??"";
    const missingRto=!rawRto||/^FASTag ID:$/i.test(rawRto);
    const title=missingRto?"NIA PDF verified · provisional RTO pending":"NIA policy · canonical booking review";
    const issues=[
      ...(missingRto?["The policy does not print a registration authority. Reparse the current PDF to obtain a labelled provisional issuing-office city where supported. CPA may legitimately be zero."]:[]),
    ];
    return {title,detail:issues.length?issues.join(" "):"NIA extraction passed, but commercial-policy booking remains review-controlled. Check identity, premium components, tax and canonical preflight."};
  }
  if(/Go Digit General Insurance/i.test(insurer) && code==="missing_field"
      && !values.get("vehicle_manufacturing_year")){
    return {title:"Go Digit · manufacturing year unavailable",
      detail:"The current PDF prints separate registration/manufacturing values. The configured operational rule now permits the printed registration year to fill an absent manufacturing year, labelled as a fallback. Reparse the current PDF; if registration-year evidence is missing or conflicts, use verified RC evidence."};
  }
  return null;
}

// Only a confirmed single-intake retry is offered for booking-review or
// provisional-RTO holds. The server checks actual trained parser identity,
// source PDF/fingerprint, and insurer eligibility before any booking.
function canRetryReviewHeldPolicy(row:SemiAutoIntakeRow):boolean {
  return !row.is_duplicate&&row.ai_state==="exception"
    &&row.ai_exceptions?.length===1
    &&["booking_review_required","registration_pending_review"].includes(row.ai_exceptions[0]);
}
const aiStateLabel: Record<string,string> = {
  pending:"Queued",processing:"Reading PDF",exception:"Needs action",
  verified:"Extracted · booking preflight pending",unsupported:"Not trained",
  failed:"Retry scheduled",duplicate:"Duplicate · skipped",
};

function parserDiagnostic(code:string|null|undefined): {title:string;detail:string;checks:string[]} | null {
  if(!code)return null;
  const checkPrefix="n8n_failed_checks__";
  if(code.startsWith(checkPrefix)){
    const checks=code.slice(checkPrefix.length).split("__").filter(Boolean)
      .map(value=>value.replaceAll("_"," "));
    return {title:"PDF verification failed",detail:"The commercial reader ran but rejected these checks. Inspect the matching fields and source layout in n8n. No policy was booked.",checks};
  }
  const descriptions:Record<string,string>={
    nia_missing_rto_authority_and_cpa:"Historical NIA exception: the older system blocked missing registration authority and zero CPA. Zero CPA is now allowed; reparse this PDF to refresh the provisional RTO.",
    nia_missing_registration_authority:"NIA PDF does not print a usable registration authority. The old FASTag ID parser match has been removed. Verify the actual RTO city/code from trusted registration evidence.",
    nia_missing_verified_gcv_cpa:"Historical NIA CPA hold: GCV owner-driver CPA is optional. Do not invent CPA; reparse the PDF to refresh review status.",
    go_digit_missing_verified_manufacturing_year:"The earlier Go Digit extraction had no manufacturing year or accepted registration-year fallback. Reparse the current policy PDF to apply the registration-year fallback rule; a missing or conflicting year will still require review.",
    go_digit_missing_verified_onboarding_fields:"Go Digit PDF is verified but does not independently provide all mandatory canonical policy fields. Review the listed missing vehicle or policy fields before booking.",
    existing_active_policy_overlap:"This is a canonical vehicle-history conflict, not an OCR failure. An active policy on this chassis overlaps the New India policy's dates. Review the existing policy and resolve its status before booking. Do not rerun n8n or create a duplicate vehicle.",
    n8n_review_required:"The n8n output failed the expected parser contract. This legacy code does not identify which check failed; run a fresh reparse to obtain the new diagnostics.",
    n8n_commercial_classifier_missed_layout:"The shared n8n webhook returned a commercial parser response, but the website routed it through ICICI validation. Inspect the commercial PDF recognition rule.",
    n8n_nontata_verification_failed:"Commercial parser validation failed, but individual failing checks were not retained in this older result. Reparse to capture them.",
    n8n_nontata_financial_reconciliation_failed:"Printed OD, TP, net, GST or gross amounts did not reconcile. Compare the extracted totals with the policy PDF.",
    n8n_nontata_required_field_missing:"The commercial parser response omitted a mandatory policy, insured, vehicle, date or premium field.",
    n8n_nontata_check_set_invalid:"The commercial parser returned an unexpected set of verification checks.",
    n8n_nontata_date_invalid:"The printed policy date did not pass strict calendar validation.",
    n8n_nontata_registered_plate_invalid:"The verified registration status and printed vehicle registration number do not agree.",
    n8n_nontata_pdf_download_failed:"n8n could not retrieve the current private policy PDF.",
    n8n_bridge_http_failure_404:"The configured n8n webhook was not found. Check workflow publication and path.",
    n8n_bridge_http_failure_401:"The n8n webhook rejected authentication."
  };
  return {title:code==="existing_active_policy_overlap"?"Existing active policy":"Extraction diagnostic",detail:descriptions[code]??"n8n returned a failure code. Open the current workflow execution and inspect its rejected checks or document stage.",checks:[]};
}

const humanStatus: Record<string, string> = {
  ready_for_review: "Ready for Review", in_review: "In Review",
  needs_attention: "Needs Attention", processing: "Processing",
};

function compactDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "-" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

const rupees = (amount: number) => "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });

// The origin is a fixed UI marker, never a caller-supplied redirect URL.
function studioOnboardingUrl(editUrl: string): string {
  if (!editUrl.startsWith("/policies/new?")) return editUrl;
  return editUrl + (editUrl.includes("origin=") ? "" : "&origin=ai_studio");
}

export function SemiAutoPolicyWorkspace({ rows, profileId, initialIntakeId, primaryN8n = false,
  queueActive = false, queueCounts, bulkCandidates = [], reprocessCandidates = [] }: {
  rows: SemiAutoIntakeRow[]; profileId: string; initialIntakeId?: string | null;
  primaryN8n?: boolean;
  queueActive?: boolean;
  bulkCandidates?: Array<{id:string;intake_number:string}>;
  reprocessCandidates?: Array<{id:string;intake_number:string}>;
  queueCounts?: {eligible:number;extracted:number;duplicates:number;queued:number;extracting:number;exceptions:number;unprocessed:number;unsupported:number;failed:number};
}) {
  const router = useRouter();
  const requestId = useRef(0);
  // Match Policy Intake Register: refresh on page focus and periodically
  // while visible, without changing the selected server-side status view.
  useEffect(()=>{
    const onFocus=()=>{if(document.visibilityState==="visible")router.refresh();};
    const timer=window.setInterval(onFocus,60_000);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);
    };
  },[router]);
  const [search, setSearch] = useState("");
  // Direct ?intake_id= links are resolved against the authorized server list.
  // Selection itself never sends the PDF or creates a policy.
  const [selectedId, setSelectedId] = useState<string | null>(initialIntakeId ?? null);
  const [result, setResult] = useState<SemiAutoActionResult | null>(null);
  const [busy, setBusy] = useState<"checking" | "booking" | "editing" | "extracting" | "applying" | "forwarding" | null>(null);
  const [n8nResult, setN8nResult] = useState<SemiAutoN8nResult | null>(null);
  const [n8nNotice, setN8nNotice] = useState<string | null>(null);
  const [done, setDone] = useState<{ policyCode: string; policyId: string } | null>(null);
  const [exceptionRow,setExceptionRow]=useState<SemiAutoIntakeRow|null>(null);
  const [processingOpen,setProcessingOpen]=useState(false);
  const [manualTransferRow,setManualTransferRow]=useState<SemiAutoIntakeRow|null>(null);
  const [manualTransferReason,setManualTransferReason]=useState("");
  const [manualTransferError,setManualTransferError]=useState<string|null>(null);
  const [manualTransferBusy,setManualTransferBusy]=useState(false);
  const [autoConvertRow,setAutoConvertRow]=useState<SemiAutoIntakeRow|null>(null);
  const [autoConvertMessage,setAutoConvertMessage]=useState<string|null>(null);
  const [bulkConfirmOpen,setBulkConfirmOpen]=useState(false);
  const [bulkRunning,setBulkRunning]=useState(false);
  const [bulkAttemptedIds,setBulkAttemptedIds]=useState<string[]>([]);
  const [bulkProgress,setBulkProgress]=useState<{done:number;total:number}|null>(null);
  const [bulkStoppedReason,setBulkStoppedReason]=useState<string|null>(null);
  const [bulkResults,setBulkResults]=useState<Array<{id:string;intake_number:string;ok:boolean;message:string}>>([]);
  const [reprocessConfirmOpen,setReprocessConfirmOpen]=useState(false);
  const [reprocessRunning,setReprocessRunning]=useState(false);
  const reprocessCancelRef=useRef(false);
  const [reprocessProgress,setReprocessProgress]=useState<{done:number;total:number}|null>(null);
  const [reprocessStopped,setReprocessStopped]=useState(false);
  const [reprocessAttemptedIds,setReprocessAttemptedIds]=useState<string[]>([]);
  const [reprocessResults,setReprocessResults]=useState<Array<{id:string;intake_number:string;ok:boolean;message:string}>>([]);
  const [customerReview,setCustomerReview]=useState<AiCustomerCandidateReview|null>(null);
  const [reviewingCustomer,setReviewingCustomer]=useState(false);
  const [queueRetrying,setQueueRetrying]=useState(false);
  const [queueRetryError,setQueueRetryError]=useState<string|null>(null);
  const [replaceReparseId,setReplaceReparseId]=useState<string|null>(null);
  const [replaceReparseError,setReplaceReparseError]=useState<string|null>(null);
  const [replaceReparseErrorId,setReplaceReparseErrorId]=useState<string|null>(null);
  const [draftReview,setDraftReview]=useState<ReviewedIciciDraftComparison|null>(null);
  const [draftReviewBusy,setDraftReviewBusy]=useState(false);
  const [draftApplyBusy,setDraftApplyBusy]=useState(false);
  const [draftReviewMessage,setDraftReviewMessage]=useState<string|null>(null);
  const [takeover, setTakeover] = useState<{ intakeId: string; reviewerName: string } | null>(null);
  const [fillEmptySavedFields, setFillEmptySavedFields] = useState(true);
  const [approveSigningDate,setApproveSigningDate]=useState(false);
  const [handoffDialog, setHandoffDialog] = useState<
    | { kind: "confirm" | "takeover"; intakeId: string; documentId: string; fingerprint: string; reviewerName?: string }
    | { kind: "existing"; editUrl: string }
    | null
  >(null);
  async function reparseAndReplace(row:SemiAutoIntakeRow){
    setReplaceReparseId(row.id);setReplaceReparseError(null);setReplaceReparseErrorId(null);
    try{
      const response=await reparseAndReplaceAiPolicyIntakeDraft(row.id);
      if(!response.ok){setReplaceReparseErrorId(row.id);setReplaceReparseError(response.error??"Could not reparse this Intake.");return;}
      setExceptionRow(null);setReplaceReparseError(null);
      router.push(studioOnboardingUrl(response.editUrl??("/policies/new?intake_id="+encodeURIComponent(row.id))));
    }catch{setReplaceReparseErrorId(row.id);setReplaceReparseError("The reparse result is unknown. Refresh this Intake before trying again.");}
    finally{setReplaceReparseId(null);}
  }
  const selected = rows.find(row => row.id === selectedId);
  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(row => [row.intake_number, row.lead_source_name, row.customer_mobile, row.status, row.ocr_status].join(" ").toLowerCase().includes(query));
  }, [rows, search]);
  const available = !primaryN8n && selected?.policy_type === "motor"
    && result?.ready === true && result.issues.length === 0 && !selected?.is_duplicate;
  const n8nEnabled = selected?.n8n_enabled === true;
  const isWaiting = busy !== null || bulkRunning || reprocessRunning || manualTransferBusy;
  // A bounded set of currently verified CANDIDATES. Server-side canonical
  // authorization and PDF reconciliation can still reject any candidate.
  const bulkRemaining=bulkCandidates.filter(row=>!bulkAttemptedIds.includes(row.id));
  const bulkBatch=bulkRemaining.slice(0,10);
  const reprocessRemaining=reprocessCandidates.filter(row=>!reprocessAttemptedIds.includes(row.id));
  // Reprocess is unbounded by UI batch size, but every Intake is checked
  // sequentially through the same server-side authorization and queue CAS.
  const reprocessBatch=reprocessRemaining;

  async function selectRow(id: string) {
    const next = ++requestId.current;
    if (selectedId === id) {
      setSelectedId(null); setResult(null); setDone(null); setBusy(null); setTakeover(null); setHandoffDialog(null); setN8nResult(null); setN8nNotice(null); return;
    }
    setSelectedId(id); setResult(null); setDone(null); setTakeover(null); setHandoffDialog(null); setN8nResult(null); setN8nNotice(null); setBusy(primaryN8n && queueActive ? null : primaryN8n ? "extracting" : "checking");
    try {
      if (primaryN8n) {
        // Background queue performs the initial extraction without user input.
        // Selecting a row is read-only; an explicit review may re-extract to
        // verify the exact live PDF before continuing to canonical onboarding.
        if (queueActive) {
          if (requestId.current === next) setN8nNotice(
            "Saved historical OCR is displayed below. Re-extract current PDF only when fresh n8n verification is required before onboarding."
          );
          return;
        }
        const extracted = await previewSemiAutoN8nIntake(id);
        if (requestId.current === next) setN8nResult(extracted);
        return;
      }
      const assessment = await checkSemiAutoIntake(id);
      if (requestId.current === next) setResult(assessment);
    } catch {
      if (requestId.current === next) {
        if (primaryN8n) setN8nResult({ ok: false, error: "The n8n extraction request failed. No old OCR fallback or policy update was attempted." });
        else setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Eligibility check", message: "The readiness check failed to contact the server. Refresh and try again." }] });
      }
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function retry() {
    if (!selectedId) return;
    const next = ++requestId.current;
    setResult(null); setBusy("checking");
    try {
      const assessment = await checkSemiAutoIntake(selectedId);
      if (requestId.current === next) setResult(assessment);
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Readiness check", message: "Could not verify the Intake. Please retry." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function previewN8n() {
    if (!selectedId || !n8nEnabled || isWaiting) return;
    const next = ++requestId.current;
    setBusy("extracting"); setN8nResult(null); setN8nNotice(null);
    try {
      const response = await previewSemiAutoN8nIntake(selectedId);
      if (requestId.current === next) setN8nResult(response);
    } catch {
      if (requestId.current === next) setN8nResult({
        ok: false, error: "The secured n8n preview could not be completed. Existing OCR and onboarding were not changed.",
      });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function applyN8n() {
    if (!selectedId || !n8nResult?.ok || !n8nResult.preview.canApply || isWaiting || primaryN8n) return;
    const confirmed = window.confirm(
      "Apply the reviewed n8n extraction to this failed OCR Intake? Confirm all proposed fields against the original PDF. This will replace only empty failed OCR data, change the Intake to Ready for Review, and will NOT create a customer, vehicle or policy. Normal draft correction and explicit booking approval remain mandatory.",
    );
    if (!confirmed) return;
    const next = ++requestId.current;
    setBusy("applying"); setN8nNotice(null);
    try {
      const response = await applySemiAutoN8nIntake(
        selectedId, n8nResult.preview.documentId, n8nResult.preview.fingerprint, true,
      );
      if (requestId.current !== next) return;
      if (response.ok) {
        setN8nResult(null);
        setN8nNotice("Validated OCR fields saved to this Intake. Review/correct the canonical draft and run Recheck. No policy has been booked.");
        setResult(await checkSemiAutoIntake(selectedId));
        router.refresh();
      } else {
        setN8nNotice(response.error ?? "The Intake has changed. Recheck before attempting to apply.");
        setN8nResult(null);
      }
    } catch {
      if (requestId.current === next) {
        setN8nResult(null);
        setN8nNotice("The save response was interrupted. Recheck the Intake and its original copy before attempting again.");
      }
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  // Show handoff on any extracted open Motor Intake. A click still fetches and
  // validates the CURRENT PDF before enabling the existing confirmation dialog.
  // Historical OCR or stale queue status is never a booking authorization.
  async function beginDirectN8nHandoff() {
    if (!primaryN8n || !selectedId || !selected || isWaiting || selected.is_duplicate
        || selected.policy_type !== "motor"
        || !["processing", "ready_for_review", "in_review"].includes(selected.status)
        || selected.ocr_status !== "completed") return;
    const id=selectedId, next=++requestId.current;
    setBusy("extracting"); setN8nNotice(null); setN8nResult(null);
    try {
      const fresh=await previewSemiAutoN8nIntake(id);
      if (requestId.current !== next) return;
      setN8nResult(fresh);
      if (!fresh.ok) {
        setN8nNotice("Fresh verification failed; the historical OCR remains visible. No onboarding draft was changed.");
      } else if (!hasVerifiedN8nParserEvidence(
        fresh.preview.parserId, fresh.preview.checksPassed, fresh.preview.warnings)) {
        setN8nNotice("The PDF needs review before onboarding. Check the latest n8n results and resolve any warnings.");
      } else {
        setFillEmptySavedFields(true);
        setApproveSigningDate(false);
        setHandoffDialog({kind:"confirm",intakeId:id,
          documentId:fresh.preview.documentId,fingerprint:fresh.preview.fingerprint});
      }
    } catch {
      if (requestId.current === next) setN8nNotice("The current PDF verification failed. Saved OCR remains unchanged; check n8n before retrying.");
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  function forwardN8nToOnboarding() {
    if (!primaryN8n || !selectedId || !selected || selected.policy_type !== "motor"
        || selected.is_duplicate || !["ready_for_review","in_review","processing"].includes(selected.status)
        || !n8nResult?.ok || !hasVerifiedN8nParserEvidence(
          n8nResult.preview.parserId,n8nResult.preview.checksPassed,n8nResult.preview.warnings)
        || isWaiting) return;
    // Only exact trained 13/18-check parser results with approved review
    // warnings may open a draft. Backend re-extracts and independently checks.
    // A local, accessible dialog replaces the browser-native confirmation.
    setFillEmptySavedFields(true);
    setApproveSigningDate(false);
    setHandoffDialog({
      kind: "confirm", intakeId: selectedId,
      documentId: n8nResult.preview.documentId, fingerprint: n8nResult.preview.fingerprint,
    });
  }

  async function confirmN8nHandoff() {
    const dialog = handoffDialog;
    if (!dialog) return;
    if (dialog.kind === "existing") {
      setHandoffDialog(null);
      router.push(studioOnboardingUrl(dialog.editUrl));
      return;
    }
    if (isWaiting || selectedId !== dialog.intakeId || !n8nResult?.ok
        || n8nResult.preview.documentId !== dialog.documentId
        || n8nResult.preview.fingerprint !== dialog.fingerprint) {
      setHandoffDialog(null);
      setN8nNotice("The selected Intake or extracted PDF changed. Run n8n again and review the latest result.");
      return;
    }
    const next = ++requestId.current;
    setBusy("forwarding");
    setHandoffDialog(null);
    setN8nNotice(null);
    try {
      const response = await continueVerifiedN8nIntakeToOnboarding(
        dialog.intakeId, dialog.documentId, dialog.fingerprint, true,
        dialog.kind === "takeover", fillEmptySavedFields,
        approveSigningDate && !n8nResult.preview.acceptedIssuanceDate
          && n8nResult.preview.issuanceEvidence ? {
          date:n8nResult.preview.issuanceEvidence.proposedDate,
          documentSha256:n8nResult.preview.issuanceEvidence.documentSha256,
          expectedDraftRevision:n8nResult.preview.savedDraftIssueDate?.revision??null,
          expectedPreviousDate:n8nResult.preview.savedDraftIssueDate?.value??null,
        }:undefined,
      );
      if (requestId.current !== next) return;
      if (response.assignmentConflict) {
        setHandoffDialog({ ...dialog, kind: "takeover", reviewerName: response.assignmentConflict.reviewerName });
      } else if (response.ok && response.editUrl) {
        if (response.existingDraft) {
          setHandoffDialog({ kind: "existing", editUrl: studioOnboardingUrl(response.editUrl) });
        } else {
          router.push(studioOnboardingUrl(response.editUrl));
        }
      } else {
        setN8nNotice(response.error ?? "The Intake could not be forwarded. Re-run n8n before trying again.");
      }
    } catch {
      if (requestId.current === next) setN8nNotice(
        "The handoff result could not be confirmed. Check the Intake and existing draft before retrying to avoid duplicate work."
      );
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function runConfirmedReprocess() {
    if (isWaiting || !primaryN8n || !queueActive || !reprocessConfirmOpen || !reprocessBatch.length) return;
    const batch=[...reprocessBatch];
    setReprocessConfirmOpen(false);
    setReprocessRunning(true);
    setReprocessResults([]);
    setReprocessProgress({done:0,total:batch.length});
    setReprocessStopped(false);
    reprocessCancelRef.current=false;
    // Each record is reauthorized and rechecked against current PDF, status
    // and canonical duplicates by the server action. No booking occurs.
    let completed=0;
    for (const item of batch) {
      if (reprocessCancelRef.current) {
        setReprocessStopped(true);
        break;
      }
      let ok=false;
      let message="Reprocessing could not be scheduled.";
      try {
        const response=await reprocessAiPolicyIntake(item.id);
        ok=response.ok;
        message=ok?"Queued for fresh n8n verification.":response.error??message;
      } catch {
        message="Queue request failed; check this Intake before retrying.";
      }
      setReprocessAttemptedIds(previous=>previous.includes(item.id)?previous:[...previous,item.id]);
      setReprocessResults(previous=>[...previous,{...item,ok,message}]);
      completed++;
      setReprocessProgress({done:completed,total:batch.length});
    }
    setReprocessRunning(false);
    router.refresh();
  }

  async function runConfirmedBulkConversion() {
    if (isWaiting || !primaryN8n || !queueActive || !bulkConfirmOpen || !bulkBatch.length) return;
    const batch=[...bulkBatch];
    setBulkConfirmOpen(false);
    setBulkRunning(true);
    setBusy("booking");
    setBulkProgress({done:0,total:batch.length});
    setBulkResults([]);
    setBulkStoppedReason(null);
    let completed=0;
    // Deliberately sequential: one canonical registration transaction at a time.
    // No optimistic booking or automatic retry following an ambiguous response.
    for (const item of batch) {
      let stopForServiceFailure=false;
      let outcome:{id:string;intake_number:string;ok:boolean;message:string};
      try {
        const result=await convertVerifiedAiIntake(item.id,true);
        // A shared upstream n8n failure must abort the batch immediately;
        // continuing would hold every healthy Intake for manual review.
        stopForServiceFailure=!result.ok && result.issues.some(issue=>
          issue.field==="Extraction" && /n8n/i.test(issue.message) && /HTTP|webhook|service|connection|rate.limit/i.test(issue.message));
        outcome={id:item.id,intake_number:item.intake_number,ok:result.ok&&Boolean(result.policyId),
          message:result.ok&&result.policyCode&&result.policyId
            ? "Registered "+result.policyCode
            : result.issues.map(issue=>issue.message).join(" ") || "Canonical verification stopped this policy."};
      } catch {
        // An interrupted booking response is also ambiguous. Stop the whole
        // batch rather than issue another policy booking request.
        stopForServiceFailure=true;
        outcome={id:item.id,intake_number:item.intake_number,ok:false,
          message:"Booking response was interrupted. Verify this Intake in Policy Register before retrying."};
      }
      // An attempted Intake will not be automatically attempted again in this
      // browser session, even when the network response is uncertain.
      setBulkAttemptedIds(previous=>previous.includes(item.id)?previous:[...previous,item.id]);
      setBulkResults(previous=>[...previous,outcome]);
      completed++;
      setBulkProgress({done:completed,total:batch.length});
      if(stopForServiceFailure){
        setBulkStoppedReason("Stopped after a shared n8n or interrupted response. The remaining "+(batch.length-completed)+" policies were NOT attempted. Investigate the webhook before another confirmed batch.");
        break;
      }
    }
    setBulkRunning(false);
    setBusy(null);
    router.refresh();
  }

  async function convertOneVerified() {
    const row=autoConvertRow;
    if(!row||isWaiting||row.is_duplicate||
      !((row.ai_state==="verified"&&!row.ai_exceptions?.length)||canRetryReviewHeldPolicy(row)))return;
    setBusy("booking");setAutoConvertMessage(null);
    try{
      const result=await convertVerifiedAiIntake(row.id,true);
      if(result.ok&&result.policyCode&&result.policyId){
        setDone({policyCode:result.policyCode,policyId:result.policyId});
        setAutoConvertMessage("Policy "+result.policyCode+" registered successfully through canonical onboarding.");
        setAutoConvertRow(null);
        router.refresh();
      }else{
        setAutoConvertMessage(result.issues.map(item=>item.message).join(" ")||"The canonical booking check needs review.");
        setAutoConvertRow(null);
        router.refresh();
      }
    }catch{
      setAutoConvertMessage("The booking response was interrupted. Check Policy Register before retrying; the policy may already be registered.");
      setAutoConvertRow(null);
    }finally{setBusy(null);}
  }

  async function book() {
    if (!selectedId || !available || isWaiting || primaryN8n) return;
    const accepted = window.confirm("Book this issued Motor Policy using the verified Intake and saved onboarding draft? Confirm that you checked the original PDF, particularly the Policy Issuance Date, insured identity, and premiums. This action creates a real policy; it cannot be undone from this page. Unverified pay-in and payout will remain for commercial review.");
    if (!accepted) return;
    const next = ++requestId.current;
    setBusy("booking"); setDone(null);
    try {
      const booking = await bookSemiAutoIntake(selectedId, true);
      if (requestId.current !== next) return;
      setResult(booking);
      if (booking.ok && booking.policyCode && booking.policyId) {
        setDone({ policyCode: booking.policyCode, policyId: booking.policyId });
        router.refresh();
      }
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Policy", field: "Booking status", message: "The booking response was interrupted. Check the Intake status and Policy Register before retrying to prevent a duplicate." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function correct() {
    if (!selectedId || isWaiting || primaryN8n) return;
    const next = ++requestId.current;
    setBusy("editing");
    try {
      const response = await editSemiAutoIntake(selectedId);
      if (requestId.current !== next) return;
      if (response.assignmentConflict) {
        // Do not silently change the current reviewer. Show the assignee's
        // name and ask for a separate, explicit takeover confirmation.
        setTakeover({ intakeId: selectedId, reviewerName: response.assignmentConflict.reviewerName });
      } else if (response.ok && response.editUrl) {
        router.push(studioOnboardingUrl(response.editUrl));
      } else {
        setResult(response);
      }
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Open onboarding draft", message: "The draft could not be opened. Try again from the standard Policy Intake Review page." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function confirmTakeover() {
    if (!takeover || isWaiting || takeover.intakeId !== selectedId) return;
    const intakeId = takeover.intakeId;
    const next = ++requestId.current;
    setTakeover(null);
    setBusy("editing");
    try {
      // The server verifies the current assignment, duplicate status and
      // authorized reviewer/finalizer rights again before claiming anything.
      const response = await editSemiAutoIntake(intakeId, true);
      if (requestId.current !== next) return;
      if (response.ok && response.editUrl) {
        router.push(studioOnboardingUrl(response.editUrl));
      } else {
        setResult(response);
      }
    } catch {
      if (requestId.current === next) setResult({
        ok: false, ready: false,
        issues: [{ section: "Intake", field: "Reviewer takeover", message: "Unable to take over and open this Intake. Recheck its assignment in the Policy Intake Review page." }],
      });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  useEffect(()=>{
    if (!reprocessConfirmOpen) return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setReprocessConfirmOpen(false);};
    document.addEventListener("keydown",onKey);
    return ()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",onKey);};
  },[reprocessConfirmOpen]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {primaryN8n && queueActive ? (
        <section aria-label="Automatic policy processing summary"
          className="rounded-xl border border-[#d3e3ef] bg-white px-3 py-2.5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles className="h-4 w-4 text-cyan-600"/> Processing overview</h2>
              
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={()=>setReprocessConfirmOpen(true)} disabled={isWaiting||reprocessBatch.length===0}
                className="min-h-9 rounded-lg border border-[#adc5e0] bg-white px-3 text-[11px] font-bold text-[#174b83] disabled:opacity-45">
                Reprocess All Previous · {reprocessRemaining.length}
              </button>
              <button type="button" onClick={()=>setBulkConfirmOpen(true)} disabled={isWaiting||bulkBatch.length===0}
                className="min-h-9 rounded-lg bg-[#174b83] px-3 text-[11px] font-bold text-white disabled:opacity-45">
                Convert Verified Candidates · {queueCounts?.eligible??0}
              </button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8">
            {[
              ["Not yet queued",queueCounts?.unprocessed??0],
              ["Queued for n8n",queueCounts?.queued??0],
              ["Reading PDF",queueCounts?.extracting??0],
              ["PDF extracted",queueCounts?.extracted??0],
              ["Actual exceptions",queueCounts?.exceptions??0],
              ["Duplicates skipped",queueCounts?.duplicates??0],
              ["Not trained",queueCounts?.unsupported??0],
              ["Retrying",queueCounts?.failed??0],
            ].map(([label,value])=>(
              <div key={String(label)} className="rounded-md border border-[#e9eff5] bg-[#f6f9fc] px-2.5 py-1.5">
                <p className="text-[9px] font-semibold text-[#6b7f99]">{label}</p>
                <p className="text-[16px] font-bold tabular-nums leading-5 text-[#1d3f67]">{value}</p>
              </div>
            ))}
          </div>
          
          {bulkProgress ? (
            <div role="status" className="mt-2 rounded-lg border border-[#cbd9ea] bg-[#f5f9ff] p-3 text-[11px] text-[#285078]">
              Bulk conversion: {bulkProgress.done} / {bulkProgress.total} attempts completed{bulkRunning?" · processing next policy":""}.
              {bulkStoppedReason ? <p className="mt-2 font-semibold text-amber-900">{bulkStoppedReason}</p> : null}
              {bulkResults.length ? <div className="mt-2 max-h-40 overflow-y-auto">{bulkResults.map(result=>(
                <p key={result.id} className="py-1">{result.ok?"✓":"Needs review"} · {result.intake_number} · {result.message}</p>
              ))}</div> : null}
            </div>
          ) : null}
          {reprocessProgress ? <div role="status" aria-live="polite" className="mt-2 rounded-lg border border-[#cbd9ea] bg-[#f5f9ff] p-3 text-[11px] text-[#285078]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Reprocess: {reprocessProgress.done} / {reprocessProgress.total} checked · {reprocessResults.filter(item=>item.ok).length} queued{reprocessStopped?" · stopped by operator":""}</span>
              {reprocessRunning ? <button type="button" onClick={()=>{reprocessCancelRef.current=true;}} className="rounded-md border border-amber-300 bg-white px-2 py-1 font-bold text-amber-900">Stop remaining</button> : null}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d4e3f0]"><div className="h-full rounded-full bg-[#168b9b] transition-all" style={{width:(reprocessProgress.total?100*reprocessProgress.done/reprocessProgress.total:0)+"%"}}/></div>
            <div className="mt-2 max-h-40 overflow-y-auto">{reprocessResults.map(result=>(
              <p key={result.id} className="py-1">{result.ok?"Queued":"Not queued"} · {result.intake_number} · {result.message}</p>
            ))}</div>
          </div> : null}
          {autoConvertMessage ? <p role="status" className="mt-2 rounded-lg border border-[#cbd9ea] bg-[#f5f9ff] p-3 text-[11px] text-[#285078]">{autoConvertMessage}</p> : null}
        </section>
      ) : null}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7eef5] px-3 py-2.5">
          <div>
            <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#2861a0]"/><h2 className="text-[13px] font-bold text-[#142e4c]">{primaryN8n ? "Policy Intakes" : "Existing Motor Policy Intakes"}</h2></div>
            
          </div>
          <div className="relative w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8090a6]"/>
            <input aria-label="Search displayed Intakes" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search number, source, mobile" className="h-9 w-full rounded-lg border border-[#d9e3ee] bg-[#f9fbff] pl-9 pr-3 text-[11px] outline-none focus:border-[#456ba6]" />
          </div>
        </div>
        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[900px] w-full border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#edf4fa] text-[9px] font-bold uppercase tracking-[.07em] text-[#62748e]">
              <tr><th className="w-10 px-3 py-3"><span className="sr-only">Select</span></th><th className="px-2 py-3">Intake</th><th className="px-3 py-3">Lead source</th><th className="px-3 py-3">Customer mobile</th>{primaryN8n ? <th className="px-3 py-3">Policy type</th> : null}<th className="px-3 py-3">{primaryN8n ? "Intake workflow" : "Status"}</th><th className="px-3 py-3">{primaryN8n ? "Saved OCR (old)" : "OCR"}</th>{primaryN8n && queueActive ? <th className="px-3 py-3">AI Exceptions</th> : null}<th className="px-3 py-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {visible.map(row => (
                <tr key={row.id} className={selectedId === row.id ? "bg-[#ebf4ff]" : "hover:bg-[#f9fbff]"}>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={"Select " + row.intake_number} checked={selectedId === row.id} disabled={isWaiting && selectedId !== row.id}
                      onChange={() => { setProcessingOpen(true); void selectRow(row.id); }} className="h-4 w-4 accent-[#215a9c]" />
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">
                    <Link href={"/policy-intakes/" + row.id} className="font-bold text-[#20528f] hover:underline">{row.intake_number}</Link>
                    {row.assigned_to_profile_id && row.assigned_to_profile_id !== profileId ? <span className="ml-2 text-[9px] text-amber-700">Assigned</span> : null}
                  </td>
                  <td className="max-w-[210px] truncate px-3 py-3 text-[#344761]" title={row.lead_source_name}>{row.lead_source_name || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#334763]">{row.customer_mobile}</td>
                  {primaryN8n ? <td className="whitespace-nowrap px-3 py-3 text-[#445b75]">{row.policy_type === "non_motor" ? "Non-Motor" : row.policy_type === "motor" ? "Motor" : row.policy_type === "life" ? "Life" : row.policy_type === "health" ? "Health" : "Unclassified"}</td> : null}
                  <td className="whitespace-nowrap px-3 py-3"><span className="rounded-md bg-[#edf2fa] px-2 py-1 font-semibold text-[#3f5c82]">{row.is_duplicate ? "Duplicate · Review only"
                      : primaryN8n && row.intake_bucket === "action_required" ? "Action Required"
                      : primaryN8n && row.intake_bucket === "in_review" ? "In Review"
                      : primaryN8n && row.intake_bucket === "processing" ? "Processing"
                      : humanStatus[row.status] || row.status}</span></td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={row.ocr_status === "completed" ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{row.ocr_status === "completed" ? "Extracted" : row.ocr_status.replaceAll("_", " ")}</span></td>
                  {primaryN8n && queueActive ? <td className="px-3 py-2">
                    <div className="flex min-w-[230px] items-center justify-between gap-2">
                      <button type="button" title="Open exception" onClick={()=>{setExceptionRow(row);setCustomerReview(null);}} className="flex min-w-0 items-center gap-2 text-left">
                        <span className={"h-2 w-2 shrink-0 rounded-full "+(row.is_duplicate?"bg-slate-400":row.ai_state==="verified"?"bg-emerald-500":row.ai_state==="processing"?"bg-sky-500":"bg-amber-500")}/>
                        <span className="sr-only">Parser not trained · Reprocess</span>
                        <span className="max-w-[200px] truncate font-medium text-slate-700" title={row.ai_diagnostic_code ? parserDiagnostic(row.ai_diagnostic_code)?.detail : (row.ai_exceptions??[]).map(code=>aiIssueTitles[code]??code).join(", ")}>
                          {row.is_duplicate?"Duplicate":row.ai_diagnostic_code?(parserDiagnostic(row.ai_diagnostic_code)?.title??"Parser error"):row.ai_exceptions?.length?(aiIssueTitles[row.ai_exceptions[0]]??"Needs review"):aiStateLabel[row.ai_state??""]??"Queued"}
                        </span>
                        {(row.ai_exceptions?.length??0)>1?<span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">+{(row.ai_exceptions?.length??0)-1}</span>:null}
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button type="button" aria-label={"Inspect "+row.intake_number} title="Inspect" onClick={()=>{setExceptionRow(row);setCustomerReview(null);}} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye className="h-4 w-4"/></button>
                        {((!row.is_duplicate&&row.ai_state==="verified"&&!row.ai_exceptions?.length)||canRetryReviewHeldPolicy(row))?<button type="button" aria-label={"Convert "+row.intake_number} title="Convert" disabled={isWaiting} onClick={()=>setAutoConvertRow(row)} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><ArrowRight className="h-4 w-4"/></button>:null}
                        {row.policy_type==="motor"&&!row.is_duplicate&&["processing","ready_for_review","in_review","needs_attention"].includes(row.status)?<button type="button" aria-label={"Reparse "+row.intake_number} title="Reparse and replace saved draft" disabled={replaceReparseId!==null||isWaiting} onClick={()=>void reparseAndReplace(row)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50 disabled:opacity-40">{replaceReparseId===row.id?<Loader2 className="h-4 w-4 animate-spin"/>:<RotateCcw className="h-4 w-4"/>}</button>:null}
                      </div>
                    </div>
                    {replaceReparseErrorId===row.id&&replaceReparseError?<button type="button" title={replaceReparseError} onClick={()=>setExceptionRow(row)} className="block max-w-[245px] truncate text-left text-[10px] text-rose-700">{replaceReparseError}</button>:null}
                  </td> : null}
                  <td className="whitespace-nowrap px-3 py-3 text-[#62748e]">{compactDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <div className="p-7 text-center text-[12px] text-[#718197]">No Intake matches this filter on the current page.</div> : null}
        </div>
      </section>
      {processingOpen ? <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[2px]"><div role="dialog" aria-modal="true" aria-label="Policy processing" className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto xl:overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><button type="button" aria-label="Close processing" title="Close" onClick={()=>setProcessingOpen(false)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button><section aria-live="polite" className="min-w-0 pr-8">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#4774c1]" /><h2 className="text-[13px] font-bold text-[#142e4c]">{primaryN8n ? "Policy processing" : "AI Booking Check"}</h2></div>
        {!selectedId ? <div className="mt-5 rounded-xl border border-dashed border-[#cddbea] p-5 text-center text-[11px] leading-5 text-[#63768e]">
          {primaryN8n ? queueActive ? "The queue reads Intakes automatically. Select one to review its exceptions, or review the current private PDF again before onboarding." : "Select an Intake to read its current private policy PDF using n8n. Untrained insurer layouts will be referred for manual review, not processed through Google OCR." : "Select a checkbox in the Intake table to see exactly which fields are ready and which require correction."}
        </div> : (
          <>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-[#f4f7fc] px-3 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#75859a]">Selected Intake</p>
                <p className="mt-1 text-[13px] font-bold text-[#183b68]">{selected?.intake_number ?? "Intake selected"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {n8nEnabled ? <button type="button" onClick={() => { void previewN8n(); }} disabled={isWaiting || Boolean(done)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cbd9eb] bg-white px-2.5 text-[10px] font-semibold text-[#24518a] disabled:opacity-50">
                  {busy === "extracting" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileSearch className="h-3.5 w-3.5"/>}{primaryN8n ? (queueActive ? "Re-extract current PDF" : n8nResult ? "Run n8n again" : "Process with n8n") : "Preview n8n PDF"}
                </button> : null}
                {!primaryN8n ? <button type="button" onClick={() => { void retry(); }} disabled={isWaiting} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d0deef] bg-white px-2.5 text-[10px] font-semibold text-[#29558d] disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5"/>Recheck</button> : null}
              </div>
            </div>
            {primaryN8n ? (
              <section aria-label="Previously saved OCR fields" className="mt-3 rounded-xl border border-[#d5e1ed] bg-[#f8fafd] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-bold text-[#23466e]">Previously extracted details · saved OCR</h3>
                  <span className="text-[10px] text-[#63768e]">{selected?.ocr_fields?.length ?? 0} fields</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#697c93]">Historical values are shown immediately without downloading the PDF or calling n8n. These are not current n8n-verified results. Check against the policy copy before using them for onboarding.</p>
                {selected?.ocr_fields?.length ? (
                  <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-[#e0e7f0] bg-white">
                    {selected.ocr_fields.filter(field=>field && typeof field.key==="string" && typeof field.value==="string" && field.value.trim()).map((field,index)=>(
                      <div key={field.key+"-"+index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 border-b border-[#e8edf4] px-3 py-2 text-[10.5px] last:border-b-0">
                        <span className="min-w-0 font-semibold text-[#4c6280]">{field.label || field.key}{field.page ? ` · p. ${field.page}` : ""}</span>
                        <span className="min-w-0 break-words font-medium text-[#1c3657]">{field.value}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 text-[10.5px] text-[#697c93]">No previously saved OCR fields are available for this Intake.</p>}
              </section>
            ) : null}
            {primaryN8n && selected?.policy_type !== "motor" ? <p role="status" className="mt-3 rounded-lg border border-[#cbd9ea] bg-[#f5f9ff] p-3 text-[10.5px] leading-5 text-[#264b74]">
              {selected?.policy_type ? "This policy type is not trained for automatic onboarding yet." : "This older Intake has no policy type classification."} n8n will attempt document validation, but any unsupported layout needs training or a human reviewer. No Google OCR fallback or booking is permitted here.
            </p> : null}
            {selected?.is_duplicate ? <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10.5px] leading-5 text-amber-900">
              Duplicate policy number detected. This Intake remains available for read-only n8n PDF comparison only; normal corrections and policy booking are blocked.
            </p> : null}
            {busy === "checking" ? <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Checking document, draft, duplicates, source and booking rules...</div> : null}
            {busy === "extracting" ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Reading current private PDF through the n8n review-only bridge...</div> : null}
            {busy === "applying" ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Revalidating and saving the confirmed failed OCR recovery...</div> : null}
            {n8nNotice ? <p role="status" className="mt-3 rounded-lg border border-[#c8d8eb] bg-[#f5f9ff] p-3 text-[11px] leading-5 text-[#284d77]">{n8nNotice}</p> : null}
            {primaryN8n && selectedId && !n8nResult && busy === null ? <p className="mt-3 text-[10.5px] text-[#61738a]">Previously saved details appear above. Re-extract the current PDF only when a new verified result is necessary.</p> : null}
            {primaryN8n && selected && !done && !n8nResult
              && selected.policy_type === "motor" && !selected.is_duplicate
              && ["processing","ready_for_review","in_review"].includes(selected.status)
              && selected.ocr_status === "completed" ? (
              <div className="mt-3 rounded-lg border border-[#bcd9d0] bg-[#f5fbf8] p-3">
                <p className="text-[10.5px] font-bold text-[#215b46]">Extracted policy · manual onboarding available</p>
                <p className="mt-1 text-[10px] leading-4 text-[#47675b]">Continue directly from the saved Intake. For safety, the current PDF will be verified by n8n before opening the editable onboarding draft. Existing exceptions are not silently cleared.</p>
                <button type="button" onClick={() => { void beginDirectN8nHandoff(); }} disabled={isWaiting}
                  className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1c5e8c] px-3 text-[11px] font-bold text-white disabled:opacity-50">
                  {busy === "extracting" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ArrowUpRight className="h-3.5 w-3.5"/>}
                  Continue to Policy Onboarding
                </button>
              </div>
            ) : null}
            {n8nResult && !done ? (n8nResult.ok ? (
              <section aria-label="n8n extraction review" className="mt-3 rounded-xl border border-[#c8d8eb] bg-[#f8fbff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#214f82]">n8n PDF extraction · Review only</p>
                  <span className="text-[10px] font-semibold text-[#3e648e]">{n8nResult.preview.fields.length} fields · {n8nResult.preview.changedFieldCount} new/different</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#5e7188]">
                  Compare each value with the original policy copy. Confidence scores are not available. This preview does not change the Intake, draft or booking state.
                </p>
                <div className="mt-3 rounded-lg border border-[#d2e1f1] bg-white p-3">
                  <p className="text-[10.5px] font-bold text-[#23466e]">
                    Exact field differences from saved OCR · {n8nResult.preview.changedFields.length}
                  </p>
                  <p className="mt-1 text-[10px] text-[#687b92]">New or different does not mean incorrect. Confirm every difference with the printed PDF before accepting the n8n parser.</p>
                  {n8nResult.preview.changedFields.length ? (
                    <div className="mt-2 max-h-[230px] space-y-2 overflow-y-auto">
                      {n8nResult.preview.changedFields.map(item => (
                        <div key={item.key} className="rounded-md border border-[#e1e9f3] bg-[#f9fbfe] p-2 text-[10px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#2c4e78]">{item.label}</span>
                            <span className={item.kind === "new" ? "rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-800" : "rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800"}>
                              {item.kind === "new" ? "New" : "Different"}
                            </span>
                          </div>
                          <p className="mt-1 break-words text-[#65768c]">Saved OCR: {item.previousValue ?? "Not previously extracted"}</p>
                          <p className="mt-0.5 break-words font-semibold text-[#173d64]">n8n: {item.extractedValue}</p>
                          <p className="mt-0.5 text-[#718097]">PDF p.{item.page ?? "?"} · {item.evidence}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-[10px] font-semibold text-emerald-800">All n8n fields match the saved OCR values exactly.</p>}
                </div>
                {n8nResult.preview.commercialPremium ? (
                  <div className="mt-3 rounded-lg border border-[#cbded5] bg-[#f7fcf8] p-3">
                    <p className="text-[10.5px] font-bold text-[#195339]">Verified printed commercial premium</p>
                    <p className="mt-1 text-[10px] text-[#4e7360]">Exact OD, TP, net, tax and gross from this insurer. The source does not establish a separate ICICI-style basic OD, add-on or CPA breakdown.</p>
                    {([
                      { label:"Total OD", amount:n8nResult.preview.commercialPremium.od },
                      { label:"Total third party", amount:n8nResult.preview.commercialPremium.tp },
                      { label:"Printed net", amount:n8nResult.preview.commercialPremium.net },
                      { label:"Printed GST", amount:n8nResult.preview.commercialPremium.gst },
                      { label:"Printed gross", amount:n8nResult.preview.commercialPremium.gross },
                    ]).map(item => (
                      <div key={item.label} className="flex justify-between gap-2 border-b border-[#e0ede5] py-1 text-[10px] last:border-b-0">
                        <span className="text-[#567060]">{item.label}</span>
                        <span className="font-semibold tabular-nums text-[#214b32]">{rupees(item.amount)}</span>
                      </div>
                    ))}
                    <p className="mt-2 text-[10px] text-[#246442]">{n8nResult.preview.checksPassed} source checks passed. Registration/booking requires separate review.</p>
                  </div>
                ) : n8nResult.preview.premium ? (
                <div className="mt-3 rounded-lg border border-[#cbded5] bg-[#f7fcf8] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10.5px] font-bold text-[#195339]">PDF premium reconciliation</p>
                    <span className="text-[10px] font-semibold text-emerald-800">{n8nResult.preview.checksPassed} parser checks passed</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#4e7360]">These are n8n values from the policy PDF, checked independently by INSUREIT. They are not saved or booked by preview.</p>
                  {[
                    { label: "Basic OD", amount: n8nResult.preview.premium.basicOd },
                    { label: "OD add-ons", amount: n8nResult.preview.premium.odAddons.reduce((total, item) => total + item.amount, 0) },
                    { label: "Total OD", amount: n8nResult.preview.premium.totalOd },
                    { label: "Third party", amount: n8nResult.preview.premium.basicTp },
                    { label: "CPA", amount: n8nResult.preview.premium.cpa },
                    { label: "Total liability", amount: n8nResult.preview.premium.liability },
                    { label: "Net premium", amount: n8nResult.preview.premium.net },
                    { label: "Exact IGST", amount: n8nResult.preview.premium.exactIgst },
                    { label: "Rounded printed tax", amount: n8nResult.preview.premium.tax },
                    { label: "Printed gross", amount: n8nResult.preview.premium.gross },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-2 border-b border-[#e0ede5] py-1 text-[10px] last:border-b-0">
                      <span className="text-[#567060]">{item.label}</span>
                      <span className="font-semibold tabular-nums text-[#214b32]">{rupees(item.amount)}</span>
                    </div>
                  ))}
                  {n8nResult.preview.premium.odAddons.length > 0 ? (
                    <div className="mt-2 rounded-md bg-white px-2 py-1.5">
                      <p className="text-[10px] font-bold text-[#35694b]">Individual OD add-ons</p>
                      {n8nResult.preview.premium.odAddons.map((item, index) => (
                        <div key={item.name + index} className="flex items-center justify-between gap-2 py-0.5 text-[10px]">
                          <span className="text-[#597366]">{item.name}</span>
                          <span className="font-semibold tabular-nums">{rupees(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-[10px] font-semibold text-[#246442]">
                    Verified: Basic OD + add-ons = Total OD; TP + CPA = liability; Total OD + liability = net; net + rounded tax = gross.
                  </p>
                </div>
                ) : null}
                <div className="mt-2 max-h-[320px] overflow-auto rounded-lg border border-[#d9e5f1] bg-white">
                  <table className="w-full min-w-[320px] text-left text-[10px]">
                    <thead className="sticky top-0 bg-[#eaf2fc] text-[#2d5076]"><tr><th className="p-2">Field</th><th className="p-2">Extracted value</th><th className="p-2">Evidence</th></tr></thead>
                    <tbody className="divide-y divide-[#e7edf5]">{n8nResult.preview.fields.map(field => (
                      <tr key={field.key}>
                        <td className="p-2 font-semibold text-[#314864]">{field.label}</td>
                        <td className="break-words p-2 text-[#152b49]">{field.value}</td>
                        <td className="p-2 text-[#64748b]">p.{field.page ?? "?"} · {field.evidence}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {n8nResult.preview.issuanceEvidence ? (
                  <div className="mt-2 rounded-lg border border-[#e7c9a0] bg-[#fffaf1] p-3 text-[11px] text-[#6e4e24]">
                    <p className="font-bold">{n8nResult.preview.acceptedIssuanceDate
                      ? "Issuance date automatically accepted: "
                      : "Suggested issuance date: "}{n8nResult.preview.issuanceEvidence.proposedDate}</p>
                    <p className="mt-1">{n8nResult.preview.acceptedIssuanceDate
                      ? "The signed-PDF timestamp and independently validated printed receipt agree. INSUREIT accepts this date under the Tata AIG business rule, so no separate issuance-date exception or confirmation is required. The PDF signer certificate chain has not been independently certified. Normal booking controls remain."
                      : "The date is not accepted automatically because its evidence is incomplete or conflicting. Review the original signed policy and other date rules."}</p>
                    {n8nResult.preview.savedDraftIssueDate ? (
                      <p className="mt-1 font-semibold">Saved issue date: {n8nResult.preview.savedDraftIssueDate.value||"blank"}. {n8nResult.preview.acceptedIssuanceDate
                        ? "If different, the verified-current-PDF handoff corrects the saved date using a revision guard and retains an audit note."
                        : "Any change requires explicit confirmation."}</p>
                    ):null}
                  </div>
                ):null}
                {n8nResult.preview.warnings.length ? <p className="mt-2 text-[10px] text-amber-800">Warnings: {n8nResult.preview.warnings.join("; ")}</p> : null}
                {primaryN8n && selected?.policy_type === "motor"
                  && !selected.is_duplicate
                  && ["processing", "ready_for_review", "in_review"].includes(selected.status)
                  && hasVerifiedN8nParserEvidence(
                    n8nResult.preview.parserId,n8nResult.preview.checksPassed,
                    n8nResult.preview.warnings) ? (
                  <div className="mt-3 rounded-lg border border-[#bcd9d0] bg-[#f5fbf8] p-3">
                    <p className="text-[10.5px] font-bold text-[#215b46]">Ready for manual Policy Onboarding review</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#47675b]">
                      n8n values will be mapped into the canonical form where supported. Check vehicle class,
                      registration, insured identity, manufacturer, policy product, Total OD, TP/CPA,
                      separate Third Party dates and commercial rates against the original policy.
                      Unsupported fields stay editable; the final booking is never automatic.
                    </p>
                    <button type="button" onClick={() => { void forwardN8nToOnboarding(); }} disabled={isWaiting}
                      className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1c5e8c] px-3 text-[11px] font-bold text-white disabled:opacity-50">
                      {busy === "forwarding" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ArrowUpRight className="h-3.5 w-3.5"/>}
                      Continue to Policy Onboarding
                    </button>
                  </div>
                ) : primaryN8n ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[10px] text-amber-900">
                    Policy Onboarding handoff requires a non-duplicate, open Motor Intake and verified n8n checks. Informational Tata AIG warnings stay for manual review.
                    Unknown or blocking parser warnings prevent handoff; incomplete documents still require manual review.
                  </p>
                ) : null}
                {n8nResult.preview.canApply ? (
                  <button type="button" onClick={() => { void applyN8n(); }} disabled={isWaiting}
                    className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#acc8e2] bg-[#edf5ff] px-3 text-[10.5px] font-bold text-[#245489] disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5"/>Apply reviewed fields to failed OCR
                  </button>
                ) : <p className="mt-2 text-[10px] leading-4 text-[#60738b]">Read-only proposal. Applying n8n fields requires a separate enabled recovery gate and is limited to failed Intakes with no saved OCR or draft. Use Open &amp; correct fields for other cases.</p>}
              </section>
            ) : <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">{n8nResult.error}</p>) : null}
            {result && !done && (
              <>
                {available ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>Pre-booking readiness checks passed. This is not a guarantee: the canonical booking transaction will perform its own live conflict and authorization checks.</div>
                  : <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{result.issues.length} issue(s) must be resolved or reviewed before semi-automatic booking.</div>}
                {result.issues.length > 0 && <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {result.issues.map((problem, index) => <div key={problem.section + problem.field + index} className="rounded-lg border border-[#f0d7ce] bg-[#fffaf8] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#8d3b26]"><ShieldAlert className="h-3.5 w-3.5"/>{problem.section} · {problem.field}</p>
                    <p className="mt-1 text-[10.5px] leading-5 text-[#685047]">{problem.message}</p>
                  </div>)}
                </div>}
              </>
            )}
            {done ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Policy successfully registered</div>
              <p className="mt-2 text-[11px] text-emerald-900">Policy Code: <strong>{done.policyCode}</strong></p>
              <Link href={"/policies/" + done.policyId} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline">View registered policy <ArrowUpRight className="h-3.5 w-3.5"/></Link>
            </div> : null}
            {!primaryN8n ? <><div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { void correct(); }} disabled={isWaiting || Boolean(done) || Boolean(selected?.is_duplicate)}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#cbd9e9] bg-white px-3 text-[11px] font-semibold text-[#254f82] disabled:opacity-50">
                {busy === "editing" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <PencilLine className="h-3.5 w-3.5"/>}Open & correct fields
              </button>
              <button type="button" onClick={() => { void book(); }} disabled={isWaiting || !available || Boolean(done)}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#174b83] px-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy === "booking" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}Confirm & book
              </button>
            </div>
            <p className="mt-3 text-[9.5px] leading-4 text-[#7b8898]">Booking preserves existing duplicate, ownership, date-OTP and coverage safeguards. Missing insurer pay-in or partner payout rates are not guessed.</p>
            </> : (
              <p className="mt-3 text-[10px] leading-5 text-[#597086]">
                n8n is the primary extractor for this workbench. Results remain uncommitted until a supported insurer parser and a separate, approved onboarding handoff are enabled. Use the standard Intake Review and canonical onboarding for manual corrections; no automatic booking or OCR overwrite occurs here.
              </p>
            )}
          </>
        )}
      </section></div></div> : null}
      {reprocessConfirmOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#101d37]/75 px-3 py-4 backdrop-blur-[2px]" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="bulk-reprocess-title"
            className="w-full max-w-[510px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <div className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#11a6bf]"/><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#36849b]">AI RECOVERY / REVIEW ONLY</p></div>
            <h3 id="bulk-reprocess-title" className="mt-2 text-[17px] font-bold text-[#17365d]">Reprocess all previous Intakes?</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#4f627c]">
              This will queue <strong>{reprocessBatch.length} eligible open Motor Intakes</strong> for fresh n8n PDF verification.
              No arbitrary 10-policy limit applies; requests are submitted one at a time and progress is visible.
              Completed, registered and duplicate policies remain protected. This does not create a customer, vehicle or policy.
              Verify uncertain prior bookings in Policy Register before retrying.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus onClick={()=>setReprocessConfirmOpen(false)}
                className="min-h-9 rounded-lg border border-[#cbd6e5] px-4 text-[11px] font-semibold text-[#38516e]">Cancel</button>
              <button type="button" onClick={()=>{void runConfirmedReprocess();}}
                className="min-h-9 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white">Queue All {reprocessBatch.length}</button>
            </div>
          </div>
        </div>
      , document.body) : null}
      {bulkConfirmOpen ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#101d37]/65 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="bulk-convert-title"
            className="w-full max-w-[510px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <h3 id="bulk-convert-title" className="text-[15px] font-bold text-[#17365d]">Confirm bulk Policy registration</h3>
            <p className="mt-3 text-[11px] leading-5 text-[#4f627c]">
              This will attempt to register up to {bulkBatch.length} verified Motor Intakes as REAL policies, one at a time.
              Each Intake must pass current-PDF re-extraction, issue-date approval, master customer checks,
              vehicle ownership and the canonical policy transaction. Failures stay unbooked and appear in a results list.
              An interrupted response is never retried automatically. Another batch requires a separate confirmation.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={()=>setBulkConfirmOpen(false)}
                className="min-h-9 rounded-lg border border-[#cbd6e5] px-4 text-[11px] font-semibold text-[#38516e]">Cancel</button>
              <button type="button" onClick={()=>{void runConfirmedBulkConversion();}}
                className="min-h-9 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white">Confirm &amp; Register Batch</button>
            </div>
          </div>
        </div>
      ) : null}
      {autoConvertRow ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#101d37]/65 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="auto-convert-title"
            className="w-full max-w-[450px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <h3 id="auto-convert-title" className="text-[15px] font-bold text-[#17365d]">Convert verified Intake to Policy?</h3>
            <p className="mt-2 text-[11px] font-semibold text-[#315376]">{autoConvertRow.intake_number}</p>
            <p className="mt-3 text-[11px] leading-5 text-[#4f627c]">
              This registers a real policy using the current independently validated PDF.
              If the mobile is already used by a different insured name, the existing
              canonical transaction will create a separate customer with the verified
              name and the same mobile. It will stop for duplicate policies, uncertain
              ownership, coverage conflicts, missing PDF issuance dates or required date OTP.
              Existing customer and policy records are not silently overwritten.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus disabled={isWaiting} onClick={()=>setAutoConvertRow(null)}
                className="min-h-9 rounded-lg border border-[#cbd6e5] px-4 text-[11px] font-semibold text-[#38516e] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isWaiting} onClick={()=>{void convertOneVerified();}}
                className="min-h-9 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white disabled:opacity-50">
                {busy==="booking"?"Converting...":"Confirm & Convert"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {exceptionRow ? (
        <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[#101d37]/65 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="ai-exception-title"
            className="max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 id="ai-exception-title" className="flex items-center gap-2 text-[15px] font-bold text-[#193657]">
              <ShieldAlert className="h-4 w-4 text-amber-700"/> Exception details<span className="sr-only">Resolve policy exceptions</span>
            </h3>
            <p className="mt-2 text-[11px] text-[#62748e]">Intake {exceptionRow.intake_number}</p>
            {exceptionRow.ai_diagnostic_code ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] leading-5 text-amber-950">
                <p className="font-bold">{parserDiagnostic(exceptionRow.ai_diagnostic_code)?.title}</p>
                <p className="break-all font-mono text-[10px]">Error code: {exceptionRow.ai_diagnostic_code}</p>
                <p>{parserDiagnostic(exceptionRow.ai_diagnostic_code)?.detail}</p>
                {parserDiagnostic(exceptionRow.ai_diagnostic_code)?.checks.length ? <p><strong>Failed checks:</strong> {parserDiagnostic(exceptionRow.ai_diagnostic_code)?.checks.join(", ")}</p>:null}

              </div>
            ):null}
            <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto">
              {(exceptionRow.ai_exceptions??[]).map(code=>(
                <div key={code} className="rounded-lg border border-[#e6dfd0] bg-[#fffcf4] p-3">
                  <p className="text-[11px] font-bold text-[#77511f]">{commercialBookingIssue(exceptionRow,code)?.title??aiIssueTitles[code]??"Requires review"}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#6c5d42]">
                    {code.startsWith("customer_")
                      ? "Review the original insured name and all candidate customers. Link an exact verified customer, or create a separate customer through canonical onboarding. Never reuse a customer solely because the mobile number matches."
                      : code==="duplicate_policy"
                        ? "Inspect the existing policy or earlier Intake. A duplicate must never be converted again."
                        : code==="preflight_pending"
                          ? "The PDF has been read, but customer, date, ownership, premiums and policy history have not passed the canonical booking preflight."
                          : commercialBookingIssue(exceptionRow,code)?.detail
                          ??"Review this exception in the Intake or editable Policy Onboarding workflow before attempting conversion."}
                  </p>
                </div>
              ))}
            </div>
            {exceptionRow.ai_diagnostic_code ? (
              <p className="mt-2 rounded-lg border border-[#e6dfd0] bg-[#fffcf4] p-2 text-[10px] font-medium text-[#79531e]">
                {exceptionRow.ai_diagnostic_code==="existing_active_policy_overlap"?"Booking hold reason: ":"Parser validation reason: "}<code>{exceptionRow.ai_diagnostic_code}</code>. {exceptionRow.ai_diagnostic_code==="existing_active_policy_overlap"?"The active policy must be reviewed; no policy was booked.":"A response failing verification is not necessarily a new/untrained product. Review the matching local n8n execution; no policy is booked."}
              </p>
            ):null}
            {primaryN8n && queueActive && reprocessCandidates.some(candidate=>candidate.id===exceptionRow.id)
               && !reprocessAttemptedIds.includes(exceptionRow.id) ? (
               <div className="mt-3 rounded-lg border border-[#cbd9ea] bg-[#f5f9ff] p-3">
                 <p className="text-[10px] text-[#49627f]">Re-read the current PDF using n8n and replace the outdated OCR-generated onboarding draft with its newly verified fields. No policy will be registered.</p>
                 <button type="button" disabled={queueRetrying || isWaiting}
                   onClick={async()=>{
                     const row=exceptionRow;
                     setQueueRetrying(true);setQueueRetryError(null);
                     try{
                       // This single-intake action replaces the parser-generated
                       // draft from the currently verified PDF, rather than merely
                       // resetting queue flags and retaining stale OCR.
                       const response=await reparseAndReplaceAiPolicyIntakeDraft(row.id);
                       if(response.ok){
                         setReprocessAttemptedIds(ids=>ids.includes(row.id)?ids:[...ids,row.id]);
                         setExceptionRow(null);setCustomerReview(null);
                         setAutoConvertMessage(row.intake_number+" re-extracted: the outdated OCR-derived draft has been replaced. No policy was booked.");
                         router.refresh();
                       }else setQueueRetryError(response.error??"The current PDF could not be verified or its draft replaced.");
                     }catch{setQueueRetryError("Reparse result is unknown. Refresh the Intake before attempting another replacement.");}
                     finally{setQueueRetrying(false);}
                   }}
                   className="mt-2 rounded-md bg-[#174b83] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                   {queueRetrying ? "Reparsing & replacing..." : "Reprocess current PDF & replace draft"}
                 </button>
               </div>
             ) : null}
             {primaryN8n && canRetryReviewHeldPolicy(exceptionRow) ? (
               <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                 <span className="text-[11px] text-emerald-900">Rechecks the live PDF and mandatory vehicle fields before any booking; missing or unmatched make/fuel will stop conversion.</span>
                 <button type="button" disabled={isWaiting} onClick={()=>{setAutoConvertRow(exceptionRow);setExceptionRow(null);}}
                   className="rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">Verify & Convert</button>
               </div>
             ):null}
             {primaryN8n && (exceptionRow.ai_exceptions??[]).includes("booking_review_required") ? (
               <div className="mt-3 space-y-2 rounded-lg border border-[#bfd0e4] bg-[#f5f9ff] p-3">
                 <p className="text-[11px] font-bold text-[#19446f]">Review saved draft versus current PDF</p>
                 <p className="text-[10px] text-[#4c6280]">Compare old issue dates and missing policy fields with independently verified PDF values. No changes or bookings occur until you approve the specific correction.</p>
                 <button type="button" disabled={draftReviewBusy||draftApplyBusy||isWaiting}
                   onClick={async()=>{
                     setDraftReview(null);setDraftReviewMessage(null);setDraftReviewBusy(true);
                     try{setDraftReview(await reviewIciciVerifiedDraftRepair(exceptionRow.id));}
                     catch{setDraftReview({ok:false,error:"The PDF/draft comparison is unavailable. No changes were made."});}
                     finally{setDraftReviewBusy(false);}
                   }}
                   className="rounded-md border border-[#adc5e0] bg-white px-3 py-2 text-[10px] font-bold text-[#174b83] disabled:opacity-50">
                   {draftReviewBusy?"Verifying current PDF...":"Compare current PDF and saved draft"}
                 </button>
                 {draftReview?.ok===false?<p role="alert" className="text-[10px] text-amber-800">{draftReview.error}</p>:null}
                 {draftReview?.ok===true&&draftReview.intakeId===exceptionRow.id ? (
                   <div className="space-y-2 rounded-lg border border-[#d0dfed] bg-white p-3 text-[10px] text-[#405875]">
                     <p><strong>Saved issue date:</strong> {draftReview.savedIssueDate||"Not provided"}</p>
                     <p><strong>PDF Policy Issued On:</strong> {draftReview.pdfIssueDate}</p>
                     <p><strong>Current policy:</strong> {draftReview.policyNumber}</p>
                     <p><strong>Draft revision:</strong> {draftReview.revision}</p>
                     <p><strong>PDF owner-driver CPA:</strong> ₹{draftReview.verifiedCpa} · <strong>Saved CPA:</strong> {draftReview.savedCpa||"Blank"} · <strong>Saved CPA opted:</strong> {draftReview.savedCpaOpted}</p>
                     {draftReview.cpaNeedsReview ? <p role="alert" className="font-semibold text-amber-800">CPA amount and opt-in need separate review. This repair will not silently opt you into or out of CPA. After correcting the issue date, open editable Policy Onboarding and explicitly reconcile the CPA amount and selection before booking.</p>:null}
                     <p><strong>Missing draft fields:</strong> {draftReview.missingFields.length?draftReview.missingFields.join(", "):"None in comparison"}</p>
                     {draftReview.otherConflicts.length>0 ? <p className="font-semibold text-amber-800">Other nonempty conflicts require manual review: {draftReview.otherConflicts.join(", ")}</p>:null}
                     <p className="text-amber-900">Confirming will replace only the displayed saved issue date with the PDF-verified issue date and populate eligible blank draft fields. Existing nonempty vehicle, identity, policy, and premium values remain unchanged. Booking remains separate.</p>
                     <div className="flex gap-2">
                       <button type="button" onClick={()=>setDraftReview(null)} className="rounded-md border px-3 py-2 font-semibold">Cancel</button>
                       <button type="button" disabled={draftApplyBusy||isWaiting}
                         onClick={async()=>{
                           const review=draftReview;
                           if(!review?.ok||review.intakeId!==exceptionRow.id)return;
                           setDraftApplyBusy(true);setDraftReviewMessage(null);
                           try{
                             const res=await applyReviewedIciciDraftRepair(review.intakeId,review.documentId,review.fingerprint,review.revision,review.savedIssueDate,true);
                             if(res.ok){
                               setDraftReview(null);setDraftReviewMessage("Verified fields applied to the draft only. No policy was registered. Refresh and review other conflicts before conversion.");
                               router.refresh();
                             }else setDraftReviewMessage(res.error??"Draft correction was refused. Nothing was changed.");
                           }catch{setDraftReviewMessage("Draft correction status is uncertain. Refresh and review the draft before trying again.");}
                           finally{setDraftApplyBusy(false);}
                         }}
                         className="rounded-md bg-[#174b83] px-3 py-2 font-bold text-white disabled:opacity-50">
                         {draftApplyBusy?"Applying reviewed changes...":"Confirm PDF-verified draft repair"}
                       </button>
                     </div>
                   </div>
                 ):null}
                 {draftReviewMessage?<p role="status" className="text-[10px] font-semibold text-[#245583]">{draftReviewMessage}</p>:null}
               </div>
             ) : null}
            {primaryN8n && exceptionRow.policy_type==="motor" && !exceptionRow.is_duplicate ? (
              <div className="mt-3 rounded-lg border border-[#bfd0e4] bg-[#f5f9ff] p-3">
                <p className="text-[11px] font-bold text-[#19446f]">Reparse current PDF and replace saved details</p>
                <p className="mt-1 text-[10px] leading-4 text-[#4c6280]">Runs the current PDF through n8n again. If validation succeeds, all saved extracted details and the onboarding draft are replaced. This does not create or book a policy.</p>
                <button type="button" disabled={replaceReparseId!==null||isWaiting}
                  onClick={()=>void reparseAndReplace(exceptionRow)}
                  className="mt-2 rounded-md bg-[#174b83] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-50">
                  {replaceReparseId===exceptionRow.id?"Reparsing current PDF…":"Reparse & replace saved draft"}
                </button>
                {replaceReparseError?<p role="alert" className="mt-2 text-[10px] text-amber-800">{replaceReparseError}</p>:null}
              </div>
            ):null}
                          {(exceptionRow.ai_exceptions??[]).some(code=>code.startsWith("customer_")) ? (
              <div className="mt-3 space-y-2 rounded-lg border border-[#d2e0f0] bg-[#f5f9ff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-[#19446f]">Customer identity decision</p>
                    <p className="text-[10px] text-[#59708d]">Inspect actual master records before linking or creating a customer.</p>
                  </div>
                  <button type="button" disabled={reviewingCustomer}
                    onClick={async()=>{
                      setReviewingCustomer(true);setCustomerReview(null);
                      try {
                        setCustomerReview(await reviewAiIntakeCustomerCandidates(exceptionRow.id));
                      } catch {
                        setCustomerReview({ok:false,error:"Customer candidate review is unavailable. Use Advanced options."});
                      } finally {setReviewingCustomer(false);}
                    }}
                    className="min-h-8 rounded-md bg-[#174b83] px-3 text-[10px] font-bold text-white disabled:opacity-50">
                    {reviewingCustomer ? "Checking current PDF..." : "Check customer matches"}
                  </button>
                </div>
                {customerReview?.ok===false ? <p role="alert" className="text-[10px] text-amber-800">{customerReview.error}</p> : null}
                {customerReview?.ok===true ? (
                  <div className="space-y-2" aria-live="polite">
                    <p className="text-[10px] font-semibold text-[#3b577a]">
                      PDF insured: {customerReview.insuredName??"Not verified"} · Mobile ending {customerReview.mobileLast4}
                    </p>
                    {customerReview.otherOpenIntakes !== null && customerReview.otherOpenIntakes > 0 ? (
                      <p className="text-[10px] font-semibold text-amber-800">
                        This mobile also appears on {customerReview.otherOpenIntakes} other open Intake(s). Multiple policies may belong to the same person; verify each legal insured identity before selecting or creating a customer.
                      </p>
                    ) : null}
                    {customerReview.otherOpenIntakes === null ? (
                      <p className="text-[10px] text-amber-800">The related-Intake check is unavailable; do not assume this phone belongs to only one insured.</p>
                    ) : null}
                    <p className="text-[10px] text-[#647891]">{customerReview.verificationNote}</p>
                    {customerReview.truncated ? <p className="text-[10px] font-bold text-amber-700">More than 50 master records found. A unique match cannot be assumed.</p> : null}
                    {customerReview.candidates.some(c=>c.nameMatch==="verified_exact") ? (
                      <p className="text-[10px] font-medium text-[#305c83]">An existing exact-name match must be checked by the canonical booking transaction before creating another customer.</p>
                    ) : (
                      <p className="text-[10px] font-medium text-[#305c83]">No exact-name customer found: policy conversion can use the existing create-new-customer transaction even if this phone belongs to other people.</p>
                    )}
                    {customerReview.candidates.length ? (
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {customerReview.candidates.map(candidate=>(
                          <div key={candidate.id} className="flex items-center justify-between gap-2 rounded-md border border-[#dbe6f2] bg-white px-2 py-1.5">
                            <div>
                              <p className="text-[10px] font-bold text-[#243f60]">{candidate.displayName} · {candidate.customerCode}</p>
                              <p className="text-[9px] text-[#607992]">{candidate.nameMatch==="verified_exact"?"Name matches current verified PDF":candidate.nameMatch==="different"?"Different insured name — identity conflict":"Name not verified"}</p>
                            </div>
                            <Link href={"/customers/"+candidate.id} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 text-[10px] font-semibold text-[#1d538c] underline">Review profile</Link>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[10px] text-[#61748e]">No matching mobile number in the customer master. Review identity before creating a new customer.</p>}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isWaiting || queueRetrying || !customerReview.insuredName}
                        onClick={async()=>{
                          const row=exceptionRow;
                          if(row.ai_state==="verified" && !row.is_duplicate && !(row.ai_exceptions??[]).length){
                            setExceptionRow(null);setAutoConvertRow(row);setCustomerReview(null);
                            return;
                          }
                          if(row.is_duplicate){
                            setQueueRetryError("Duplicate policy records cannot be converted into a new policy.");
                            return;
                          }
                          setQueueRetrying(true);setQueueRetryError(null);
                          try {
                            const queued=await reprocessAiPolicyIntake(row.id);
                            if(queued.ok){
                              setExceptionRow(null);setCustomerReview(null);router.refresh();
                              setAutoConvertMessage("The latest policy PDF is queued for n8n revalidation. When the Intake shows PDF extracted, Convert to Policy will create a separate customer within the canonical booking transaction if no exact insured-name match exists.");
                            }else{
                              setQueueRetryError(queued.error==="This Intake is already queued or being processed."
                                ?"The current policy is already queued for n8n. It will be eligible for normal conversion once the verified PDF and required issuance date have been confirmed."
                                :queued.error??"Could not revalidate this Intake.");
                            }
                          } catch {setQueueRetryError("Could not schedule the verified policy recheck. No customer or policy was created.");}
                          finally {setQueueRetrying(false);}
                        }}
                        className="rounded-md border border-[#bed1e8] bg-white px-3 py-2 text-[10px] font-bold text-[#174b83] disabled:opacity-50">
                        Create New Customer with Policy
                      </button>
                      <Link href="/customers" target="_blank" rel="noopener noreferrer"
                        className="rounded-md border border-[#bed1e8] bg-white px-3 py-2 text-[10px] font-bold text-[#174b83]">Customer Register</Link>
                    </div>
                    <p className="text-[9px] font-medium text-[#7a6472]">A different insured name with the same mobile is normally handled inside canonical Policy Onboarding. No unrelated Customer Register redirect or customer record is created before the verified policy transaction succeeds.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {queueRetryError ? <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900">{queueRetryError}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {primaryN8n && queueActive && !exceptionRow.is_duplicate
                && ["unsupported","exception","failed"].includes(exceptionRow.ai_state??"") ? (
                <button type="button" disabled={isWaiting || queueRetrying}
                  onClick={()=>{setManualTransferRow(exceptionRow);setManualTransferReason("");setManualTransferError(null);setExceptionRow(null);}}
                  aria-label="Move to manual onboarding" title="Move to manual onboarding" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                  <PencilLine className="h-4 w-4"/><span className="sr-only">Move to Manual Onboarding</span>
                </button>
              ):null}
              <button type="button" autoFocus onClick={()=>{setExceptionRow(null);setQueueRetryError(null);setCustomerReview(null);}}
                aria-label="Close exception" title="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><X className="h-4 w-4"/></button>
              <Link href={"/policy-intakes/"+exceptionRow.id} aria-label="Open Intake" title="Open Intake" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50"><ArrowRight className="h-4 w-4"/></Link>
              <button type="button" onClick={()=>{const id=exceptionRow.id;setExceptionRow(null);setProcessingOpen(true);void selectRow(id);}}
                aria-label="Review current PDF" title="Review current PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#174b83] text-white hover:bg-blue-800"><Eye className="h-4 w-4"/></button>
            </div>
          </div>
        </div>
      ) : null}
      {manualTransferRow ? (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#101d37]/65 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="ai-manual-transfer-title"
            className="w-full max-w-[480px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <h3 id="ai-manual-transfer-title" className="text-[15px] font-bold text-[#193657]">Move failed Intake to Manual Onboarding?</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#51657e]">This IT-only action transfers <strong>{manualTransferRow.intake_number}</strong> out of the n8n queue so Operations can review it manually. Only terminal parser failures qualify. The audit records your account and reason. No policy, customer, vehicle, PDF, or reviewer assignment is changed.</p>
            <label htmlFor="ai-manual-transfer-reason" className="mt-3 block text-[11px] font-semibold text-[#1d3b5f]">Reason for transfer (required; do not include customer, vehicle or policy identifiers)</label>
            <textarea id="ai-manual-transfer-reason" value={manualTransferReason}
              onChange={event=>setManualTransferReason(event.target.value)} maxLength={500} rows={3}
              placeholder="Example: ICICI policy PDF layout is not yet supported; route for manual review"
              className="mt-1 w-full rounded-lg border border-[#bdcfe2] p-2 text-[11px] text-[#253d5b] outline-none focus:ring-2 focus:ring-[#91b7db]"/>
            {manualTransferError ? <p role="alert" className="mt-2 text-[11px] text-rose-700">{manualTransferError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={manualTransferBusy}
                onClick={()=>{setManualTransferRow(null);setManualTransferError(null);}}
                className="min-h-9 rounded-lg border border-[#bdcfe2] px-3 text-[11px] font-semibold text-[#335270]">Cancel</button>
              <button type="button" disabled={manualTransferBusy || manualTransferReason.trim().length<12}
                onClick={async()=>{
                  if(!manualTransferRow || manualTransferBusy)return;
                  setManualTransferBusy(true);setManualTransferError(null);
                  try {
                    const result=await transferFailedAiIntakeToManual(manualTransferRow.id,manualTransferReason);
                    if(result.ok){setManualTransferRow(null);setSelectedId(null);router.refresh();}
                    else setManualTransferError(result.error);
                  } catch {
                    setManualTransferError("Transfer failed. Refresh this Intake and try again.");
                  } finally {setManualTransferBusy(false);}
                }}
                className="min-h-9 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white disabled:opacity-50">
                {manualTransferBusy?"Transferring...":"Confirm transfer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {handoffDialog ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#101d37]/65 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="n8n-handoff-dialog-title" aria-describedby="n8n-handoff-dialog-description"
            className="w-full max-w-[480px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <div className="mb-3 flex items-center gap-2 text-[#174b83]">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f2fb]"><ClipboardCheck className="h-4.5 w-4.5"/></span>
              <h3 id="n8n-handoff-dialog-title" className="text-[15px] font-bold text-[#193657]">
                {handoffDialog.kind === "confirm" ? "Continue to Policy Onboarding?"
                  : handoffDialog.kind === "takeover" ? "Confirm reviewer takeover"
                    : "Existing onboarding draft"}
              </h3>
            </div>
            <p id="n8n-handoff-dialog-description" className="text-[12px] leading-5 text-[#52647b]">
              {handoffDialog.kind === "confirm"
                ? "INSUREIT will recheck the current PDF and n8n extraction, then open the canonical editable Policy Onboarding draft. Review all mapped values and the original PDF before booking. No policy will be booked by this action."
                : handoffDialog.kind === "takeover"
                  ? `This Intake is assigned to ${handoffDialog.reviewerName || "another reviewer"}. Continuing will transfer the reviewer assignment to you. No policy will be booked.`
                  : fillEmptySavedFields
                    ? "The saved draft has been preserved. Only previously empty eligible fields were filled from the verified extraction or an approved customer master; existing manual values were not changed."
                    : "The saved draft has been preserved without changes. Compare it with the latest n8n preview and the original PDF before booking."}
            </p>
            {handoffDialog.kind !== "existing" && n8nResult?.ok
              && n8nResult.preview.issuanceEvidence
              && !n8nResult.preview.acceptedIssuanceDate ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] leading-4 text-amber-950">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#174b83]" checked={approveSigningDate}
                  onChange={event=>setApproveSigningDate(event.target.checked)}/>
                <span><strong>Confirm proposed issuance date {n8nResult.preview.issuanceEvidence.proposedDate}</strong> after checking the original signed PDF. Its signing timestamp agrees with the printed receipt date, but the signing certificate and insurer issuance rule are not independently trusted. {n8nResult.preview.savedDraftIssueDate ? "This will replace the saved date "+(n8nResult.preview.savedDraftIssueDate.value||"(blank)")+" only if the draft has not changed." : "This date will populate the editable draft."} Final booking and any historical-date approval remain separate.</span>
              </label>
            ):null}
            {handoffDialog.kind !== "existing" ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-[#dce5f0] bg-[#f6f9fd] px-3 py-3 text-[11px] leading-4 text-[#344b68]">
                <input type="checkbox" checked={fillEmptySavedFields} onChange={event => setFillEmptySavedFields(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#174b83]"/>
                <span><strong>Fill missing fields in a saved draft</strong> when available. Only empty fields can be filled, never an existing manual value. Insured Name may be proposed from the currently verified ICICI 3005 PDF for manual review; it never silently links or creates a customer.</span>
              </label>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => setHandoffDialog(null)} disabled={isWaiting}
                className="min-h-10 rounded-lg border border-[#cbd6e5] bg-white px-4 text-[11px] font-semibold text-[#38516e] disabled:opacity-50">
                {handoffDialog.kind === "existing" ? "Stay here" : "Cancel"}
              </button>
              <button type="button" onClick={() => { void confirmN8nHandoff(); }} disabled={isWaiting}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white disabled:opacity-50">
                {isWaiting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : null}
                {handoffDialog.kind === "confirm" ? "Continue to onboarding"
                  : handoffDialog.kind === "takeover" ? "Take over & continue" : "Open saved draft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {takeover ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#101d37]/60 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="semi-auto-takeover-title" aria-describedby="semi-auto-takeover-description"
            className="w-full max-w-[440px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <h3 id="semi-auto-takeover-title" className="text-[15px] font-bold text-[#193657]">Take over this Policy Intake?</h3>
            <p id="semi-auto-takeover-description" className="mt-2 text-[12px] leading-5 text-[#52647b]">
              This Intake is currently assigned to <strong className="text-[#1b3a61]">{takeover.reviewerName}</strong>.
              Choosing <strong>Take over &amp; open</strong> changes its assigned Operations reviewer to you,
              then opens the existing Policy Onboarding draft for correction. No policy will be booked.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus onClick={() => setTakeover(null)}
                className="min-h-10 rounded-lg border border-[#cbd6e5] bg-white px-4 text-[11px] font-semibold text-[#38516e]">
                Cancel
              </button>
              <button type="button" onClick={() => { void confirmTakeover(); }}
                className="min-h-10 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white">
                Take over &amp; open
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
