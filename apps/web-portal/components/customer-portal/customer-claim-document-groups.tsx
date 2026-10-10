"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Clock3, FilePlus2, FileText, ShieldCheck, Truck, Camera, IdCard, ReceiptText, ClipboardList, FileCheck2 } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

type Doc = { id: string; document_type: string; verification_status: string | null; created_at: string; file_name?: string | null };
const groups = [
  { name: "Vehicle Docs", types: [
    { label: "RC Copy", type: "RC Copy", icon: FileText },
    { label: "Insurance Copy", type: "Insurance Copy", icon: ShieldCheck },
    { label: "Fitness Copy", type: "Fitness Copy", icon: FileCheck2 },
    { label: "GR/Load Bill", type: "GR / Load Bill", icon: Truck },
    { label: "Fasttag report last 15 days", type: "Fasttag report last 15 days", icon: ReceiptText },
    { label: "Spot Report", type: "Spot Report", icon: Camera },
    { label: "Estimate Copy", type: "Estimate Copy", icon: ClipboardList },
  ] },
  { name: "Driver Docs", types: [{ label: "Driver Licence", type: "Driver Licence", icon: IdCard }] },
  { name: "Permit / Tax", types: [{ label: "Permit Copy", type: "Permit Copy", icon: FileText }, { label: "Tax Receipt", type: "Tax Receipt", icon: ReceiptText }, { label: "PUC Copy", type: "PUC Copy", icon: FileText }] },
  { name: "KYC / Other", types: [{ label: "KYC Document", type: "KYC Document", icon: IdCard }, { label: "Other Document", type: "Other Document", icon: FileText }] },
  { name: "Forms", types: [{ label: "Claim Form", type: "Claim Form", icon: ClipboardList }, { label: "Discharge Voucher", type: "Discharge Voucher", icon: FileCheck2 }] },
] as const;
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const verified = (status: string | null) => ["verified", "approved", "valid"].includes((status || "").toLowerCase());

function DocumentCard({ definition, documents, claimId, accountId, stage }: {
  definition: { label: string; type: string; icon: typeof FileText };
  documents: Doc[]; claimId: string; accountId: string; stage: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState("");
  const items = documents.filter(doc => normalized(doc.document_type) === normalized(definition.type));
  const approved = items.filter(doc => verified(doc.verification_status)).length;
  const pending = items.length - approved;
  const Icon = definition.icon;
  return <article className="min-w-0 rounded-xl border border-[#DCE5F4] bg-white p-3 shadow-[0_3px_12px_rgba(7,29,73,0.025)]">
    <div className="flex items-start justify-between gap-2">
      <h3 className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-[#071D49]"><Icon className="h-5 w-5 shrink-0 text-[#2460B8]"/><span>{definition.label}</span></h3>
      <form action={uploadCustomerClaimDocument} className="flex shrink-0 items-center gap-2">
        <input type="hidden" name="account" value={accountId}/>
        <input type="hidden" name="claim" value={claimId}/>
        <input type="hidden" name="stage" value={stage}/>
        <input type="hidden" name="type" value={definition.type}/>
        <input ref={input} type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" onChange={e => setChosen(e.currentTarget.files?.[0]?.name || "")} className="sr-only" aria-label={`Choose ${definition.label}`}/>
        <button type="button" onClick={() => input.current?.click()} aria-label={`Choose file for ${definition.label}`} title="Choose document" className="rounded-md p-1 text-[#2460B8] hover:bg-[#EEF4FF]"><FilePlus2 className="h-4 w-4"/></button>
        {chosen ? <button type="submit" className="rounded-md border border-[#BBD0F2] px-2 py-1 text-[10px] font-semibold text-[#24569E]">Upload</button> : null}
        <span className="rounded-full bg-[#F1F5FB] px-2 py-1 text-[10px] text-[#536781]">{items.length ? (pending ? "Pending" : "Verified") : "Verify"}</span>
      </form>
    </div>
    {items.length ? <>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {approved > 0 ? <span className="inline-flex items-center gap-1 rounded-xl bg-[#EFF9F3] px-2 py-1.5"><CheckCircle2 className="h-4 w-4 text-[#0CA66D]"/>{approved} Verified</span> : null}
        {pending > 0 ? <span className="inline-flex items-center gap-1 rounded-xl bg-[#FFF4E7] px-2 py-1.5"><Clock3 className="h-4 w-4 text-orange-500"/>{pending} Pending</span> : null}
      </div>
      <div className="mt-2 space-y-1.5">{items.map(doc => <div key={doc.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-[#E5EBF5] bg-[#FAFCFF] px-2 py-2 text-[11px]">
        {verified(doc.verification_status) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0CA66D]"/> : <Clock3 className="h-4 w-4 shrink-0 text-orange-500"/>}
        <FileText className="h-4 w-4 shrink-0 text-[#173253]"/>
        <span className="min-w-0 flex-1 truncate" title={doc.file_name || doc.document_type}>{doc.file_name || `${definition.label} · ${new Date(doc.created_at).toLocaleDateString("en-IN")}`}</span>
        <span className="shrink-0 text-[10px] capitalize text-[#64748B]">{doc.verification_status || "Pending"}</span>
      </div>)}</div>
    </> : <p className="mt-4 text-[11px] text-[#8794A7]">No document uploaded</p>}
    {chosen ? <p className="mt-2 truncate text-[10px] text-[#536781]" title={chosen}>Selected: {chosen}</p> : null}
  </article>;
}

export function CustomerClaimDocumentGroups({ documents, claimId, accountId, stage, showSaveDetails = false }: {
  documents: Doc[]; claimId: string; accountId: string; stage: string; showSaveDetails?: boolean;
}) {
  const [active, setActive] = useState(0);
  const totalVerified = documents.filter(doc => verified(doc.verification_status)).length;
  return <section className="rounded-2xl border border-[#DCE5F3] bg-white p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-[17px] font-semibold text-[#071D49]">Document Verification</h2><span className="rounded-lg bg-[#F2F5FB] px-3 py-2 text-[10px] uppercase text-[#75819A]">Documents verified {totalVerified} / {documents.length}</span></div>
    <div role="tablist" aria-label="Claim document groups" className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#D9E3F0] sm:grid-cols-5">
      {groups.map((group, i) => <button key={group.name} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`flex min-h-11 items-center gap-2 border-r border-[#D9E3F0] px-3 text-left text-[11px] font-semibold ${i === active ? "bg-gradient-to-r from-[#6853EE] to-[#4E95E9] text-white" : "bg-[#FAFCFF] text-[#183257] hover:bg-[#EDF4FF]"}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/85 text-[#164E9B]">{i + 1}</span>{group.name}</button>)}
    </div>
    <div role="tabpanel" className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups[active].types.map(definition => <DocumentCard key={definition.type} definition={definition} documents={documents} claimId={claimId} accountId={accountId} stage={stage}/>)}
    </div>
    <div className="mt-5 flex justify-end border-t border-[#E5EBF5] pt-4">
      {showSaveDetails ? <button type="submit" form="customer-claim-stage-details-form" className="rounded-lg bg-gradient-to-r from-[#6853EE] to-[#4E95E9] px-5 py-2.5 text-[12px] font-semibold text-white hover:opacity-90">Save Details</button> : null}
    </div>
  </section>;
}
