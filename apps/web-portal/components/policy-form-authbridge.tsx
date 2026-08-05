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
type Props = { action: FormAction; createInsurerAction: (formData: FormData) => Promise<CreateInsurerResult>; customers: SelectOption[]; vehicles: VehicleOption[]; insurers: SelectOption[]; values?: PolicyValues; submitLabel?: string };

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
  if (/motor car|private|car|lmv/.test(text)) return "PCP";
  return "MISD";
}
function titleCase(value: string | null) { return value ? value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : ""; }
function normalizeFuel(value: string | null) {
  const v = (value ?? "").toUpperCase();
  if (v.includes("PETROL")) return "Petrol"; if (v.includes("DIESEL")) return "Diesel"; if (v.includes("CNG")) return "CNG";
  if (v.includes("ELECTRIC")) return "Electric"; if (v.includes("HYBRID")) return "Hybrid"; if (v.includes("BI")) return "Bi-Fuel"; return value ? "Other" : "";
}
function capacityFor(review: PolicyRcReview, vehicleClass: string) {
  if (vehicleClass === "PCP" || vehicleClass === "TWP") return review.engineCapacity ?? "";
  if (vehicleClass === "PCV") return review.seatingCapacity ?? "";
  if (vehicleClass === "GCV" || vehicleClass === "CPM") return review.grossWeight ?? "";
  return review.vehicleCategory ?? review.engineCapacity ?? review.grossWeight ?? "";
}

export function PolicyFormAuthbridge({ action, createInsurerAction, customers, vehicles, insurers, values, submitLabel = "Create Policy" }: Props) {
  void action; void createInsurerAction; void customers; void vehicles; void submitLabel;
  const [form, setForm] = useState<FormState>({ ...emptyState, insurerId: values?.insurance_company_id ?? "", policyNo: values?.policy_no ?? "", policyProduct: values?.policy_type ?? "", idv: values?.insured_declared_value?.toString() ?? "", validFrom: values?.start_date ?? "", validUpto: values?.end_date ?? "" });
  const [activeSection, setActiveSection] = useState(0);
  const [rcReview, setRcReview] = useState<PolicyRcReview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showFullRc, setShowFullRc] = useState(true);
  const [isLookingUp, startLookup] = useTransition();
  const numeric = (value: string) => Number(value || 0);
  const calculations = useMemo(() => {
    const od = numeric(form.od), tp = numeric(form.tp), cpa = form.cpaOpted === "Yes" ? numeric(form.cpa) : 0;
    const net = od + tp + cpa, gst = form.vehicleClass === "GCV" ? ((od + cpa) * .18) + (tp * .05) : net * .18, gross = net + gst;
    const projectedOd = od * numeric(form.projectedOdPercent) / 100, projectedTp = tp * numeric(form.projectedTpPercent) / 100;
    const totalPayin = projectedOd + projectedTp + numeric(form.insurerScheme), tds = totalPayin * .10, payinAfterTds = totalPayin - tds;
    const payoutOd = od * numeric(form.payoutOdPercent) / 100, payoutTp = form.payoutBasis === "OD" ? 0 : tp * numeric(form.payoutTpPercent) / 100;
    return { net, gst, gross, projectedOd, projectedTp, totalPayin, tds, payinAfterTds, grossPayout: Math.max(0, payoutOd + payoutTp - numeric(form.retention)), shortPayout: Math.max(0, totalPayin - numeric(form.payinBilledAmount)) };
  }, [form]);
  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function changeVehicleClass(value: string) { setForm((current) => ({ ...current, vehicleClass: value, capacity: "", policyProduct: "" })); }
  function fetchRcDetails() {
    setLookupError(null); setRcReview(null);
    startLookup(async () => { const result = await lookupPolicyRegistrationRc(form.registrationNo); if (!result.ok) { setLookupError(result.error); return; } setRcReview(result.review); setShowFullRc(true); });
  }
  function useRcDetails() {
    if (!rcReview) return;
    const mappedClass = classifyVehicle(rcReview.vehicleClass);
    setForm((current) => ({
      ...current,
      registrationNo: rcReview.registrationNumber || current.registrationNo,
      insuredName: current.insuredName || rcReview.ownerName || "",
      phoneNo: current.phoneNo || (rcReview.mobileNumber ?? "").replace(/\D/g, "").slice(-10),
      vehicleClass: current.vehicleClass || mappedClass,
      make: current.make || rcReview.make || "",
      model: current.model || rcReview.model || "",
      fuelType: current.fuelType || normalizeFuel(rcReview.fuelType),
      capacity: current.capacity || capacityFor(rcReview, current.vehicleClass || mappedClass),
      manufacturingYear: current.manufacturingYear || rcReview.manufacturingYear || "",
      chassisNo: current.chassisNo || rcReview.chassisNumber || "",
      engineNo: current.engineNo || rcReview.engineNumber || "",
      rtoState: current.rtoState || titleCase(rcReview.rtoState),
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

      <Section number="02" title="Insured & vehicle identification" subtitle="Fetch real RC details, review the complete response, then choose whether to apply it." badge="AuthBridge API">
        <div className="md:col-span-2 xl:col-span-2"><label className={labelClass}>Registration number <Required/><Tag text="AuthBridge" tone="amber"/></label><div className="flex gap-2"><input className={`${inputClass} uppercase`} value={form.registrationNo} onChange={e=>{update("registrationNo",e.target.value.toUpperCase());setRcReview(null);setLookupError(null);}} placeholder="MP20AB1234"/><button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} className="min-w-[140px] rounded-lg bg-[#17365D] px-3 text-[9.5px] font-bold text-white disabled:opacity-40">{isLookingUp?"Fetching RC…":"Fetch RC details"}</button></div><p className="mt-1 text-[8.5px] text-[#98A2B3]">One explicit lookup per click. Provider response may take 5–20 seconds.</p>{lookupError?<p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{lookupError}</p>:null}</div>
        {rcReview?<div className="md:col-span-2 xl:col-span-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold text-emerald-900">RC details found</p><p className="mt-0.5 text-[8px] text-emerald-700">All available AuthBridge fields are shown below. Existing manual values will not be overwritten.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setShowFullRc(v=>!v)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[9px] font-semibold text-emerald-800">{showFullRc?"Show summary":"Show full RC"}</button><button type="button" onClick={()=>setRcReview(null)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[9px] font-semibold text-emerald-800">Cancel</button><button type="button" onClick={useRcDetails} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[9px] font-bold text-white">Use these details</button></div></div>
          <RcGroup title="Vehicle summary" items={[["Registration",rcReview.registrationNumber],["Owner / insured",rcReview.ownerName],["Vehicle class",rcReview.vehicleClass],["Category",rcReview.vehicleCategory],["Manufacturer",rcReview.make],["Model",rcReview.model],["Fuel",rcReview.fuelType],["Manufacture date",rcReview.manufactureDate]]}/>
          {showFullRc?<>
            <RcGroup title="Technical details" items={[["Engine capacity / CC",rcReview.engineCapacity],["Seating capacity",rcReview.seatingCapacity],["Standing capacity",rcReview.standingCapacity],["Sleeper capacity",rcReview.sleeperCapacity],["Gross weight / GVW",rcReview.grossWeight],["Unladen weight",rcReview.unladenWeight],["Wheel base",rcReview.wheelBase],["Cylinders",rcReview.cylinders],["Body type",rcReview.bodyType],["Colour",rcReview.color],["Emission norm",rcReview.normsType],["Commercial",rcReview.isCommercial],["Chassis number",rcReview.chassisNumber],["Engine number",rcReview.engineNumber]]}/>
            <RcGroup title="Registration & compliance" items={[["Registration date",rcReview.registrationDate],["RC status",rcReview.registrationStatus],["Status as on",rcReview.statusAsOn],["RTO",rcReview.rtoName],["RTO state",rcReview.rtoState],["Fitness / RC expiry",rcReview.fitnessExpiryDate],["Tax upto",rcReview.taxUpto],["PUC number",rcReview.pucNumber],["PUC upto",rcReview.pucUpto],["Blacklist status",rcReview.blacklistStatus],["Non-use status",rcReview.nonUseStatus]]}/>
            <RcGroup title="Insurance & hypothecation" items={[["Existing insurer",rcReview.insuranceCompany],["Existing policy number",rcReview.insurancePolicyNumber],["Insurance upto",rcReview.insuranceUpto],["Financed",rcReview.financed],["Financer",rcReview.financerName]]}/>
            <RcGroup title="Permit details" items={[["Permit number",rcReview.permitNumber],["Permit type",rcReview.permitType],["Permit issue date",rcReview.permitIssueDate],["Permit valid from",rcReview.permitValidFrom],["Permit valid upto",rcReview.permitValidUpto],["National permit issued by",rcReview.nationalPermitIssuedBy],["National permit number",rcReview.nationalPermitNumber],["National permit upto",rcReview.nationalPermitUpto]]}/>
            <RcGroup title="Owner summary" items={[["Owner serial",rcReview.ownerSerialNumber],["City",rcReview.ownerCity],["District",rcReview.ownerDistrict],["State",rcReview.ownerState],["Pincode",rcReview.ownerPincode],["Mobile",rcReview.mobileNumber],["Present address",rcReview.presentAddress],["Permanent address",rcReview.permanentAddress]]}/>
          </>:null}
          <p className="mt-3 text-[7.5px] text-emerald-700">INSUREIT transaction: {rcReview.transactionId ?? "—"} · Provider transaction: {rcReview.providerTransactionId ?? "—"}</p>
        </div>:null}
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required />
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10 digit mobile" inputMode="numeric" />
        <Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required />
        <ReadOnly label="Vehicle class description" value={vehicleMeta?.description||"Auto from class"}/>
        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" />
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" />
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" />
        <Field label={vehicleMeta?.capacityLabel||"CC / Seating / GVW / Category"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder="Enter value" disabled={!form.vehicleClass}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:31},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" />
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" />
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" />
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
        <Field label="Retention" type="number" min="0" value={form.retention} onChange={e=>update("retention",e.target.value)} placeholder="₹ 0.00"/>
        <ReadOnly label="Total projected pay-in" value={money.format(calculations.totalPayin)} strong accent/><ReadOnly label="TDS on pay-in" value={money.format(calculations.tds)}/><ReadOnly label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)} strong/>
        <Field label="Pay-in bill number" value={form.payinBillNo} onChange={e=>{update("payinBillNo",e.target.value.toUpperCase());update("payinStatus",e.target.value?"Billed":"Unbilled");}} placeholder="INV/2627/001"/>
        <Field label="Pay-in billed amount" type="number" min="0" value={form.payinBilledAmount} onChange={e=>update("payinBilledAmount",e.target.value)} placeholder="₹ 0.00"/><Field label="Pay-in bill date" type="date" value={form.payinBillDate} onChange={e=>update("payinBillDate",e.target.value)}/>
        <Select label="Pay-in status" value={form.payinStatus} onChange={e=>update("payinStatus",e.target.value)} options={["Unbilled","Billed","Part Received","Received","Short Received","Reconciled"]} placeholder="Select status"/><ReadOnly label="Short payout" value={money.format(calculations.shortPayout)}/>
      </Section>

      <Section number="05" title="Intermediary payout & settlement" subtitle="Record the proposed payout payable to POSP, MISP or Partner." badge="Finance workflow">
        <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)}/><PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"}/>
        <ReadOnly label="Gross payout" value={money.format(calculations.grossPayout)} strong accent/>
        <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status"/>
        <Field label="Payout date" type="date" value={form.payoutDate} onChange={e=>update("payoutDate",e.target.value)}/><Field label="Payout voucher number" value={form.payoutVoucherNo} onChange={e=>update("payoutVoucherNo",e.target.value.toUpperCase())} placeholder="Voucher / reference"/>
        <div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-20 w-full rounded-lg border border-[#D8DEE9] px-3 py-2 text-[11px]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy, billing or payout notes"/></div>
      </Section>
    </div>

    <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start"><div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="Net Premium" value={money.format(calculations.net)} bold/><SummaryRow label="GST" value={money.format(calculations.gst)}/><SummaryRow label="Gross Premium" value={money.format(calculations.gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(calculations.grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(calculations.payinAfterTds-calculations.grossPayout)} bold/></div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-bold text-amber-900">Prototype safeguard</p><p className="mt-1 text-[9px] leading-4 text-amber-800">RC data is fetched live but policy submission remains UI-only in this V1 build.</p></div></aside></div>

    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-[10px] font-semibold">Cancel</Link><button type="button" className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2 text-[10px] font-semibold text-[#4338CA]">Save Draft</button><button type="button" className="rounded-lg bg-[#17365D] px-5 py-2 text-[10px] font-bold text-white">Submit for UI Review</button></div></div>
  </div>;
}

function RcGroup({ title, items }: { title: string; items: Array<[string, string | null]> }) {
  const visible = items.filter(([, value]) => value && value !== "NA");
  if (!visible.length) return null;
  return <div className="mt-3"><p className="mb-2 text-[8px] font-bold uppercase tracking-[.12em] text-emerald-800">{title}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{visible.map(([label,value])=><ReviewItem key={label} label={label} value={value}/>)}</div></div>;
}
function Section({ number,title,subtitle,badge,children }: { number:string;title:string;subtitle:string;badge:string;children:ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2><p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p></div></div><span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label:string }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><input {...props} required={required} className={inputClass}/></div>; }
function Select({ label, options, placeholder, required, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label:string;options:string[];placeholder:string }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>; }
function PercentField({ label,value,onChange,disabled }: { label:string;value:string;onChange:(v:string)=>void;disabled?:boolean }) { return <Field label={label} type="number" min="0" max="100" step="0.01" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder="0.00"/>; }
function ReadOnly({ label,value,strong,accent }: { label:string;value:string;strong?:boolean;accent?:boolean }) { return <div><label className={labelClass}>{label}<Tag text="Auto" tone="green"/></label><div className={`flex h-9 items-center rounded-lg border px-3 text-[11px] ${accent?"border-indigo-200 bg-indigo-50 text-indigo-800":"border-emerald-100 bg-emerald-50/50 text-emerald-900"} ${strong?"font-bold":"font-semibold"}`}>{value}</div></div>; }
function ReviewItem({ label,value }: { label:string;value:string|null }) { return <div className="min-w-0 rounded-lg border border-emerald-100 bg-white/80 px-3 py-2"><p className="text-[7px] font-bold uppercase tracking-[.08em] text-emerald-700">{label}</p><p className="mt-1 break-words text-[9.5px] font-medium text-[#17203A]">{value||"Not returned"}</p></div>; }
function Required(){return <span className="text-red-500">*</span>;} function Tag({text,tone}:{text:string;tone:"amber"|"green"}){return <span className={`rounded px-1.5 py-0.5 text-[7px] font-bold normal-case ${tone==="amber"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>{text}</span>;}
function SummaryRow({label,value,bold,accent}:{label:string;value:string;bold?:boolean;accent?:boolean}){return <div className="flex justify-between gap-3"><span className={`text-[9.5px] ${bold?"font-semibold":"text-[#667085]"}`}>{label}</span><span className={`text-[10px] ${bold?"font-bold":"font-semibold"} ${accent?"text-[#4F46E5]":""}`}>{value}</span></div>;} function Divider(){return <div className="border-t border-dashed"/>;}
