"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, ShieldCheck, Upload } from "lucide-react";
import { convertLifeHealthCaseToPolicy, uploadLifeHealthCaseDocument } from "@/app/policies/life-health-policy-actions";

type CaseData = {
  id: string; caseNumber: string; businessLine: "Life" | "Health"; status: string; sourcingDate: string;
  customerName: string; customerPhone: string; customerEmail: string; insurerName: string; productName: string;
  proposalNumber: string; ppt: string; pd: string; paymentFrequency: string; paymentMode: string; premiumAmount: number;
  intermediaryType: string; intermediaryCode: string; leadSource: string; intermediaryMobile: string; rmName: string; rmCode: string;
  remarks: string; finalPolicyId: string | null; finalPolicyNo: string | null; finalPolicyCode: string | null; convertedAt: string | null;
};
type DocumentRow = { id: string; document_type: string; file_name: string; created_at: string };
type IssueState = { policyNumber: string; issuanceDate: string; startDate: string; endDate: string; finalPremium: string; sumInsured: string };

type Props = { caseData: CaseData; documents: DocumentRow[] };
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const today = () => new Date().toISOString().slice(0, 10);
const plusYearMinusDay = (start: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return ""; const date = new Date(`${start}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() + 1); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };

const documentLabels: Record<string, string> = {
  proposal_form: "Proposal Form",
  benefit_illustration: "Benefit Illustration",
  premium_receipt: "Premium Receipt",
  policy_copy: "Policy Copy",
};

export function LifeHealthCaseDetail({ caseData, documents }: Props) {
  const router = useRouter();
  const documentMap = useMemo(() => new Map(documents.map((item) => [item.document_type, item])), [documents]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [converting, startConvert] = useTransition();
  const [issue, setIssue] = useState<IssueState>({ policyNumber: "", issuanceDate: today(), startDate: today(), endDate: plusYearMinusDay(today()), finalPremium: String(caseData.premiumAmount || ""), sumInsured: "" });
  const isIssued = Boolean(caseData.finalPolicyId);

  function upload(documentType: string, file: File | null) {
    if (!file) return;
    setError(null);
    const data = new FormData();
    data.set("caseId", caseData.id);
    data.set("documentType", documentType);
    data.set("file", file);
    startUpload(async () => {
      const result = await uploadLifeHealthCaseDocument(data);
      if (!result.ok) { setError(result.error); return; }
      router.refresh();
    });
  }

  function convert(policyCopy: File | null) {
    setError(null);
    const data = new FormData();
    data.set("caseId", caseData.id);
    Object.entries(issue).forEach(([key, value]) => data.set(key, value));
    if (policyCopy) data.set("policyCopy", policyCopy);
    startConvert(async () => {
      const result = await convertLifeHealthCaseToPolicy(data);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/policies/${result.policyId}?success=life_health_case_converted`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E2F0] bg-white px-4 py-3 shadow-sm">
        <div><div className="flex items-center gap-2 text-[9px] text-[#667085]"><Link href="/policies" className="hover:text-[#315B9A]">Policies</Link><span>›</span><Link href="/policies/life-health-cases" className="hover:text-[#315B9A]">Life / Health Cases</Link><span>›</span><span>{caseData.caseNumber}</span></div><h1 className="mt-1 text-[15px] font-semibold text-[#17365D]">{caseData.businessLine} Case · {caseData.caseNumber}</h1></div>
        <span className={`rounded-full px-3 py-1.5 text-[9px] font-bold ${isIssued ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#FFF3CD] text-[#A96A00]"}`}>{isIssued ? "Issued / Closed" : "Awaiting Policy"}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card title="Case summary" icon={<ShieldCheck className="h-4 w-4" />}>
            <Info label="Customer" value={`${caseData.customerName}${caseData.customerPhone ? ` · ${caseData.customerPhone}` : ""}`} />
            <Info label="Insurer" value={caseData.insurerName} />
            <Info label="Product" value={caseData.productName} />
            <Info label="Proposal No." value={caseData.proposalNumber} />
            <Info label="PPT" value={caseData.ppt || "—"} />
            <Info label="PD / Policy Term" value={caseData.pd || "—"} />
            <Info label="Premium" value={money.format(caseData.premiumAmount)} />
            <Info label="Payment" value={`${caseData.paymentFrequency} · ${caseData.paymentMode}`} />
          </Card>

          <Card title="Source & ownership">
            <Info label="Sourcing date" value={caseData.sourcingDate} />
            <Info label="RM" value={[caseData.rmName, caseData.rmCode].filter(Boolean).join(" · ") || "—"} />
            <Info label="Lead source" value={[caseData.leadSource, caseData.intermediaryCode].filter(Boolean).join(" · ") || "—"} />
            <Info label="Source mobile" value={caseData.intermediaryMobile || "—"} />
          </Card>

          <Card title="Case documents" subtitle="Upload or replace documents while the case is open. These exact files are linked to the final policy without uploading them again.">
            <DocumentRow caseId={caseData.id} type="proposal_form" existing={documentMap.get("proposal_form")} disabled={isIssued || uploading} onUpload={upload} />
            <DocumentRow caseId={caseData.id} type="benefit_illustration" existing={documentMap.get("benefit_illustration")} disabled={isIssued || uploading} onUpload={upload} />
            <DocumentRow caseId={caseData.id} type="premium_receipt" existing={documentMap.get("premium_receipt")} disabled={isIssued || uploading} onUpload={upload} />
            <DocumentRow caseId={caseData.id} type="policy_copy" existing={documentMap.get("policy_copy")} disabled={isIssued || uploading} onUpload={upload} />
          </Card>

          {caseData.remarks ? <Card title="Remarks"><div className="col-span-full rounded-xl bg-[#F8FAFC] px-3 py-3 text-[10px] leading-5 text-[#475467]">{caseData.remarks}</div></Card> : null}
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</div> : null}
        </div>

        <aside className="self-start overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.08)] xl:sticky xl:top-[90px]">
          {isIssued ? (
            <div><div className="border-b bg-[#F0FAF5] px-4 py-4"><div className="flex items-center gap-2 text-[#18794E]"><CheckCircle2 className="h-5 w-5" /><h2 className="text-[13px] font-bold">Policy Issued</h2></div><p className="mt-1 text-[9px] text-[#4B6F60]">The case is closed and remains available as an audit trail.</p></div><div className="space-y-3 px-4 py-4"><InfoLine label="Policy No." value={caseData.finalPolicyNo || "—"} /><InfoLine label="Policy Code" value={caseData.finalPolicyCode || "—"} /><Link href={`/policies/${caseData.finalPolicyId}`} className="block rounded-xl bg-[#17365D] px-4 py-2.5 text-center text-[10px] font-bold text-white">View Policy</Link></div></div>
          ) : (
            <IssuePanel issue={issue} setIssue={setIssue} hasPolicyCopy={documentMap.has("policy_copy")} converting={converting} onConvert={convert} />
          )}
        </aside>
      </div>
    </div>
  );
}

function IssuePanel({ issue, setIssue, hasPolicyCopy, converting, onConvert }: { issue: IssueState; setIssue: Dispatch<SetStateAction<IssueState>>; hasPolicyCopy: boolean; converting: boolean; onConvert: (file: File | null) => void }) {
  const [copy, setCopy] = useState<File | null>(null);
  const update = (key: keyof IssueState, value: string) => setIssue((current) => ({ ...current, [key]: value }));
  return <div><div className="border-b bg-[#F8FAFC] px-4 py-4"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Close case</p><h2 className="mt-1 text-[13px] font-semibold text-[#17365D]">Mark Policy Issued</h2><p className="mt-1 text-[8.5px] leading-4 text-[#667085]">Enter only the final issuance details. Case data and existing documents are reused automatically.</p></div><div className="space-y-3 px-4 py-4"><MiniField label="Policy number" value={issue.policyNumber} onChange={(value) => update("policyNumber", value.toUpperCase())} /><MiniField label="Issuance date" type="date" value={issue.issuanceDate} onChange={(value) => update("issuanceDate", value)} /><MiniField label="Policy start date" type="date" value={issue.startDate} onChange={(value) => { update("startDate", value); update("endDate", plusYearMinusDay(value)); }} /><MiniField label="Policy end / maturity date" type="date" value={issue.endDate} onChange={(value) => update("endDate", value)} /><MiniField label="Final premium" value={issue.finalPremium} onChange={(value) => update("finalPremium", value.replace(/[^0-9.]/g, ""))} /><MiniField label="Sum assured / insured" value={issue.sumInsured} onChange={(value) => update("sumInsured", value.replace(/[^0-9.]/g, ""))} placeholder="Optional" /><div><label className={labelClass}>Policy copy {!hasPolicyCopy ? <span className="text-red-500">*</span> : null}</label><label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9px] font-semibold text-[#315B9A]"><span className="truncate">{copy?.name || (hasPolicyCopy ? "Already uploaded — replace optional" : "Choose issued policy copy")}</span><Upload className="h-3.5 w-3.5 shrink-0" /><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setCopy(event.target.files?.[0] ?? null)} /></label></div><button type="button" onClick={() => onConvert(copy)} disabled={converting} className="w-full rounded-xl bg-[#17365D] px-4 py-3 text-[10px] font-bold text-white disabled:opacity-60">{converting ? "Creating policy…" : "Create Policy & Close Case"}</button><p className="text-[8px] leading-4 text-[#7A8798]">The case is marked Issued only after the policy record, Life/Health details, premium details and document links are all created successfully.</p></div></div>;
}

function Card({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="border-b bg-[#FBFCFE] px-4 py-3"><div className="flex items-center gap-2 text-[#17365D]">{icon}<h2 className="text-[12px] font-semibold">{title}</h2></div>{subtitle ? <p className="mt-1 text-[8.5px] text-[#667085]">{subtitle}</p> : null}</div><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div></section>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[.06em] text-[#7A8798]">{label}</p><p className="mt-1 truncate text-[10.5px] font-semibold text-[#17365D]" title={value}>{value}</p></div>; }
function InfoLine({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-[#E8EDF3] pb-2 text-[9.5px]"><span className="text-[#667085]">{label}</span><span className="text-right font-semibold text-[#17365D]">{value}</span></div>; }
function MiniField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <div><label className={labelClass}>{label}</label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} /></div>; }
function DocumentRow({ type, existing, disabled, onUpload }: { caseId: string; type: string; existing?: DocumentRow; disabled: boolean; onUpload: (type: string, file: File | null) => void }) { const id = `case-doc-${type}`; return <div className={`col-span-full flex items-center gap-3 rounded-xl border px-3 py-3 ${existing ? "border-emerald-200 bg-emerald-50/30" : "border-[#DCE3EC] bg-white"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${existing ? "bg-emerald-100 text-emerald-700" : "bg-[#EEF4FB] text-[#315B9A]"}`}>{existing ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-[9.5px] font-bold text-[#17365D]">{documentLabels[type] || type}</p><p className="truncate text-[8px] text-[#667085]">{existing?.file_name || "Not uploaded"}</p></div>{!disabled ? <label htmlFor={id} className="cursor-pointer rounded-lg border border-[#CAD7E7] bg-white px-2.5 py-1.5 text-[8px] font-bold text-[#315B9A]">{existing ? "Replace" : "Upload"}<input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onUpload(type, event.target.files?.[0] ?? null)} /></label> : null}</div>; }
