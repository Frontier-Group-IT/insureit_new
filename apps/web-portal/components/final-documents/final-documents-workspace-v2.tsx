"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFinalDealershipDetails, submitFinalDocumentsDraft, uploadFinalDocument, verifyFinalDocument } from "./final-documents-actions";

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

const tabs = ["Forms", "Permit / Tax", "Spots Papers", "Driver Docs", "KYC Dealership"];

export function FinalDocumentsWorkspaceV2({ claimId, rows, dealershipDetails }: { claimId: string; rows: FinalDocumentRowV2[]; dealershipDetails?: DealershipDetailsV2 | null }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dealership, setDealership] = useState({
    dealership_name: dealershipDetails?.dealership_name ?? "",
    dealership_address: dealershipDetails?.dealership_address ?? "",
    contact_person_name: dealershipDetails?.contact_person_name ?? "",
    contact_number: dealershipDetails?.contact_number ?? ""
  });
  const visibleRows = rows.filter((row) => row.groupIndex === activeTab);

  function baseForm() {
    const formData = new FormData();
    formData.set("claimId", claimId);
    return formData;
  }

  function run(label: string, action: () => Promise<ActionResult>) {
    setResult(null);
    setPendingAction(label);
    startTransition(async () => {
      const response = await action();
      setResult(response);
      setPendingAction(null);
      if (response.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[#071D49]">Dealership Details</h2>
          <button type="button" disabled={isPending && pendingAction === "dealership"} onClick={() => run("dealership", () => { const formData = baseForm(); formData.set("dealership_name", dealership.dealership_name); formData.set("dealership_address", dealership.dealership_address); formData.set("contact_person_name", dealership.contact_person_name); formData.set("contact_number", dealership.contact_number); return saveFinalDealershipDetails(formData); })} className="rounded-lg border border-[#BFD3F7] bg-[#F7FAFF] px-4 py-2 text-[12px] font-semibold text-[#174EA6] disabled:opacity-60">{isPending && pendingAction === "dealership" ? "Saving..." : "Save Details"}</button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Dealership Name" value={dealership.dealership_name} onChange={(value) => setDealership((prev) => ({ ...prev, dealership_name: value }))} />
          <Field label="Dealership Address" value={dealership.dealership_address} onChange={(value) => setDealership((prev) => ({ ...prev, dealership_address: value }))} multiline />
          <Field label="Contact Person Name" value={dealership.contact_person_name} onChange={(value) => setDealership((prev) => ({ ...prev, contact_person_name: value }))} />
          <Field label="Contact Number" value={dealership.contact_number} onChange={(value) => setDealership((prev) => ({ ...prev, contact_number: value }))} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[17px] font-semibold text-[#071D49]">Check List For - GCCV Motor Claim</h2><p className="mt-1 text-[12px] font-medium text-[#526178]">Upload and verify final documents before claim intimation.</p></div><span className="rounded-full border border-[#D9E6F7] bg-[#F7FAFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Final Documents</span></div>
        <div className="grid overflow-hidden rounded-xl border border-[#D9E3F0] md:grid-cols-5">{tabs.map((tab, index) => <button key={tab} type="button" onClick={() => setActiveTab(index)} className={`flex items-center gap-2 px-4 py-3 text-left text-[12px] font-semibold ${activeTab === index ? "bg-[#071D49] text-white" : "bg-[#FBFCFE] text-[#071D49] border-l border-[#D9E3F0]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${activeTab === index ? "bg-white text-[#071D49]" : "bg-[#EEF4FF] text-[#071D49]"}`}>{index + 1}</span>{tab}</button>)}</div>
        <div className="mt-3 overflow-hidden rounded-xl border border-[#D9E3F0]"><table className="w-full min-w-[900px] border-collapse text-left text-[12px]"><thead className="bg-[#071D49] text-white"><tr><th className="px-3 py-2">Sr. No.</th><th className="px-3 py-2">Document Name</th><th className="px-3 py-2 text-center">Upload Document</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-center">Actions</th></tr></thead><tbody className="divide-y divide-[#E6EEF7] bg-white">{visibleRows.map((row) => <DocumentRow key={row.type} claimId={claimId} row={row} isPending={isPending} pendingAction={pendingAction} run={run} refresh={() => router.refresh()} />)}</tbody></table></div>
        {result ? <p className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={activeTab === 0} onClick={() => setActiveTab((value) => Math.max(0, value - 1))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49] disabled:bg-[#F4F7FC] disabled:text-[#9AA7BA]">Previous</button><div className="flex gap-3"><button type="button" onClick={() => run("draft", () => submitFinalDocumentsDraft(baseForm()))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49]">Save as Draft</button><button type="button" className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white">Submit Claim Intimation</button><button type="button" disabled={activeTab === tabs.length - 1} onClick={() => setActiveTab((value) => Math.min(tabs.length - 1, value + 1))} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">Next</button></div></div>
      </section>
    </div>
  );
}

function DocumentRow({ claimId, row, isPending, pendingAction, run, refresh }: { claimId: string; row: FinalDocumentRowV2; isPending: boolean; pendingAction: string | null; run: (label: string, action: () => Promise<ActionResult>) => void; refresh: () => void }) {
  function upload(file: File) { run(`upload-${row.type}`, () => { const formData = new FormData(); formData.set("claimId", claimId); formData.set("documentType", row.type); formData.set("file", file); return uploadFinalDocument(formData); }); }
  function verify() { run(`verify-${row.type}`, () => { const formData = new FormData(); formData.set("claimId", claimId); formData.set("documentId", row.documentId ?? ""); formData.set("documentType", row.type); return verifyFinalDocument(formData); }); }
  return <tr className="hover:bg-[#F8FBFF]"><td className="px-3 py-2 font-semibold text-[#526178]">{row.groupSr}</td><td className="px-3 py-2"><p className="font-semibold text-[#071D49]">{row.name}</p>{row.fileName ? <p className="mt-0.5 text-[10px] text-[#526178]">{row.fileName}</p> : null}</td><td className="px-3 py-2 text-center">{row.viewUrl ? <a href={row.viewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6]">View</a> : <label className="inline-flex cursor-pointer rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6]"><input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />{isPending && pendingAction === `upload-${row.type}` ? "Uploading..." : "Upload"}</label>}</td><td className="px-3 py-2 text-center"><StatusPill status={row.status} /></td><td className="px-3 py-2">{row.status === "Verified" ? <div className="flex justify-center"><span className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-semibold text-green-700">Verified</span></div> : <div className="flex justify-center gap-2"><button type="button" disabled={!row.documentId || isPending} onClick={verify} className="rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6] disabled:cursor-not-allowed disabled:border-[#D9E3F0] disabled:text-[#9AA7BA]">{isPending && pendingAction === `verify-${row.type}` ? "Verifying..." : "Verify"}</button><label className="cursor-pointer rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49]"><input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} />Replace</label><button type="button" onClick={refresh} className="rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49]">Reload</button></div>}</td></tr>;
}

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) { return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] font-semibold text-[#071D49] outline-none focus:border-[#174EA6]" />}</label>; }
function StatusPill({ status }: { status: FinalDocumentRowV2["status"] }) { const tone = status === "Verified" ? "border-green-200 bg-green-50 text-green-700" : status === "Uploaded" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"; return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>; }
