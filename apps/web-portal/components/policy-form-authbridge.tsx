"use client";

import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useMemo, useState, useTransition } from "react";
import { lookupPolicyRegistrationRc, type PolicyRcReview } from "@/app/policies/authbridge-rc-actions";

type FormAction = (formData: FormData) => void | Promise<void>;
type SelectOption = { label: string; value: string };
type VehicleOption = SelectOption & { customerId: string };
type PolicyValues = { customer_id?: string | null; vehicle_id?: string | null; insurance_company_id?: string | null; policy_no?: string | null; policy_type?: string | null; insured_declared_value?: number | null; start_date?: string | null; end_date?: string | null };
type CreateInsurerResult = { ok: boolean; insurer?: SelectOption; error?: string };

type Props = {
  action: FormAction;
  createInsurerAction: (formData: FormData) => Promise<CreateInsurerResult>;
  customers: SelectOption[];
  vehicles: VehicleOption[];
  insurers: SelectOption[];
  values?: PolicyValues;
  submitLabel?: string;
};

type FormState = {
  issuanceDate: string; rmName: string; intermediaryType: string; leadSource: string; intermediaryCode: string; businessLine: string;
  registrationNo: string; insuredName: string; phoneNo: string; vehicleClass: string; make: string; model: string; fuelType: string;
  capacity: string; manufacturingYear: string; chassisNo: string; engineNo: string; rtoState: string; rtoName: string;
  policyProduct: string; idv: string; od: string; tp: string; cpaOpted: string; cpa: string; policyNo: string; insurerId: string;
  validFrom: string; validUpto: string; payoutBasis: string; projectedOdPercent: string; projectedTpPercent: string; insurerScheme: string;
  payinBillNo: string; payinBilledAmount: string; payinBillDate: string; payinStatus: string; retention: string;
  payoutOdPercent: string; payoutTpPercent: string; payoutStatus: string; payoutDate: string; payoutVoucherNo: string; remarks: string;
};

const inputClass = "h-9 w-full rounded-lg border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.045em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout", "Review"];

const vehicleClassMap: Record<string, { description: string; capacityLabel: string }> = {
  PCP: { description: "Private Car", capacityLabel: "CC" }, TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" }, PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" }, CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" }
};

const emptyState: FormState = {
  issuanceDate: new Date().toISOString().slice(0, 10), rmName: "", intermediaryType: "", leadSource: "", intermediaryCode: "", businessLine: "Motor",
  registrationNo: "", insuredName: "", phoneNo: "", vehicleClass: "", make: "", model: "", fuelType: "", capacity: "", manufacturingYear: "", chassisNo: "", engineNo: "", rtoState: "", rtoName: "",
  policyProduct: "", idv: "", od: "", tp: "", cpaOpted: "Yes", cpa: "", policyNo: "", insurerId: "", validFrom: "", validUpto: "", payoutBasis: "NET", projectedOdPercent: "", projectedTpPercent: "", insurerScheme: "",
  payinBillNo: "", payinBilledAmount: "", payinBillDate: "", payinStatus: "Unbilled", retention: "", payoutOdPercent: "", payoutTpPercent: "", payoutStatus: "Pending", payoutDate: "", payoutVoucherNo: "", remarks: ""
};

function classifyVehicle(value: string | null) {
  const text = (value ?? "").toLowerCase();
  if (/two.?wheel|motor.?cycle|scooter/.test(text)) return "TWP";
  if (/goods|truck|cargo/.test(text)) return "GCV";
  if (/passenger|bus|taxi|cab/.test(text)) return "PCV";
  if (/plant|machinery|excavator|construction/.test(text)) return "CPM";
  if (/private|car|motor car/.test(text)) return "PCP";
  return "";
}

export function PolicyFormAuthbridge({ action, createInsurerAction, customers, vehicles, insurers, values, submitLabel = "Create Policy" }: Props) {
  void action; void createInsurerAction; void customers; void vehicles; void submitLabel;
  const [form, setForm] = useState<FormState>({ ...emptyState, insurerId: values?.insurance_company_id ?? "", policyNo: values?.policy_no ?? "", policyProduct: values?.policy_type ?? "", idv: values?.insured_declared_value?.toString() ?? "", validFrom: values?.start_date ?? "", validUpto: values?.end_date ?? "" });
  const [activeSection, setActiveSection] = useState(0);
  const [rcReview, setRcReview] = useState<PolicyRcReview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, startLookup] = useTransition();

  const numeric = (value: string) => Number(value || 0);
  const calculations = useMemo(() => {
    const od = numeric(form.od), tp = numeric(form.tp), cpa = form.cpaOpted === "Yes" ? numeric(form.cpa) : 0;
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
    const shortPayout = Math.max(0, totalPayin - numeric(form.payinBilledAmount));
    return { net, gst, gross, projectedOd, projectedTp, totalPayin, tds, payinAfterTds, grossPayout, shortPayout };
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeVehicleClass(value: string) { setForm((current) => ({ ...current, vehicleClass: value, capacity: "", policyProduct: "" })); }

  function fetchRcDetails() {
    setLookupError(null); setRcReview(null);
    startLookup(async () => {
      const result = await lookupPolicyRegistrationRc(form.registrationNo);
      if (!result.ok) { setLookupError(result.error); return; }
      setRcReview(result.review);
    });
  }

  function useRcDetails() {
    if (!rcReview) return;
    const mappedClass = classifyVehicle(rcReview.vehicleClass);
    setForm((current) => ({
      ...current,
      registrationNo: rcReview.registrationNumber || current.registrationNo,
      vehicleClass: current.vehicleClass || mappedClass,
      make: current.make || rcReview.make || "",
      model: current.model || rcReview.model || "",
      fuelType: current.fuelType || rcReview.fuelType || "",
      manufacturingYear: current.manufacturingYear || rcReview.manufacturingYear || "",
      rtoState: current.rtoState || rcReview.rtoState || "",
      rtoName: current.rtoName || rcReview.rtoName || "",
    }));
    setRcReview(null);
  }

  const vehicleMeta = vehicleClassMap[form.vehicleClass];
  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP" ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"] : ["Package", "Third Party", "SAOD"];

  return <div className="mx-auto max-w-[1480px] pb-24">
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#E7ECF3] bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">V1 UI Prototype</span><span className="text-[9px] text-white/70">AuthBridge UAT enabled</span></div><h1 className="mt-2 text-[18px] font-semibold">Policy Onboarding</h1><p className="mt-0.5 text-[10px] text-white/70">Registration lookup uses the protected AuthBridge Detailed RC service through the INSUREIT server.</p></div>
        <div className="flex gap-2"><button type="button" className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[10px] font-semibold">Save Draft</button><button type="button" className="rounded-lg bg-white px-4 py-2 text-[10px] font-bold text-[#071D49]">Submit for Review</button></div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">{sections.map((section,index)=><button key={section} type="button" onClick={()=>setActiveSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6]"}`}>{index+1}</span>{section}</button>)}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">
      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Manual + master selections">
        <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required />
        <ReadOnly label="Month" value={form.issuanceDate?new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US",{month:"short",year:"2-digit"}):"Auto"}/>
        <Select label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} options={["Pramod","Parsottam","Krishan Kumar","Megha","Jayesh","Jatin"]} placeholder="Select RM" required />
        <Select label="Intermediary type" value={form.intermediaryType} onChange={e=>update("intermediaryType",e.target.value)} options={["POSP","MISP","SIBL / Partner","Direct"]} placeholder="Select type" required />
        <Field label="Lead source" value={form.leadSource} onChange={e=>update("leadSource",e.target.value)} placeholder="Search person / channel" />
        <Field label="Intermediary code" value={form.intermediaryCode} onChange={e=>update("intermediaryCode",e.target.value.toUpperCase())} placeholder="POSP/0001" />
        <Select label="Business line" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select" />
      </Section>

      <Section number="02" title="Insured & vehicle identification" subtitle="Fetch real RC details, review them, then choose whether to use them." badge="AuthBridge API">
        <div className="md:col-span-2 xl:col-span-2"><label className={labelClass}>Registration number <Required/><Tag text="AuthBridge" tone="amber"/></label><div className="flex gap-2"><input className={`${inputClass} uppercase`} value={form.registrationNo} onChange={e=>{update("registrationNo",e.target.value.toUpperCase());setRcReview(null);setLookupError(null);}} placeholder="MP20AB1234"/><button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} className="min-w-[130px] rounded-lg bg-[#17365D] px-3 text-[9.5px] font-bold text-white disabled:opacity-40">{isLookingUp?"Fetching RC…":"Fetch RC details"}</button></div><p className="mt-1 text-[8.5px] text-[#98A2B3]">One explicit lookup per click. Provider response may take 5–20 seconds.</p>{lookupError?<p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{lookupError}</p>:null}</div>
        {rcReview?<div className="md:col-span-2 xl:col-span-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold text-emerald-900">RC details found</p><p className="mt-0.5 text-[8px] text-emerald-700">Review before applying. Existing manually entered fields will not be overwritten.</p></div><div className="flex gap-2"><button type="button" onClick={()=>setRcReview(null)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[9px] font-semibold text-emerald-800">Cancel</button><button type="button" onClick={useRcDetails} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[9px] font-bold text-white">Use these details</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><ReviewItem label="Registration" value={rcReview.registrationNumber}/><ReviewItem label="Vehicle class" value={rcReview.vehicleClass}/><ReviewItem label="Manufacturer" value={rcReview.make}/><ReviewItem label="Model" value={rcReview.model}/><ReviewItem label="Fuel" value={rcReview.fuelType}/><ReviewItem label="Manufacturing year" value={rcReview.manufacturingYear}/><ReviewItem label="RTO" value={rcReview.rtoName}/><ReviewItem label="Chassis / Engine" value={[rcReview.chassisMasked,rcReview.engineMasked].filter(Boolean).join(" / ")||null}/></div>{rcReview.transactionId?<p className="mt-2 text-[7.5px] text-emerald-700">Transaction: {rcReview.transactionId}</p>:null}</div>:null}
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required />
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 digit mobile" inputMode="numeric" />
        <Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required />
        <ReadOnly label="Vehicle class description" value={vehicleMeta?.description||"Auto from class"}/>
        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" />
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" />
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" />
        <Field label={vehicleMeta?.capacityLabel||"CC / Seating / GVW / Category"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder="Enter value" disabled={!form.vehicleClass}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:31},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" />
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Enter from policy document" />
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Enter from policy document" />
        <Select label="RTO state" value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} options={["Delhi / NCR","Haryana","Uttar Pradesh","Madhya Pradesh","Rajasthan","Punjab","Other"]} placeholder="Select state" />
        <Field label="RTO name / code" value={form.rtoName} onChange={e=>update("rtoName",e.target.value.toUpperCase())} placeholder="MP20 – Jabalpur" />
      </Section>

      <Section number="03" title="Policy product, premium & validity" subtitle="Enter insurer-issued premium components. Net, GST and Gross update automatically." badge="Manual + calculated">
        <Select label="Policy product" value={form.policyProduct} onChange={e=>update("policyProduct",e.target.value)} options={policyProducts} placeholder="Select product" disabled={!form.vehicleClass} required />
        <Field label="IDV / Sum insured" type="number" min="0" value={form.idv} onChange={e=>update("idv",e.target.value)} placeholder="₹ 0.00" required />
        <Field label="OD premium" type="number" min="0" value={form.od} onChange={e=>update("od",e.target.value)} placeholder="₹ 0.00" required />
        <Field label="Third party premium" type="number" min="0" value={form.tp} onChange={e=>update("tp",e.target.value)} placeholder="₹ 0.00" required />
        <Select label="CPA opted" value={form.cpaOpted} onChange={e=>update("cpaOpted",e.target.value)} options={["Yes","No"]} placeholder="Select" />
        <Field label="CPA amount" type="number" min="0" value={form.cpaOpted==="Yes"?form.cpa:"0"} onChange={e=>update("cpa",e.target.value)} disabled={form.cpaOpted==="No"} placeholder="₹ 0.00" />
        <ReadOnly label="Net premium" value={money.format(calculations.net)} strong/><ReadOnly label="GST" value={money.format(calculations.gst)} strong/><ReadOnly label="Gross premium" value={money.format(calculations.gross)} strong accent/>
        <Field label="Policy number" value={form.policyNo} onChange={e=>update("policyNo",e.target.value.toUpperCase())} placeholder="Policy number" required />
        <div><label className={labelClass}>Insurance company <Required/></label><select className={inputClass} value={form.insurerId} onChange={e=>update("insurerId",e.target.value)}><option value="">Select insurer</option>{insurers.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
        <Field label="Valid from" type="date" value={form.validFrom} onChange={e=>update("validFrom",e.target.value)} required/><Field label="Valid upto" type="date" value={form.validUpto} onChange={e=>update("validUpto",e.target.value)} required/>
      </Section>

      <Section number="04" title="Projected insurer pay-in" subtitle="Capture the projected commission receivable from the insurer." badge="Rate assisted">
        <Select label="OD / NET basis" value={form.payoutBasis} onChange={e=>update("payoutBasis",e.target.value)} options={["OD","NET"]} placeholder="Select basis" required/>
        <PercentField label="Projected OD pay-in %" value={form.projectedOdPercent} onChange={v=>update("projectedOdPercent",v)}/><ReadOnly label="Projected OD pay-in" value={money.format(calculations.projectedOd)} strong/>
        <PercentField label="Projected TP pay-in %" value={form.projectedTpPercent} onChange={v=>update("projectedTpPercent",v)}/><ReadOnly label="Projected TP pay-in" value={money.format(calculations.projectedTp)} strong/>
        <Field label="Any insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={e=>update("insurerScheme",e.target.value)} placeholder="₹ 0.00"/>
        <ReadOnly label="Total projected pay-in" value={money.format(calculations.totalPayin)} strong accent/><ReadOnly label="TDS on pay-in" value={money.format(calculations.tds)}/><ReadOnly label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)} strong/>
        <Field label="Pay-in bill number" value={form.payinBillNo} onChange={e=>{update("payinBillNo",e.target.value.toUpperCase());update("payinStatus",e.target.value?"Billed":"Unbilled");}} placeholder="INV/2627/001"/>
        <Field label="Pay-in billed amount" type="number" min="0" value={form.payinBilledAmount} onChange={e=>update("payinBilledAmount",e.target.value)} placeholder="₹ 0.00"/><Field label="Pay-in bill date" type="date" value={form.payinBillDate} onChange={e=>update("payinBillDate",e.target.value)}/>
        <Select label="Pay-in status" value={form.payinStatus} onChange={e=>update("payinStatus",e.target.value)} options={["Unbilled","Billed","Part Received","Received","Short Received","Reconciled"]} placeholder="Select status"/><ReadOnly label="Short payout" value={money.format(calculations.shortPayout)}/>
      </Section>

      <Section number="05" title="Intermediary payout & settlement" subtitle="Record the proposed payout payable to POSP, MISP or Partner." badge="Finance workflow">
        <Field label="Retention" type="number" min="0" value={form.retention} onChange={e=>update("retention",e.target.value)} placeholder="₹ 0.00"/>
        <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)}/><PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"}/>
        <ReadOnly label="Gross payout" value={money.format(calculations.grossPayout)} strong accent/>
        <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status"/>
        <Field label="Payout date" type="date" value={form.payoutDate} onChange={e=>update("payoutDate",e.target.value)}/><Field label="Payout voucher number" value={form.payoutVoucherNo} onChange={e=>update("payoutVoucherNo",e.target.value.toUpperCase())} placeholder="Voucher / reference"/>
        <div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-20 w-full rounded-lg border border-[#D8DEE9] px-3 py-2 text-[11px]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy, billing or payout notes"/></div>
      </Section>
    </div>

    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start"><div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="OD Premium" value={money.format(numeric(form.od))}/><SummaryRow label="Third Party" value={money.format(numeric(form.tp))}/><SummaryRow label="CPA" value={money.format(form.cpaOpted==="Yes"?numeric(form.cpa):0)}/><Divider/><SummaryRow label="Net Premium" value={money.format(calculations.net)} bold/><SummaryRow label="GST" value={money.format(calculations.gst)}/><SummaryRow label="Gross Premium" value={money.format(calculations.gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(calculations.grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(calculations.payinAfterTds-calculations.grossPayout)} bold/></div></div>
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-[10px] font-bold text-blue-900">AuthBridge UAT</p><p className="mt-1 text-[9px] leading-4 text-blue-800">Lookup runs server-side through the protected AWS gateway. No provider credential or relay secret is sent to the browser.</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-bold text-amber-900">Prototype safeguard</p><p className="mt-1 text-[9px] leading-4 text-amber-800">Policy submission remains disabled for UI/API testing. RC details are not saved to the database.</p></div>
    </aside></div>

    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] items-center justify-end gap-2"><Link href="/policies" className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-[10px] font-semibold">Cancel</Link><button type="button" className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2 text-[10px] font-semibold text-[#4338CA]">Save Draft</button><button type="button" className="rounded-lg bg-[#17365D] px-5 py-2 text-[10px] font-bold text-white">Submit for UI Review</button></div></div>
  </div>;
}

function Section({number,title,subtitle,badge,children}:{number:string;title:string;subtitle:string;badge:string;children:ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex flex-col gap-2 border-b bg-[#FBFCFE] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2><p className="mt-.5 text-[9px] text-[#667085]">{subtitle}</p></div></div><span className="w-fit rounded-full border bg-white px-2.5 py-1 text-[8px] font-semibold text-[#667085]">{badge}</span></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>}
function Field({label,required,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}){return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><input {...props} required={required} className={`${inputClass} ${props.type==="number"?"tabular-nums":""}`}/></div>}
function Select({label,options,placeholder,required,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string;options:string[];placeholder:string}){return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>}
function PercentField({label,value,onChange,disabled}:{label:string;value:string;onChange:(v:string)=>void;disabled?:boolean}){return <div><label className={labelClass}>{label}<Tag text="%" tone="indigo"/></label><input type="number" min="0" max="100" step=".01" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} className={inputClass} placeholder="0.00"/></div>}
function ReadOnly({label,value,strong,accent}:{label:string;value:string;strong?:boolean;accent?:boolean}){return <div><label className={labelClass}>{label}<Tag text="Auto" tone="green"/></label><div className={`flex h-9 items-center rounded-lg border px-3 text-[11px] ${accent?"border-[#B7C5F8] bg-[#EEF2FF] text-[#3730A3]":"border-[#DDE5DD] bg-[#F6FBF6] text-[#365A3C]"} ${strong?"font-bold":"font-semibold"}`}>{value}</div></div>}
function ReviewItem({label,value}:{label:string;value:string|null}){return <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2"><p className="text-[7.5px] font-bold uppercase tracking-[.05em] text-emerald-600">{label}</p><p className="mt-1 truncate text-[9.5px] font-semibold text-[#17203A]" title={value??"Not returned"}>{value||"Not returned"}</p></div>}
function Required(){return <span className="text-red-500">*</span>}
function Tag({text,tone}:{text:string;tone:"amber"|"indigo"|"green"}){const s=tone==="amber"?"bg-amber-50 text-amber-700":tone==="indigo"?"bg-indigo-50 text-indigo-700":"bg-emerald-50 text-emerald-700";return <span className={`rounded px-1.5 py-.5 text-[7px] font-bold normal-case tracking-normal ${s}`}>{text}</span>}
function SummaryRow({label,value,bold,accent}:{label:string;value:string;bold?:boolean;accent?:boolean}){return <div className="flex justify-between gap-3"><span className={`text-[9.5px] ${bold?"font-semibold":"text-[#667085]"}`}>{label}</span><span className={`text-[10px] ${bold?"font-bold":"font-semibold"} ${accent?"text-[#4F46E5]":""}`}>{value}</span></div>}
function Divider(){return <div className="border-t border-dashed border-[#D0D5DD]"/>}
