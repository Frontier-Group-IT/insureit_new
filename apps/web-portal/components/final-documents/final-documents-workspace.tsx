"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";
import { saveFinalDealershipDetails, submitFinalDocumentsDraft, uploadFinalDocument, verifyFinalDocument } from "./final-documents-actions";

export type FinalDocumentRow = {
  sr: number;
  type: string;
  name: string;
  status: "Pending" | "Uploaded" | "Verified";
  documentId: string | null;
  fileName: string | null;
};

export type DealershipDetails = {
  dealership_name?: string;
  dealership_address?: string;
  contact_person_name?: string;
  contact_number?: string;
};

type ActionResult = { ok: boolean; message?: string };

const groups = ["Forms", "Documents 6 - 10", "Documents 11 - 15", "Documents 16 - 20", "Documents 21 - 26"];

export function FinalDocumentsWorkspace({ claimId, rows, dealershipDetails }: { claimId: string; rows: FinalDocumentRow[]; dealershipDetails?: DealershipDetails | null }) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dealership, setDealership] = useState({
    dealership_name: dealershipDetails?.dealership_name ?? "",
    dealership_address: dealershipDetails?.dealership_address ?? "",
    contact_person_name: dealershipDetails?.contact_person_name ?? "",
    contact_number: dealershipDetails?.contact_number ?? ""
  });
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const visibleRows = useMemo(() => rows.slice(activeGroup * 5, activeGroup * 5 + 5), [rows, activeGroup]);
  const canPrevious = activeGroup > 0;
  const canNext = activeGroup < groups.length - 1;

  function runAction(label: string, action: () => Promise<ActionResult>) {
    setResult(null);
    setPendingAction(label);
    startTransition(async () => {
      const response = await action();
      setResult(response);
      setPendingAction(null);
      if (response.ok) router.refresh();
    });
  }

  function formForBase() {
    const formData = new FormData();
    formData.set("claimId", claimId);
    return formData;
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[#071D49]">Dealership Details</h2>
          <button
            type="button"
            disabled={isPending && pendingAction === "dealership"}
            onClick={() => runAction("dealership", () => {
              const formData = formForBase();
              formData.set("dealership_name", dealership.dealership_name);
              formData.set("dealership_address", dealership.dealership_address);
              formData.set("contact_person_name", dealership.contact_person_name);
              formData.set("contact_number", dealership.contact_number);
              return saveFinalDealershipDetails(formData);
            })}
            className="h-9 rounded-lg border border-[#BFD3F7] bg-[#F7FAFF] px-4 text-[12px] font-semibold text-[#174EA6] transition hover:bg-white disabled:opacity-60"
          >
            {isPending && pendingAction === "dealership" ? <InsureItButtonLoader label="Saving" /> : "Save Details"}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <EditableInput label="Dealership Name" value={dealership.dealership_name} onChange={(value) => setDealership((prev) => ({ ...prev, dealership_name: value }))} />
          <EditableInput label="Dealership Address" value={dealership.dealership_address} onChange={(value) => setDealership((prev) => ({ ...prev, dealership_address: value }))} multiline />
          <EditableInput label="Contact Person Name" value={dealership.contact_person_name} onChange={(value) => setDealership((prev) => ({ ...prev, contact_person_name: value }))} />
          <EditableInput label="Contact Number" value={dealership.contact_number} onChange={(value) => setDealership((prev) => ({ ...prev, contact_number: value.replace(/\D/g, "").slice(0, 10) }))} />
        </div>
      </section>

      <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#071D49]">Check List For - GCCV Motor Claim</h2>
            <p className="mt-1 text-[12px] font-medium text-[#526178]">Upload and verify final documents before claim intimation.</p>
          </div>
          <span className="rounded-full border border-[#D9E6F7] bg-[#F7FAFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">Final Documents</span>
        </div>

        <div className="grid overflow-hidden rounded-xl border border-[#D9E3F0] md:grid-cols-5">
          {groups.map((group, index) => (
            <button key={group} type="button" onClick={() => setActiveGroup(index)} className={`flex items-center gap-2 border-b border-[#D9E3F0] px-4 py-3 text-left text-[12px] font-semibold md:border-b-0 ${activeGroup === index ? "bg-[#071D49] text-white" : "bg-[#FBFCFE] text-[#071D49] md:border-l"}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${activeGroup === index ? "bg-white text-[#071D49]" : "bg-[#EEF4FF] text-[#071D49]"}`}>{index + 1}</span>
              {group}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[#D9E3F0]">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead className="bg-[#071D49] text-white">
              <tr>
                <th className="px-3 py-2 font-semibold">Sr. No.</th>
                <th className="px-3 py-2 font-semibold">Document Name</th>
                <th className="px-3 py-2 text-center font-semibold">Upload Document</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
                <th className="px-3 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EEF7] bg-white">
              {visibleRows.map((row) => (
                <tr key={row.type} className="hover:bg-[#F8FBFF]">
                  <td className="px-3 py-2 font-semibold text-[#526178]">{row.sr}</td>
                  <td className="px-3 py-2"><p className="font-semibold text-[#071D49]">{row.name}</p>{row.fileName ? <p className="mt-0.5 truncate text-[10px] font-medium text-[#526178]">{row.fileName}</p> : null}</td>
                  <td className="px-3 py-2 text-center">
                    <input ref={(node) => { fileInputs.current[row.type] = node; }} type="file" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      runAction(`upload-${row.type}`, () => {
                        const formData = formForBase();
                        formData.set("documentType", row.type);
                        formData.set("file", file);
                        return uploadFinalDocument(formData);
                      });
                      event.target.value = "";
                    }} />
                    <button type="button" onClick={() => fileInputs.current[row.type]?.click()} disabled={isPending && pendingAction === `upload-${row.type}`} className="rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6] transition hover:bg-[#F7FAFF] disabled:opacity-60">
                      {isPending && pendingAction === `upload-${row.type}` ? "Uploading..." : row.status === "Pending" ? "Upload" : "Replace File"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center"><StatusPill status={row.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-2">
                      <button type="button" disabled={!row.documentId || row.status === "Verified" || isPending} onClick={() => runAction(`verify-${row.type}`, () => {
                        const formData = formForBase();
                        formData.set("documentId", row.documentId ?? "");
                        formData.set("documentType", row.type);
                        return verifyFinalDocument(formData);
                      })} className="rounded-md border border-[#BFD3F7] bg-white px-3 py-1 text-[11px] font-semibold text-[#174EA6] transition hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:border-[#D9E3F0] disabled:text-[#9AA7BA]">
                        {isPending && pendingAction === `verify-${row.type}` ? "Verifying..." : row.status === "Verified" ? "Verified" : "Verify"}
                      </button>
                      <button type="button" onClick={() => fileInputs.current[row.type]?.click()} className="rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49] transition hover:bg-[#F7FAFF]">Replace</button>
                      <button type="button" onClick={() => router.refresh()} className="rounded-md border border-[#D9E3F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#071D49] transition hover:bg-[#F7FAFF]">Reload</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result ? <p className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={!canPrevious} onClick={() => setActiveGroup((value) => Math.max(0, value - 1))} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49] transition hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:bg-[#F4F7FC] disabled:text-[#9AA7BA]">Previous</button>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => runAction("draft", () => { const formData = formForBase(); return submitFinalDocumentsDraft(formData); })} className="rounded-lg border border-[#D9E3F0] bg-white px-5 py-2 text-[12px] font-semibold text-[#071D49] transition hover:bg-[#F7FAFF]">{isPending && pendingAction === "draft" ? "Saving..." : "Save as Draft"}</button>
            <button type="button" className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white">Submit Claim Intimation</button>
            <button type="button" disabled={!canNext} onClick={() => setActiveGroup((value) => Math.min(groups.length - 1, value + 1))} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A9B4C5]">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function EditableInput({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#174EA6]">{label} <span className="text-red-600">*</span></span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={2} className="mt-1 min-h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#071D49] outline-none transition focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" /> : <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#D9E3F0] bg-white px-3 py-2 text-[12px] font-semibold text-[#071D49] outline-none transition focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" />}</label>;
}

function StatusPill({ status }: { status: FinalDocumentRow["status"] }) {
  const tone = status === "Verified" ? "border-green-200 bg-green-50 text-green-700" : status === "Uploaded" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}>{status}</span>;
}
