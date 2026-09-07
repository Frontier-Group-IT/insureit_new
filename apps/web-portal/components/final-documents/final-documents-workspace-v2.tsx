"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeClaimJourneyStage } from "@/app/claims/stage-actions";
import { finalDocumentTabs } from "./final-document-groups";
import { loadFinalClaimIntimationDetails, saveFinalDealershipDetails, submitFinalDocumentsDraft, uploadFinalDocument, verifyFinalDocument } from "./final-documents-actions";

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

export function FinalDocumentsWorkspaceV2({ claimId, rows, dealershipDetails }: { claimId: string; rows: FinalDocumentRowV2[]; dealershipDetails?: DealershipDetailsV2 | null }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
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
    loadFinalClaimIntimationDetails(claimId).then((response) => {
      if (!cancelled && response.ok && response.details) setDetails(response.details);
    });
    return () => { cancelled = true; };
  }, [claimId]);

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

  function run(label: string, action: () => Promise<ActionResult>) {
    setResult(null);
    setPendingAction(label);
    startTransition(async () => {
      const response = await action();
      setResult(response);
      setPendingAction(null);
      if (response.ok) setTimeout(() => router.refresh(), 0);
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
        if (response.advanced) {
          setResult({ ok: true, message: "Claim Intimation completed. Work Approval is now open." });
          router.replace(`/claims/${claimId}?stage=work_approval`);
          router.refresh();
          return;
        }
        setResult({ ok: true, message: "Stage details saved." });
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
        {result ? <p className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={activeTab === 0} onClick={() => setActiveTab((value) => Math.max(0, value - 1))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49] disabled:bg-[#F4F7FC] disabled:text-[#9AA7BA]">Previous</button><div className="flex items-center gap-3"><button type="button" onClick={() => run("draft", () => submitFinalDocumentsDraft(baseForm()))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49]">Save as Draft</button><span className="hidden text-[11px] text-[#68758A] sm:inline">Complete all mandatory stage fields, then save to continue.</span><button type="button" disabled={isPending} onClick={saveAndContinue} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">{isPending && pendingAction === "save-continue" ? "Saving..." : "Save Details"}</button><button type="button" disabled={activeTab === finalDocumentTabs.length - 1 || isPending} onClick={() => setActiveTab((value) => Math.min(finalDocumentTabs.length - 1, value + 1))} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">Next</button></div></div>
      </section>
    </div>
  );
}

function DocumentCard({ claimId, row, isPending, pendingAction, run, refresh }: { claimId: string; row: FinalDocumentRowV2; isPending: boolean; pendingAction: string | null; run: (label: string, action: () => Promise<ActionResult>) => void; refresh: () => void }) {
  function upload(file: File) { run(`upload-${row.type}`, () => { const formData = new FormData(); formData.set("claimId", claimId); formData.set("documentType", row.type); formData.set("file", file); return uploadFinalDocument(formData); }); }
  function verify() { run(`verify-${row.type}`, () => { const formData = new FormData(); formData.set("claimId", claimId); formData.set("documentId", row.documentId ?? ""); formData.set("documentType", row.type); return verifyFinalDocument(formData); }); }
  const verified = row.status === "Verified";
  const uploaded = row.status === "Uploaded";
  const borderTone = verified ? "border-green-200" : "border-[#E2EAF4]";
  return (
    <article className={`rounded-xl border bg-white p-2.5 shadow-[0_6px_16px_rgba(7,29,73,0.028)] ${borderTone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center text-[17px] leading-none">📄</span><h2 className="truncate text-[13px] font-semibold leading-tight text-[#071D49]">{row.name}</h2></div>
        <StatusPill status={row.status} />
      </div>
      <div className="grid grid-cols-[32px_1fr] items-start gap-2 rounded-lg border border-[#E2EAF4] bg-white/80 p-2">
        <div className="grid h-8 w-8 place-items-center text-[18px]">📄</div>
        <div className="min-w-0">
          <p className="flex min-h-8 items-center truncate text-[11px] font-semibold text-[#071D49]">{row.fileName ?? "Document not uploaded"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1"><span className="rounded bg-[#F4F7FC] px-1.5 py-0.5 text-[9px] font-semibold text-[#526178]">{row.name}</span>{row.viewUrl ? <a href={row.viewUrl} target="_blank" rel="noreferrer" className="rounded bg-[#EAF7F0] px-1.5 py-0.5 text-[9px] font-semibold text-[#00875A]">Preview</a> : null}<span className="rounded bg-[#F4F7FC] px-1.5 py-0.5 text-[9px] font-semibold text-[#526178]">{row.status}</span></div>
          {verified ? <div className="mt-2 grid grid-cols-1"><span className="h-8 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-center text-[11px] font-semibold text-green-700">Verified</span></div> : <div className="mt-2 grid grid-cols-3 gap-1.5"><button type="button" disabled={!row.documentId || isPending} onClick={verify} className="h-8 rounded-md border border-[#BFD3F7] bg-white px-2 text-[11px] font-semibold text-[#174EA6] disabled:cursor-not-allowed disabled:border-[#D9E3F0] disabled:text-[#9AA7BA]">{isPending && pendingAction === `verify-${row.type}` ? "Verifying..." : "Verify"}</button><label className="grid h-8 cursor-pointer place-items-center rounded-md border border-[#D9E3F0] bg-white px-2 text-[11px] font-semibold text-[#071D49]"><input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />{row.documentId ? "Replace" : isPending && pendingAction === `upload-${row.type}` ? "Uploading..." : "Upload"}</label><button type="button" onClick={refresh} className="h-8 rounded-md border border-[#D9E3F0] bg-white px-2 text-[11px] font-semibold text-[#071D49]">Reload</button></div>}
          {!row.documentId && !uploaded ? <p className="mt-1.5 text-[9px] font-semibold text-[#68758A]">Upload the document to enable verification.</p> : null}
        </div>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "decimal" | "numeric" }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /></label>; }
function StatusPill({ status }: { status: FinalDocumentRowV2["status"] }) { const tone = status === "Verified" ? "border-green-200 bg-green-100 text-green-700" : status === "Uploaded" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-100 text-slate-600"; return <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${tone}`}>{status}</span>; }
