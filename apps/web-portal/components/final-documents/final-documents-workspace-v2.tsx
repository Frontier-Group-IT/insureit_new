"use client";

import { Camera, ContactRound, Eye, FilePenLine, FileText, RefreshCw, ShieldCheck, Truck, Video } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeClaimJourneyStage } from "@/app/claims/stage-actions";
import { ClaimStageSuccessPopup } from "@/components/claim-manager/claim-stage-success-popup";
import { finalDocumentDefinitions, finalDocumentTabs } from "./final-document-groups";
import { loadFinalClaimIntimationDetails, saveFinalDealershipDetails, submitFinalDocumentsDraft, uploadFinalDocument, verifyFinalDocument } from "./final-documents-actions";
import { classifyStage3BulkAttachment, loadStage3UnclassifiedAttachments, type Stage3UnclassifiedAttachment } from "./stage3-bulk-classify-actions";

export type FinalDocumentRowV2 = {
  groupIndex: number;
  groupSr: number;
  type: string;
  name: string;
  status: "Pending" | "Uploaded" | "Verified";
  documentId: string | null;
  fileName: string | null;
  viewUrl: string | null;
};

export type DealershipDetailsV2 = {
  dealership_name?: string;
  dealership_address?: string;
  contact_person_name?: string;
  contact_number?: string;
};

type ActionResult = { ok: boolean; message?: string };

type ClaimIntimationDetails = {
  claim_intimation_date: string;
  dealership_name: string;
  dealership_location: string;
  gate_in_date: string;
  estimate_amount: string;
};

type DocumentVisual = {
  key: "spot" | "rc" | "insurance" | "dl" | "gr" | "video" | "document";
  accent: string;
  fallbackIcon: string;
};

export function FinalDocumentsWorkspaceV2({ claimId, rows, dealershipDetails }: { claimId: string; rows: FinalDocumentRowV2[]; dealershipDetails?: DealershipDetailsV2 | null }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [unclassifiedAttachments, setUnclassifiedAttachments] = useState<Stage3UnclassifiedAttachment[]>([]);
  const [classifications, setClassifications] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<ClaimIntimationDetails>({
    claim_intimation_date: dealershipDetails?.contact_person_name ?? "",
    dealership_name: dealershipDetails?.dealership_name ?? "",
    dealership_location: dealershipDetails?.dealership_address ?? "",
    gate_in_date: dealershipDetails?.contact_number ?? "",
    estimate_amount: ""
  });
  const visibleRows = rows.filter((row) => row.groupIndex === activeTab);
  const verifiedCount = rows.filter((row) => row.status === "Verified").length;

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFinalClaimIntimationDetails(claimId), loadStage3UnclassifiedAttachments(claimId)]).then(([detailsResponse, attachmentResponse]) => {
      if (cancelled) return;
      if (detailsResponse.ok && detailsResponse.details) setDetails(detailsResponse.details);
      if (attachmentResponse.ok) setUnclassifiedAttachments(attachmentResponse.attachments ?? []);
    });
    return () => { cancelled = true; };
  }, [claimId]);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  function baseForm() {
    const formData = new FormData();
    formData.set("claimId", claimId);
    return formData;
  }

  function stageDetailsForm() {
    const formData = baseForm();
    formData.set("claim_intimation_date", details.claim_intimation_date);
    formData.set("dealership_name", details.dealership_name);
    formData.set("dealership_location", details.dealership_location);
    formData.set("gate_in_date", details.gate_in_date);
    formData.set("estimate_amount", details.estimate_amount);
    return formData;
  }

  function run(label: string, action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setResult(null);
    setPendingAction(label);
    startTransition(async () => {
      const response = await action();
      setPendingAction(null);
      if (response.ok) {
        setResult(null);
        setSuccessNotice(response.message || "Changes saved successfully.");
        onSuccess?.();
        setTimeout(() => router.refresh(), 0);
        return;
      }
      setResult(response);
    });
  }

  function classifyAttachment(documentId: string) {
    const documentType = classifications[documentId] ?? "";
    if (!documentType) {
      setResult({ ok: false, message: "Choose a document category before classifying." });
      return;
    }
    const formData = new FormData();
    formData.set("claimId", claimId);
    formData.set("documentId", documentId);
    formData.set("documentType", documentType);
    run(`classify-${documentId}`, () => classifyStage3BulkAttachment(formData), () => {
      setUnclassifiedAttachments((current) => current.filter((item) => item.id !== documentId));
      setClassifications((current) => {
        const next = { ...current };
        delete next[documentId];
        return next;
      });
    });
  }

  function saveStageDetails() {
    run("stage-details", () => saveFinalDealershipDetails(stageDetailsForm()));
  }

  function saveAndContinue() {
    setResult(null);
    setPendingAction("save-continue");
    startTransition(async () => {
      const saved = await saveFinalDealershipDetails(stageDetailsForm());
      if (!saved.ok) {
        setResult(saved);
        setPendingAction(null);
        return;
      }

      const formData = new FormData();
      formData.set("milestone_key", "claim_intimation");
      formData.set("save_only", "false");
      formData.set("notes", "Operations completed Claim Intimation and opened Work Approval.");
      formData.set("claim_intimation_date", details.claim_intimation_date);
      formData.set("dealership_name", details.dealership_name);
      formData.set("dealership_location", details.dealership_location);
      formData.set("gate_in_date", details.gate_in_date);
      formData.set("estimate_amount", details.estimate_amount);

      try {
        const response = await completeClaimJourneyStage(claimId, formData);
        setPendingAction(null);
        setResult(null);
        if (response.advanced) {
          setSuccessNotice("Claim Intimation completed. Work Approval is now open.");
          router.replace(`/claims/${claimId}?stage=work_approval`);
          router.refresh();
          return;
        }
        setSuccessNotice("Stage details saved.");
        router.refresh();
      } catch (error) {
        setPendingAction(null);
        setResult({ ok: false, message: error instanceof Error ? error.message : "Unable to complete Claim Intimation." });
      }
    });
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#071D49]">Stage Details</h2>
            <p className="mt-1 text-[12px] text-[#68758A]">Record claim intimation, workshop and estimate details.</p>
          </div>
          <button type="button" disabled={isPending && pendingAction === "stage-details"} onClick={saveStageDetails} className="rounded-lg border border-[#BFD3F7] bg-[#F7FAFF] px-4 py-2 text-[12px] font-semibold text-[#174EA6] disabled:opacity-60">{isPending && pendingAction === "stage-details" ? "Saving..." : "Save Details"}</button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <DateField label="Claim Intimation Date" value={details.claim_intimation_date} onChange={(value) => setDetails((prev) => ({ ...prev, claim_intimation_date: value }))} />
          <Field label="Dealership Name" value={details.dealership_name} onChange={(value) => setDetails((prev) => ({ ...prev, dealership_name: value }))} />
          <Field label="Dealership Location" value={details.dealership_location} onChange={(value) => setDetails((prev) => ({ ...prev, dealership_location: value }))} />
          <DateField label="Gate-in Date" value={details.gate_in_date} onChange={(value) => setDetails((prev) => ({ ...prev, gate_in_date: value }))} />
          <Field label="Estimate Amount" value={details.estimate_amount} onChange={(value) => setDetails((prev) => ({ ...prev, estimate_amount: value.replace(/[^0-9.]/g, "") }))} inputMode="decimal" />
        </div>
      </section>

      {unclassifiedAttachments.length ? (
        <section className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[#071D49]">Unclassified Claim Attachments</h2>
              <p className="text-[12px] text-[#6E5A2B]">Assign each bulk-uploaded file to the correct verification category before verifying it.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800">{unclassifiedAttachments.length} pending</span>
          </div>
          <div className="mt-3 space-y-2">
            {unclassifiedAttachments.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#071D49]">{document.fileName}</span>
                <a href={document.viewUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#174EA6]">Preview</a>
                <select value={classifications[document.id] ?? ""} onChange={(event) => setClassifications((current) => ({ ...current, [document.id]: event.target.value }))} className="h-8 rounded-md border border-[#B8C5D6] bg-white px-2 text-[11px] font-medium text-[#071D49]">
                  <option value="" disabled>Assign category</option>
                  {finalDocumentDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.name}</option>)}
                </select>
                <button type="button" disabled={isPending && pendingAction === `classify-${document.id}`} onClick={() => classifyAttachment(document.id)} className="h-8 rounded-md bg-[#071D49] px-3 text-[11px] font-semibold text-white disabled:opacity-60">{isPending && pendingAction === `classify-${document.id}` ? "Classifying..." : "Classify"}</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#DFE8F4] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(7,29,73,0.04)]">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#071D49]">Document Verification</h1>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#F4F7FC] px-2.5 py-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#68758A]">Documents Verified</span>
            <span className="text-[12px] font-semibold text-[#071D49]">{verifiedCount} / {rows.length}</span>
          </div>
        </div>
        <div className="grid overflow-hidden rounded-xl border border-[#D9E3F0] md:grid-cols-5">{finalDocumentTabs.map((tab, index) => <button key={tab} type="button" onClick={() => setActiveTab(index)} className={`flex items-center gap-2 px-4 py-3 text-left text-[12px] font-semibold ${activeTab === index ? "bg-[#071D49] text-white" : "border-l border-[#D9E3F0] bg-[#FBFCFE] text-[#071D49]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${activeTab === index ? "bg-white text-[#071D49]" : "bg-[#EEF4FF] text-[#071D49]"}`}>{index + 1}</span>{tab}</button>)}</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleRows.map((row) => <DocumentCard key={row.type} claimId={claimId} row={row} isPending={isPending} pendingAction={pendingAction} run={run} refresh={() => router.refresh()} />)}</div>
        {result && !result.ok ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{result.message}</p> : null}
        <div className="mt-4 flex justify-end"><div className="flex items-center gap-3"><button type="button" onClick={() => run("draft", () => submitFinalDocumentsDraft(baseForm()))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49]">Save as Draft</button><button type="button" disabled={isPending} onClick={saveAndContinue} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">{isPending && pendingAction === "save-continue" ? "Saving..." : "Save Details"}</button></div></div>
      </section>

      {successNotice ? <ClaimStageSuccessPopup message={successNotice} /> : null}
    </div>
  );
}

function DocumentCard({ claimId, row, isPending, pendingAction, run, refresh }: { claimId: string; row: FinalDocumentRowV2; isPending: boolean; pendingAction: string | null; run: (label: string, action: () => Promise<ActionResult>, onSuccess?: () => void) => void; refresh: () => void }) {
  function upload(file: File) {
    run(`upload-${row.type}`, () => {
      const formData = new FormData();
      formData.set("claimId", claimId);
      formData.set("documentType", row.type);
      formData.set("file", file);
      return uploadFinalDocument(formData);
    });
  }

  function verify() {
    run(`verify-${row.type}`, () => {
      const formData = new FormData();
      formData.set("claimId", claimId);
      formData.set("documentId", row.documentId ?? "");
      formData.set("documentType", row.type);
      return verifyFinalDocument(formData);
    });
  }

  const verified = row.status === "Verified";
  const visual = documentVisual(row);
  const borderTone = verified ? "border-green-200" : "border-[#E2EAF4]";

  return (
    <article className={`rounded-xl border bg-white p-2.5 shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${borderTone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <DocumentTypeHeaderIcon visual={visual} />
          <h2 className="truncate text-[13px] font-semibold leading-tight text-[#071D49]">{row.name}</h2>
        </div>
        <StatusBadge status={row.status} />
      </div>

      {row.documentId ? (
        <div className="relative grid grid-cols-[32px_1fr] items-start gap-2 rounded-lg border border-[#E2EAF4] bg-white/80 p-2">
          <div className="grid h-8 w-8 place-items-center"><DocumentTypeHeaderIcon visual={visual} /></div>
          <div className="min-w-0 pr-[112px]">
            {row.viewUrl ? (
              <a href={row.viewUrl} target="_blank" rel="noreferrer" title="Open uploaded document" className="flex min-h-8 items-center truncate text-[11px] font-semibold text-[#071D49] transition hover:text-[#174EA6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/25">{row.fileName ?? "Document uploaded"}</a>
            ) : <p className="flex min-h-8 items-center truncate text-[11px] font-semibold text-[#071D49]">{row.fileName ?? "Document uploaded"}</p>}
          </div>
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {!verified ? (
              <button type="button" disabled={isPending} onClick={verify} aria-label={`Verify ${row.name}`} title="Verify document" className="h-8 shrink-0 rounded-none border border-transparent bg-transparent px-2 text-[11px] font-semibold text-[#16895C] transition-colors hover:rounded-md hover:border-green-200 hover:bg-[#F2FBF7] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-[#9AA7BA]">{isPending && pendingAction === `verify-${row.type}` ? "..." : "Verify"}</button>
            ) : row.viewUrl ? (
              <a href={row.viewUrl} target="_blank" rel="noreferrer" aria-label="View document" title="View document" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-[#174EA6] transition hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/30">
                <Eye aria-hidden="true" size={17} strokeWidth={2} />
              </a>
            ) : null}
            <button type="button" onClick={refresh} aria-label="Reload document" title="Reload document" className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-[#A35B00] transition hover:bg-[#FFF8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D08700]/30">
              <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
            </button>
            <label aria-label="Replace document" title="Replace document" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent bg-transparent text-[#C43D3D] transition hover:bg-[#FFF5F5] focus-within:ring-2 focus-within:ring-[#D15B5B]/30">
              <input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />
              <FilePenLine aria-hidden="true" size={16} strokeWidth={2} />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex min-h-11 items-center gap-2">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${visual.accent}`}><div className="text-[22px] leading-none">{visual.fallbackIcon}</div></div>
          <label title={`Upload ${row.name}`} className="min-w-0 flex-1 cursor-pointer rounded-none px-2 py-1.5 text-[11px] font-semibold text-[#071D49] transition-colors hover:rounded-md hover:bg-[#F4F8FF] hover:text-[#174EA6] focus-within:rounded-md focus-within:bg-[#F4F8FF] focus-within:ring-2 focus-within:ring-[#174EA6]/25">
            <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />
            {isPending && pendingAction === `upload-${row.type}` ? "Uploading..." : "Document not uploaded"}
          </label>
        </div>
      )}
    </article>
  );
}

function documentVisual(row: FinalDocumentRowV2): DocumentVisual {
  const value = `${row.type} ${row.name}`.toLowerCase();
  if (value.includes("spot") || value.includes("photo")) return { key: "spot", accent: "bg-[#EAF4FF]", fallbackIcon: "📷" };
  if (value.includes("rc") || value.includes("registration") || value.includes("fitness")) return { key: "rc", accent: "bg-[#F1ECFF]", fallbackIcon: "📄" };
  if (value.includes("insurance") || value.includes("policy")) return { key: "insurance", accent: "bg-[#FFF3D9]", fallbackIcon: "📃" };
  if (value.includes("driver") || value.includes("licence") || value.includes("license")) return { key: "dl", accent: "bg-[#EAF8EF]", fallbackIcon: "🪪" };
  if (value.includes("gr") || value.includes("load bill") || value.includes("challan")) return { key: "gr", accent: "bg-[#FFF1E6]", fallbackIcon: "🚚" };
  if (value.includes("video")) return { key: "video", accent: "bg-[#F2EEFF]", fallbackIcon: "🎥" };
  return { key: "document", accent: "bg-[#EEF4FF]", fallbackIcon: "📄" };
}

function DocumentTypeHeaderIcon({ visual }: { visual: DocumentVisual }) {
  const baseClassName = "h-5 w-5 shrink-0";
  if (visual.key === "spot") return <Camera aria-hidden="true" className={`${baseClassName} text-[#F037A5]`} strokeWidth={2.2} />;
  if (visual.key === "rc") return <FileText aria-hidden="true" className={`${baseClassName} text-[#16A36A]`} strokeWidth={2.2} />;
  if (visual.key === "insurance") return <ShieldCheck aria-hidden="true" className={`${baseClassName} text-[#2563EB]`} strokeWidth={2.2} />;
  if (visual.key === "dl") return <ContactRound aria-hidden="true" className={`${baseClassName} text-[#9333EA]`} strokeWidth={2.2} />;
  if (visual.key === "gr") return <Truck aria-hidden="true" className={`${baseClassName} text-[#EA7A16]`} strokeWidth={2.2} />;
  if (visual.key === "video") return <Video aria-hidden="true" className={`${baseClassName} text-[#EF233C]`} strokeWidth={2.2} />;
  return <FileText aria-hidden="true" className={`${baseClassName} text-[#071D49]`} strokeWidth={2.2} />;
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "decimal" | "numeric" }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
function StatusBadge({ status }: { status: FinalDocumentRowV2["status"] }) { const tone = status === "Verified" ? "border-green-200 bg-green-100 text-green-700" : status === "Uploaded" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-100 text-slate-600"; return <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tone}`}>{status}</span>; }