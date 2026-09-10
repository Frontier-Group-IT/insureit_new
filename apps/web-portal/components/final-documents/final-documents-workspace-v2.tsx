"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { matchesClaimIntimationDocument } from "@insureit/claim-journey";
import { completeClaimJourneyStage } from "@/app/claims/stage-actions";
import { ClaimStageSuccessPopup } from "@/components/claim-manager/claim-stage-success-popup";
import { finalDocumentDefinitions, finalDocumentTabs } from "./final-document-groups";
import { loadFinalClaimIntimationDetails, saveFinalDealershipDetails, submitFinalDocumentsDraft } from "./final-documents-actions";
import { loadFinalDocumentVerificationData, type FinalVerificationData, type FinalVerificationDocument } from "./final-document-verification-data-actions";
import { Stage3DocumentVerificationGroup, type Stage3DocumentVerificationItem } from "./stage3-document-verification-group";
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
  key: Stage3DocumentVerificationItem["visualKey"];
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
  const [verificationData, setVerificationData] = useState<FinalVerificationData | null>(null);
  const [verificationLoadError, setVerificationLoadError] = useState("");
  const [details, setDetails] = useState<ClaimIntimationDetails>({
    claim_intimation_date: dealershipDetails?.contact_person_name ?? "",
    dealership_name: dealershipDetails?.dealership_name ?? "",
    dealership_location: dealershipDetails?.dealership_address ?? "",
    gate_in_date: dealershipDetails?.contact_number ?? "",
    estimate_amount: ""
  });
  const visibleRows = rows.filter((row) => row.groupIndex === activeTab);

  const verifiedCount = useMemo(() => {
    if (!verificationData) return rows.filter((row) => row.status === "Verified").length;
    return rows.filter((row) => {
      const matching = documentsForType(verificationData.documents, row.type);
      return matching.length > 0 && matching.every((document) => isDocumentVerified(document, verificationData));
    }).length;
  }, [rows, verificationData]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadFinalClaimIntimationDetails(claimId),
      loadStage3UnclassifiedAttachments(claimId),
      loadFinalDocumentVerificationData(claimId),
    ]).then(([detailsResponse, attachmentResponse, verificationResponse]) => {
      if (cancelled) return;
      if (detailsResponse.ok && detailsResponse.details) setDetails(detailsResponse.details);
      if (attachmentResponse.ok) setUnclassifiedAttachments(attachmentResponse.attachments ?? []);
      if (verificationResponse.ok) {
        setVerificationData(verificationResponse.data);
        setVerificationLoadError("");
      } else {
        setVerificationLoadError(verificationResponse.message);
      }
    });
    return () => { cancelled = true; };
  }, [claimId, rows]);

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
        setSuccessNotice(response.advanced ? "Claim Intimation completed. Work Approval is now open." : "Stage details saved.");
        router.replace(`/claims/${claimId}?stage=work_approval`);
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
        {verificationData ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRows.map((row) => {
              const visual = documentVisual(row);
              const item: Stage3DocumentVerificationItem = {
                key: `stage3-${row.groupIndex}-${row.groupSr}`,
                visualKey: visual.key,
                verificationKey: verificationKeyFor(row.type),
                title: row.name,
                icon: visual.fallbackIcon,
                accent: visual.accent,
                documentType: row.type,
                documents: documentsForType(verificationData.documents, row.type),
              };
              return <Stage3DocumentVerificationGroup key={row.type} item={item} claim={verificationData.claim} verifications={verificationData.verifications} />;
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-[#E2EAF4] bg-[#FBFCFE] px-4 py-5 text-center text-[11px] font-semibold text-[#68758A]">{verificationLoadError || "Loading documents..."}</div>
        )}
        {result && !result.ok ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{result.message}</p> : null}
        <div className="mt-4 flex justify-end"><div className="flex items-center gap-3"><button type="button" onClick={() => run("draft", () => submitFinalDocumentsDraft(baseForm()))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49]">Save as Draft</button><button type="button" disabled={isPending} onClick={saveAndContinue} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">{isPending && pendingAction === "save-continue" ? "Saving..." : "Save Details"}</button></div></div>
      </section>

      {successNotice ? <ClaimStageSuccessPopup message={successNotice} /> : null}
    </div>
  );
}

function documentsForType(documents: FinalVerificationDocument[], documentType: string) {
  return documents.filter((document) => matchesClaimIntimationDocument(document.document_type ?? "", documentType));
}

function isDocumentVerified(document: FinalVerificationDocument, data: FinalVerificationData) {
  const verification = data.verifications.find((row) => row.document_id === document.id);
  return document.verification_status === "verified" || Boolean(verification?.is_valid);
}

function verificationKeyFor(documentType: string): Stage3DocumentVerificationItem["verificationKey"] {
  const value = documentType.toLowerCase();
  if (value.includes("spot")) return "spot";
  if (value === "rc copy" || value.includes("registration certificate")) return "rc";
  if (value.includes("insurance") || value.includes("policy copy")) return "insurance";
  if (value.includes("driving licence") || value.includes("driver licence") || value.includes("driving license") || value.includes("dl copy")) return "dl";
  if (value.includes("gr / load bill") || value.includes("load challan") || value.includes("road challan")) return "gr";
  return "document";
}

function documentVisual(row: FinalDocumentRowV2): DocumentVisual {
  const value = `${row.type} ${row.name}`.toLowerCase();
  if (value.includes("spot") || value.includes("photo")) return { key: "spot", accent: "bg-[#EAF4FF]", fallbackIcon: "📷" };
  if (value.includes("rc") || value.includes("registration") || value.includes("fitness")) return { key: "rc", accent: "bg-[#F1ECFF]", fallbackIcon: "📄" };
  if (value.includes("insurance") || value.includes("policy")) return { key: "insurance", accent: "bg-[#FFF3D9]", fallbackIcon: "📃" };
  if (value.includes("driver") || value.includes("licence") || value.includes("license")) return { key: "dl", accent: "bg-[#EAF8EF]", fallbackIcon: "🪪" };
  if (value.includes("gr") || value.includes("load bill") || value.includes("challan")) return { key: "gr", accent: "bg-[#FFF1E6]", fallbackIcon: "🚚" };
  if (value.includes("video")) return { key: "video", accent: "bg-[#F2EEFF]", fallbackIcon: "🎥" };
  if (value.includes("audio") || value.includes("voice")) return { key: "audio", accent: "bg-[#EEF4FF]", fallbackIcon: "🎙️" };
  return { key: "document", accent: "bg-[#EEF4FF]", fallbackIcon: "📄" };
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "decimal" | "numeric" }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
