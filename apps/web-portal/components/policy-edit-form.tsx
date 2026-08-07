"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { updatePolicyOnboarding, type PolicyEditPayload } from "@/app/policies/policy-edit-actions";
import { PolicyOcrImportPanel } from "@/components/policy-ocr-import-panel";

export type PolicyEditValues = {
  policyId: string;
  policyCode: string;
  issuanceDate: string;
  rmName: string;
  intermediaryType: string;
  leadSource: string;
  intermediaryCode: string;
  businessLine: string;
  registrationNo: string;
  insuredName: string;
  phoneNo: string;
  vehicleClass: string;
  make: string;
  model: string;
  fuelType: string;
  capacity: string;
  manufacturingYear: string;
  chassisNo: string;
  engineNo: string;
  rtoState: string;
  rtoName: string;
  policyProduct: string;
  idv: string;
  od: string;
  tp: string;
  cpaOpted: "Yes" | "No";
  cpa: string;
  policyNo: string;
  insurerId: string;
  validFrom: string;
  validUpto: string;
  payoutBasis: string;
  projectedOdPercent: string;
  projectedTpPercent: string;
  insurerScheme: string;
  retention: string;
  payoutOdPercent: string;
  payoutTpPercent: string;
  payoutStatus: string;
  payoutDate: string;
  payoutVoucherNo: string;
  remarks: string;
};

type SelectOption = { label: string; value: string };
type Props = { values: PolicyEditValues; insurers: SelectOption[] };
type EditableState = Omit<PolicyEditValues, "policyId" | "policyCode">;

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#E3E8EF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout", "Review"];
const vehicleClassMap: Record<string, { description: string; capacityLabel: string }> = {
  PCP: { description: "Private Car", capacityLabel: "CC" },
  TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" },
  PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" },
  CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" },
};

export function PolicyEditForm({ values, insurers }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<EditableState>(() => {
    const { policyId: _policyId, policyCode: _policyCode, ...editable } = values;
    return editable;
  });
  const [activeSection, setActiveSection] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const numeric = (value: string) => Number(value || 0);
  const calculations = useMemo(() => {
    const od = numeric(form.od);
    const tp = numeric(form.tp);
    const cpa = form.cpaOpted === "Yes" ? numeric(form.cpa) : 0;
    const net = od + tp + cpa;
    const gst = form.vehicleClass === "GCV" ? ((od + cpa) * .18) + (tp * .05) : net * .18;
    const gross = net + gst;
    const projectedOd = od * numeric(form.projectedOdPercent) / 100;
    const projectedTp = tp * numeric(form.projectedTpPercent) / 100;
    const totalPayin = projectedOd + projectedTp + numeric(form.insurerScheme);
    const tds = totalPayin * .10;
    const payinAfterTds = totalPayin - tds;
    const payoutOd = od * numeric(form.payoutOdPercent) / 100;
    const payoutTp = form.payoutBasis === "OD" ? 0 : tp * numeric(form.payoutTpPercent) / 100;
    const grossPayout = Math.max(0, payoutOd + payoutTp - numeric(form.retention));
    return { net, gst, gross, projectedOd, projectedTp, totalPayin, tds, payinAfterTds, grossPayout };
  }, [form]);

  function update<K extends keyof EditableState>(key: K, value: EditableState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function buildPayload(): PolicyEditPayload {
    return {
      policy: {
        issuanceDate: form.issuanceDate,
        rmName: form.rmName,
        intermediaryType: form.intermediaryType,
        leadSource: form.leadSource,
        intermediaryCode: form.intermediaryCode,
        businessLine: form.businessLine,
        policyType: form.policyProduct,
        idv: form.idv,
        policyNumber: form.policyNo,
        insuranceCompanyId: form.insurerId,
        validFrom: form.validFrom,
        validUpto: form.validUpto,
        remarks: form.remarks,
      },
      premium: { od: form.od, tp: form.tp, cpaOpted: form.cpaOpted === "Yes", cpa: form.cpaOpted === "Yes" ? form.cpa : "0" },
      payin: { basis: form.payoutBasis, odPercent: form.projectedOdPercent, tpPercent: form.projectedTpPercent, scheme: form.insurerScheme },
      payout: { retention: form.retention, odPercent: form.payoutOdPercent, tpPercent: form.payoutTpPercent, status: form.payoutStatus, date: form.payoutDate, voucherNumber: form.payoutVoucherNo },
    };
  }

  function savePolicy() {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await updatePolicyOnboarding(values.policyId, buildPayload());
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      const policyRef = result.policyCode || values.policyCode || form.policyNo;
      router.push(`/policies?success=policy_updated&policy=${encodeURIComponent(policyRef)}`);
      router.refresh();
    });
  }

  const vehicleMeta = vehicleClassMap[form.vehicleClass];
  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP"
    ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"]
    : ["Package", "Third Party", "SAOD"];

  return <div className="mx-auto max-w-[1480px] pb-24">
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#E7ECF3] bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">Existing policy</span>
            <span className="text-[9px] text-white/70">{values.policyCode || form.policyNo} · prototype_v1 calculations</span>
          </div>
          <h1 className="mt-2 text-[18px] font-semibold">Edit Policy</h1>
          <p className="mt-0.5 text-[10px] text-white/70">Update policy and financial details while preserving the linked customer and vehicle master records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PolicyOcrImportPanel />
          <button type="button" onClick={savePolicy} disabled={isSubmitting} className="rounded-xl bg-white px-5 py-2.5 text-[10px] font-bold text-[#071D49] shadow-sm disabled:opacity-60">{isSubmitting ? "Saving changes…" : "Save Policy Changes"}</button>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">{sections.map((section,index)=><button key={section} type="button" onClick={()=>setActiveSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6]"}`}>{index+1}</span>{section}</button>)}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <Section number="01" title="Policy source & ownership" subtitle="Update who owns the business and the policy source classification." badge="Manual + master selections">
          <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required />
          <Select label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} options={[form.rmName].filter(Boolean)} placeholder="Select RM" required />
          <Select label="Intermediary type" value={form.intermediaryType} onChange={e=>update("intermediaryType",e.target.value)} options={["POSP","MISP","SIBL / Partner"]} placeholder="Select type" required />
          <Field label="Lead source" value={form.leadSource} onChange={e=>update("leadSource",e.target.value)} placeholder="Search person / channel" />
          <SourceDerivedStrip month={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto"} code={form.intermediaryCode} onCodeChange={(value)=>update("intermediaryCode", value.toUpperCase())} />
          <Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select policy type" />
        </Section>

        <Section number="02" title="Insured & vehicle identification" subtitle="Customer and vehicle identity are linked master records and are protected from policy-level edits." badge="Linked master · read-only">
          <ReadOnlyField label="Registration number" value={form.registrationNo} required />
          <ReadOnlyField label="Insured name" value={form.insuredName} required />
          <ReadOnlyField label="Phone number" value={form.phoneNo} required />
          <ReadOnlyField label="Class of vehicle" value={form.vehicleClass} required />
          <DerivedDisplay label="Vehicle classification" value={vehicleMeta?.description || "—"} source="Master" />
          <ReadOnlyField label="Make" value={form.make} />
          <ReadOnlyField label="Model" value={form.model} />
          <ReadOnlyField label="Fuel type" value={form.fuelType} />
          <ReadOnlyField label={vehicleMeta?.capacityLabel || "CC / Seating / GVW / Category"} value={form.capacity} />
          <ReadOnlyField label="Year of manufacturing" value={form.manufacturingYear} />
          <ReadOnlyField label="Chassis number" value={form.chassisNo} />
          <ReadOnlyField label="Engine number" value={form.engineNo} />
          <ReadOnlyField label="RTO state" value={form.rtoState} />
          <ReadOnlyField label="RTO name / code" value={form.rtoName} />
          <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-[#DCE6F2] bg-[#F8FAFC] px-3 py-2 text-[8.5px] leading-4 text-[#667085]">To correct customer ownership, registration identity or vehicle-master details, use the Customer or Vehicle master workflow. Saving this page cannot relink or overwrite those records.</div>
        </Section>

        <Section number="03" title="Policy product, premium & validity" subtitle="Edit policy values; Net Premium, GST and Gross Premium are recalculated before save." badge="Manual + calculated">
          <Select label="Policy product" value={form.policyProduct} onChange={e=>update("policyProduct",e.target.value)} options={policyProducts} placeholder="Select product" required />
          <Field label="IDV / Sum insured" type="number" min="0" value={form.idv} onChange={e=>update("idv",e.target.value)} placeholder="₹ 0.00" required />
          <Field label="OD premium" type="number" min="0" value={form.od} onChange={e=>update("od",e.target.value)} placeholder="₹ 0.00" required />
          <Field label="Third party premium" type="number" min="0" value={form.tp} onChange={e=>update("tp",e.target.value)} placeholder="₹ 0.00" required />
          <Select label="CPA opted" value={form.cpaOpted} onChange={e=>update("cpaOpted",e.target.value as "Yes"|"No")} options={["Yes","No"]} placeholder="Select" />
          <Field label="CPA amount" type="number" min="0" value={form.cpaOpted==="Yes"?form.cpa:"0"} onChange={e=>update("cpa",e.target.value)} disabled={form.cpaOpted==="No"} placeholder="₹ 0.00" />
          <PremiumCalculationBand net={calculations.net} gst={calculations.gst} gross={calculations.gross} gstRule={form.vehicleClass === "GCV" ? "18% OD + CPA · 5% TP" : "18% on Net"} />
          <Field label="Policy number" value={form.policyNo} onChange={e=>update("policyNo",e.target.value.toUpperCase())} placeholder="Policy number" required />
          <div><label className={labelClass}>Insurance company <Required/></label><select className={inputClass} value={form.insurerId} onChange={e=>update("insurerId",e.target.value)} required><option value="">Select insurer</option>{insurers.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
          <Field label="Valid from" type="date" value={form.validFrom} onChange={e=>update("validFrom",e.target.value)} required />
          <Field label="Valid upto" type="date" value={form.validUpto} onChange={e=>update("validUpto",e.target.value)} required />
        </Section>

        <Section number="04" title="Projected insurer pay-in" subtitle="Update projected insurer receivable values. Calculated amounts and TDS remain system-controlled." badge="prototype_v1">
          <PercentField label="Projected OD pay-in %" value={form.projectedOdPercent} onChange={v=>update("projectedOdPercent",v)} />
          <CalculatedOutcome label="Projected OD amount" value={money.format(calculations.projectedOd)} />
          <PercentField label="Projected TP pay-in %" value={form.projectedTpPercent} onChange={v=>update("projectedTpPercent",v)} />
          <CalculatedOutcome label="Projected TP amount" value={money.format(calculations.projectedTp)} />
          <Field label="Any insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={e=>update("insurerScheme",e.target.value)} placeholder="₹ 0.00" />
          <PayinCalculationBand total={calculations.totalPayin} tds={calculations.tds} afterTds={calculations.payinAfterTds} />
          <Field label="Retention" type="number" min="0" value={form.retention} onChange={e=>update("retention",e.target.value)} placeholder="₹ 0.00" />
        </Section>

        <Section number="05" title="Intermediary payout & settlement" subtitle="Update proposed payout rates and settlement tracking without changing the linked intermediary account." badge="Finance workflow">
          <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)} />
          <PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"} />
          <CalculatedOutcome label="Gross partner payout" value={money.format(calculations.grossPayout)} accent />
          <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status" />
          <Field label="Payout date" type="date" value={form.payoutDate} onChange={e=>update("payoutDate",e.target.value)} />
          <Field label="Payout voucher number" value={form.payoutVoucherNo} onChange={e=>update("payoutVoucherNo",e.target.value.toUpperCase())} placeholder="Voucher / reference" />
          <div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-20 w-full rounded-xl border border-[#D8DEE9] px-3 py-2 text-[11px] outline-none focus:border-[#315B9A]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy or payout notes" /></div>
        </Section>
      </div>

      <LiveSummary net={calculations.net} gst={calculations.gst} gross={calculations.gross} payinAfterTds={calculations.payinAfterTds} grossPayout={calculations.grossPayout} />
    </div>

    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</Link><button type="button" onClick={savePolicy} disabled={isSubmitting} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{isSubmitting ? "Saving changes…" : "Save Policy Changes"}</button></div></div>

    {submitError ? <ValidationErrorDialog message={submitError} onClose={()=>setSubmitError(null)} /> : null}
  </div>;
}

function Section({ number,title,subtitle,badge,children }: { number:string;title:string;subtitle:string;badge:string;children:ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2><p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p></div></div><span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label:string }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><input {...props} required={required} className={inputClass}/></div>; }
function ReadOnlyField({ label, value, required }: { label:string;value:string;required?:boolean }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}<Tag text="Master" /></label><input className={inputClass} value={value} readOnly disabled aria-readonly="true" /></div>; }
function Select({ label, options, placeholder, required, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label:string;options:string[];placeholder:string }) { const unique=Array.from(new Set(options.filter(Boolean))); return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{unique.map(o=><option key={o} value={o}>{o}</option>)}</select></div>; }
function PercentField({ label,value,onChange,disabled }: { label:string;value:string;onChange:(v:string)=>void;disabled?:boolean }) { return <Field label={label} type="number" min="0" max="100" step="0.01" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder="0.00"/>; }
function Required(){return <span className="text-red-500">*</span>;}
function Tag({text}:{text:string}){return <span className="rounded bg-[#EEF3FF] px-1.5 py-0.5 text-[7px] font-bold normal-case text-[#315B9A]">{text}</span>;}
function DerivedDisplay({ label, value, source }: { label: string; value: string; source?: string }) { return <div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3"><div className="flex items-center gap-2"><span className="text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">{label}</span>{source?<span className="rounded-full bg-[#EDF7F2] px-1.5 py-0.5 text-[7px] font-bold text-[#18794E]">{source}</span>:null}</div><div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{value || "—"}</div></div>; }
function SourceDerivedStrip({ month, code, onCodeChange }: { month:string;code:string;onCodeChange:(value:string)=>void }) { return <div className="md:col-span-2 xl:col-span-2 grid grid-cols-2 gap-5 border-t border-dashed border-[#D9E2F0] pt-2.5"><DerivedDisplay label="Month" value={month} source="Auto"/><div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3"><label className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">Intermediary code <span className="rounded-full bg-[#EEF3FF] px-1.5 py-0.5 text-[7px] font-bold text-[#315B9A]">Master</span><input className="sr-only" value={code} onChange={(event)=>onCodeChange(event.target.value)} tabIndex={-1} aria-label="Intermediary code" /></label><div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{code || "Select a lead source"}</div></div></div>; }
function PremiumCalculationBand({net,gst,gross,gstRule}:{net:number;gst:number;gross:number;gstRule:string}) { return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[linear-gradient(90deg,#F8FBFF,#F4F8FD)]"><div className="grid grid-cols-3 divide-x divide-[#DFE7F1]"><CalculationMetric label="Net premium" value={money.format(net)}/><CalculationMetric label="GST" value={money.format(gst)} note={gstRule}/><CalculationMetric label="Gross premium" value={money.format(gross)} accent/></div></div>; }
function PayinCalculationBand({total,tds,afterTds}:{total:number;tds:number;afterTds:number}) { return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]"><div className="grid grid-cols-3 divide-x divide-[#DFE7F1]"><CalculationMetric label="Total projected pay-in" value={money.format(total)}/><CalculationMetric label="TDS" value={money.format(tds)} note="10%"/><CalculationMetric label="Pay-in after TDS" value={money.format(afterTds)} accent/></div></div>; }
function CalculationMetric({label,value,note,accent=false}:{label:string;value:string;note?:string;accent?:boolean}) { return <div className={`px-3 py-2.5 ${accent?"bg-[#EEF4FF]":""}`}><div className="flex items-center justify-between gap-2"><span className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</span>{note?<span className="text-[7px] font-semibold text-[#98A2B3]">{note}</span>:null}</div><div className={`mt-1 text-[12px] font-bold ${accent?"text-[#4F46E5]":"text-[#17365D]"}`}>{value}</div></div>; }
function CalculatedOutcome({label,value,accent=false}:{label:string;value:string;accent?:boolean}) { return <div className="flex min-h-10 items-center justify-between gap-3 border-b border-dashed border-[#D9E2F0] px-1 py-1"><div><div className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</div><div className="mt-0.5 text-[7px] font-medium text-[#98A2B3]">Calculated</div></div><div className={`text-[11px] font-bold ${accent?"text-[#4F46E5]":"text-[#17365D]"}`}>{value}</div></div>; }
function LiveSummary({net,gst,gross,payinAfterTds,grossPayout}:{net:number;gst:number;gross:number;payinAfterTds:number;grossPayout:number}) { const anchorRef=useRef<HTMLDivElement>(null); const [position,setPosition]=useState<{left:number;width:number;top:number}|null>(null); useEffect(()=>{const updatePosition=()=>{if(window.innerWidth<1280||!anchorRef.current){setPosition(null);return;}const rect=anchorRef.current.getBoundingClientRect();setPosition({left:rect.left,width:rect.width,top:Math.max(rect.top,172)});};updatePosition();window.addEventListener("resize",updatePosition);window.addEventListener("scroll",updatePosition,true);const observer=new ResizeObserver(updatePosition);if(anchorRef.current)observer.observe(anchorRef.current);observer.observe(document.documentElement);return()=>{window.removeEventListener("resize",updatePosition);window.removeEventListener("scroll",updatePosition,true);observer.disconnect();};},[]);const card=<div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="Net Premium" value={money.format(net)} bold/><SummaryRow label="GST" value={money.format(gst)}/><SummaryRow label="Gross Premium" value={money.format(gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(payinAfterTds-grossPayout)} bold/></div></div>;return <aside className="xl:self-stretch"><div className="xl:hidden">{card}</div><div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true"/>{position&&typeof document!=="undefined"?createPortal(<div className="fixed z-30" style={{left:position.left,width:position.width,top:position.top}}>{card}</div>,document.body):null}</aside>; }
function SummaryRow({label,value,bold,accent}:{label:string;value:string;bold?:boolean;accent?:boolean}){return <div className="flex justify-between gap-3"><span className={`text-[9.5px] ${bold?"font-semibold":"text-[#667085]"}`}>{label}</span><span className={`text-[10px] ${bold?"font-bold":"font-semibold"} ${accent?"text-[#4F46E5]":""}`}>{value}</span></div>;}
function Divider(){return <div className="border-t border-dashed"/>;}
function ValidationErrorDialog({message,onClose}:{message:string;onClose:()=>void}) { const okRef=useRef<HTMLButtonElement>(null); useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";okRef.current?.focus();return()=>{document.body.style.overflow=previous;};},[]);if(typeof document==="undefined")return null;return createPortal(<div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(7,29,73,.42)]"><div className="px-6 pb-5 pt-7 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF3E8] text-[24px] text-[#D45B16] ring-8 ring-[#FFF8F2]">!</div><h2 className="mt-5 text-[17px] font-bold text-[#102A4C]">Please check the form</h2><p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#667085]">{message}</p></div><div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-6 py-4"><button ref={okRef} type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white">OK</button></div></div></div>,document.body); }
