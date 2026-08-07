"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { lookupPolicyRegistrationRc, type PolicyRcReview } from "@/app/policies/authbridge-rc-actions";
import { PolicyOcrImportPanel } from "@/components/policy-ocr-import-panel";
import {
  onboardPolicy,
  type PolicyCustomerCandidate,
  type PolicyOnboardingPayload,
  type PolicyOwnershipConflict,
} from "@/app/policies/policy-onboarding-actions";

type FormAction = (formData: FormData) => void | Promise<void>;
type SelectOption = { label: string; value: string };
type VehicleOption = SelectOption & { customerId: string };
type PolicyValues = { insurance_company_id?: string | null; policy_no?: string | null; policy_type?: string | null; insured_declared_value?: number | null; start_date?: string | null; end_date?: string | null };
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

type ApplyGroups = { ownerIdentity: boolean; ownerAddress: boolean; vehicleIdentity: boolean; technical: boolean; compliance: boolean; finance: boolean };
const defaultGroups: ApplyGroups = { ownerIdentity: true, ownerAddress: true, vehicleIdentity: true, technical: true, compliance: true, finance: true };
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout", "Review"];
const vehicleClassMap: Record<string, { description: string; capacityLabel: string }> = {
  PCP: { description: "Private Car", capacityLabel: "CC" }, TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" }, PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" }, CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" },
};
const emptyState: FormState = {
  issuanceDate: new Date().toISOString().slice(0, 10), rmName: "", intermediaryType: "", leadSource: "", intermediaryCode: "", businessLine: "Motor",
  registrationNo: "", insuredName: "", phoneNo: "", vehicleClass: "", make: "", model: "", fuelType: "", capacity: "", manufacturingYear: "", chassisNo: "", engineNo: "", rtoState: "", rtoName: "",
  policyProduct: "", idv: "", od: "", tp: "", cpaOpted: "Yes", cpa: "", policyNo: "", insurerId: "", validFrom: "", validUpto: "", payoutBasis: "NET", projectedOdPercent: "", projectedTpPercent: "", insurerScheme: "",
  payinBillNo: "", payinBilledAmount: "", payinBillDate: "", payinStatus: "Unbilled", retention: "", payoutOdPercent: "", payoutTpPercent: "", payoutStatus: "Pending", payoutDate: "", payoutVoucherNo: "", remarks: "",
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
function isoDate(value: string | null) {
  if (!value || value === "NA") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}
function boolValue(value: string | null) { return value === "true" || value === "Yes" || value === "YES"; }

export function PolicyFormAuthbridge({ action, createInsurerAction, customers, vehicles, insurers, values, submitLabel = "Create Policy" }: Props) {
  void action; void createInsurerAction; void customers; void vehicles; void submitLabel;
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ ...emptyState, insurerId: values?.insurance_company_id ?? "", policyNo: values?.policy_no ?? "", policyProduct: values?.policy_type ?? "", idv: values?.insured_declared_value?.toString() ?? "", validFrom: values?.start_date ?? "", validUpto: values?.end_date ?? "" });
  const [activeSection, setActiveSection] = useState(0);
  const [rcReview, setRcReview] = useState<PolicyRcReview | null>(null);
  const [appliedRc, setAppliedRc] = useState<PolicyRcReview | null>(null);
  const [applyGroups, setApplyGroups] = useState<ApplyGroups>(defaultGroups);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerCandidates, setCustomerCandidates] = useState<PolicyCustomerCandidate[] | null>(null);
  const [ownershipConflict, setOwnershipConflict] = useState<PolicyOwnershipConflict | null>(null);
  const [pendingPayload, setPendingPayload] = useState<PolicyOnboardingPayload | null>(null);
  const [isLookingUp, startLookup] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  useEffect(() => {
    if (!rcReview && !customerCandidates && !ownershipConflict) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setRcReview(null); setCustomerCandidates(null); setOwnershipConflict(null); } };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [rcReview, customerCandidates, ownershipConflict]);

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
    startLookup(async () => {
      const result = await lookupPolicyRegistrationRc(form.registrationNo);
      if (!result.ok) { setLookupError(result.error); return; }
      setApplyGroups(defaultGroups); setRcReview(result.review);
    });
  }
  function useRcDetails() {
    if (!rcReview) return;
    const mappedClass = classifyVehicle(rcReview.vehicleClass);
    setForm((current) => ({
      ...current,
      registrationNo: rcReview.registrationNumber || current.registrationNo,
      insuredName: applyGroups.ownerIdentity ? (current.insuredName || rcReview.ownerName || "") : current.insuredName,
      phoneNo: applyGroups.ownerIdentity ? (current.phoneNo || (rcReview.mobileNumber ?? "").replace(/\D/g, "").slice(-10)) : current.phoneNo,
      vehicleClass: applyGroups.vehicleIdentity ? (current.vehicleClass || mappedClass) : current.vehicleClass,
      make: applyGroups.vehicleIdentity ? (current.make || rcReview.make || "") : current.make,
      model: applyGroups.vehicleIdentity ? (current.model || rcReview.model || "") : current.model,
      fuelType: applyGroups.vehicleIdentity ? (current.fuelType || normalizeFuel(rcReview.fuelType)) : current.fuelType,
      capacity: applyGroups.technical ? (current.capacity || capacityFor(rcReview, current.vehicleClass || mappedClass)) : current.capacity,
      manufacturingYear: applyGroups.vehicleIdentity ? (current.manufacturingYear || rcReview.manufacturingYear || "") : current.manufacturingYear,
      chassisNo: applyGroups.technical ? (current.chassisNo || rcReview.chassisNumber || "") : current.chassisNo,
      engineNo: applyGroups.technical ? (current.engineNo || rcReview.engineNumber || "") : current.engineNo,
      rtoState: applyGroups.compliance ? (current.rtoState || titleCase(rcReview.rtoState)) : current.rtoState,
      rtoName: applyGroups.compliance ? (current.rtoName || rcReview.rtoName || "") : current.rtoName,
    }));
    setAppliedRc(rcReview); setRcReview(null);
  }

  function buildPayload(): PolicyOnboardingPayload {
    const rc = appliedRc;
    return {
      customer: {
        name: form.insuredName, phone: form.phoneNo, type: "individual", source: form.leadSource || "policy_onboarding",
        address: applyGroups.ownerAddress ? (rc?.presentAddress || rc?.permanentAddress || "") : "",
        city: applyGroups.ownerAddress ? (rc?.ownerCity || "") : "", district: applyGroups.ownerAddress ? (rc?.ownerDistrict || "") : "",
        state: applyGroups.ownerAddress ? (rc?.ownerState || form.rtoState) : "", pincode: applyGroups.ownerAddress ? (rc?.ownerPincode || "") : "", country: "India",
      },
      vehicle: {
        registrationNumber: form.registrationNo, classCode: form.vehicleClass, classDescription: vehicleClassMap[form.vehicleClass]?.description || rc?.vehicleClass || "",
        category: rc?.vehicleCategory || "", bodyType: rc?.bodyType || "", isCommercial: rc ? boolValue(rc.isCommercial) : null,
        make: form.make, model: form.model, fuelType: form.fuelType, color: rc?.color || "", manufactureDate: rc?.manufactureDate || "", manufacturingYear: form.manufacturingYear,
        capacity: form.capacity, engineCapacity: rc?.engineCapacity || (form.vehicleClass === "PCP" || form.vehicleClass === "TWP" ? form.capacity : ""),
        seatingCapacity: rc?.seatingCapacity || (form.vehicleClass === "PCV" ? form.capacity : ""), standingCapacity: rc?.standingCapacity || "", sleeperCapacity: rc?.sleeperCapacity || "",
        grossWeight: rc?.grossWeight || (form.vehicleClass === "GCV" || form.vehicleClass === "CPM" ? form.capacity : ""), unladenWeight: rc?.unladenWeight || "", wheelBase: rc?.wheelBase || "", cylinders: rc?.cylinders || "",
        chassisNumber: form.chassisNo, engineNumber: form.engineNo, normsType: rc?.normsType || "", registrationDate: isoDate(rc?.registrationDate || null),
        registrationStatus: rc?.registrationStatus || "", statusAsOn: isoDate(rc?.statusAsOn || null), rtoName: form.rtoName, rtoState: form.rtoState,
        fitnessExpiryDate: isoDate(rc?.fitnessExpiryDate || null), taxUpto: isoDate(rc?.taxUpto || null), pucNumber: rc?.pucNumber || "", pucUpto: isoDate(rc?.pucUpto || null),
        permitNumber: rc?.permitNumber || "", permitType: rc?.permitType || "", permitValidFrom: isoDate(rc?.permitValidFrom || null), permitValidUpto: isoDate(rc?.permitValidUpto || null),
        nationalPermitNumber: rc?.nationalPermitNumber || "", nationalPermitUpto: isoDate(rc?.nationalPermitUpto || null), financed: rc ? boolValue(rc.financed) : null,
        financerName: rc?.financerName || "", blacklistStatus: rc?.blacklistStatus || "",
      },
      policy: {
        issuanceDate: form.issuanceDate, rmName: form.rmName, intermediaryType: form.intermediaryType, leadSource: form.leadSource, intermediaryCode: form.intermediaryCode,
        businessLine: form.businessLine, policyType: form.policyProduct, idv: form.idv, policyNumber: form.policyNo, insuranceCompanyId: form.insurerId,
        validFrom: form.validFrom, validUpto: form.validUpto, remarks: form.remarks,
      },
      premium: { od: form.od, tp: form.tp, cpaOpted: form.cpaOpted === "Yes", cpa: form.cpa },
      payin: { basis: form.payoutBasis, odPercent: form.projectedOdPercent, tpPercent: form.projectedTpPercent, scheme: form.insurerScheme },
      billing: { billNumber: form.payinBillNo, billedAmount: form.payinBilledAmount, billDate: form.payinBillDate, status: form.payinStatus },
      payout: { retention: form.retention, odPercent: form.payoutOdPercent, tpPercent: form.payoutTpPercent, status: form.payoutStatus, date: form.payoutDate, voucherNumber: form.payoutVoucherNo },
      authbridge: { applied: Boolean(rc), transactionId: rc?.transactionId || "", providerTransactionId: rc?.providerTransactionId || "", lookedUpAt: rc?.lookedUpAt || "" },
    };
  }

  function runOnboarding(payload: PolicyOnboardingPayload) {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await onboardPolicy(payload);
      if (result.ok) { router.push(`/policies?success=policy_created&policy=${encodeURIComponent(result.policyCode)}`); return; }
      if (result.kind === "customer_match") { setPendingPayload(payload); setCustomerCandidates(result.candidates); return; }
      if (result.kind === "ownership_conflict") { setPendingPayload(payload); setOwnershipConflict(result.conflict); return; }
      setSubmitError(result.error);
    });
  }
  function submitPolicy() { runOnboarding(buildPayload()); }
  function chooseCustomer(id: string | null) {
    if (!pendingPayload) return;
    setCustomerCandidates(null);
    runOnboarding({ ...pendingPayload, resolution: { ...pendingPayload.resolution, selectedCustomerId: id, createNewCustomer: !id } });
  }
  function resolveOwnership(decision: "keep_existing" | "transfer") {
    if (!pendingPayload || !ownershipConflict) return;
    setOwnershipConflict(null);
    runOnboarding({ ...pendingPayload, resolution: { ...pendingPayload.resolution, selectedCustomerId: decision === "keep_existing" ? ownershipConflict.customerId : pendingPayload.resolution?.selectedCustomerId, createNewCustomer: decision === "transfer" ? pendingPayload.resolution?.createNewCustomer : false, ownershipDecision: decision, transferReason: "Confirmed during policy onboarding" } });
  }

  const vehicleMeta = vehicleClassMap[form.vehicleClass];
  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP" ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"] : ["Package", "Third Party", "SAOD"];

  return <div className="mx-auto max-w-[1480px] pb-24">
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="flex flex-col gap-3 border-b border-[#E7ECF3] bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
        <div><div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">Database enabled</span><span className="text-[9px] text-white/70">AuthBridge UAT · prototype_v1 calculations</span></div><h1 className="mt-2 text-[18px] font-semibold">Policy Onboarding</h1><p className="mt-0.5 text-[10px] text-white/70">Creates or links the customer and vehicle, then books the policy and financial details in one transaction.</p></div>
        <div className="flex flex-wrap items-center gap-2"><PolicyOcrImportPanel/><button type="button" onClick={submitPolicy} disabled={isSubmitting} className="rounded-xl bg-white px-5 py-2.5 text-[10px] font-bold text-[#071D49] shadow-sm disabled:opacity-60">{isSubmitting ? "Booking policy…" : "Book Active Policy"}</button></div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 py-2">{sections.map((section,index)=><button key={section} type="button" onClick={()=>setActiveSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6]"}`}>{index+1}</span>{section}</button>)}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">
      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Master linked">
        <div>
          <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required />
          <CompactSourceMeta label="Month" value={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto"} source="Auto" />
        </div>
        <div>
          <Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select policy type" required />
        </div>
        <div>
          <Select label="Intermediary type" value={form.intermediaryType} onChange={e=>update("intermediaryType",e.target.value)} options={["POSP","MISP","SIBL / Partner"]} placeholder="Select type" required />
          <CompactSourceMeta label="RM" value={form.rmName || "Select lead source"} source={form.rmName ? "Assigned" : undefined} />
          <div className="hidden" aria-hidden="true">
            <Field label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} />
          </div>
        </div>
        <div>
          <Field label="Lead source" value={form.leadSource} onChange={e=>update("leadSource",e.target.value)} placeholder={form.intermediaryType ? "Start typing a name" : "Select intermediary type first"} disabled={!form.intermediaryType} required />
          <CompactSourceMeta
            label="Intermediary code"
            value={form.intermediaryCode || "Select lead source"}
            source={form.intermediaryCode ? "Master" : undefined}
            hiddenValue={form.intermediaryCode}
            onHiddenChange={(value) => update("intermediaryCode", value.toUpperCase())}
          />
        </div>
      </Section>

      <Section number="02" title="Insured & vehicle identification" subtitle="Fetch RC details in a separate review popup, then apply approved groups." badge="AuthBridge API">
        <div className="md:col-span-2"><label className={labelClass}>Registration number <Required/><Tag text="AuthBridge" tone="amber"/></label><div className="flex gap-2"><input className={`${inputClass} uppercase`} value={form.registrationNo} onChange={e=>{update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}} placeholder="MP20AB1234"/><button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} className="min-w-[140px] rounded-xl bg-[#17365D] px-3 text-[9.5px] font-bold text-white disabled:opacity-40">{isLookingUp?"Fetching RC…":"Fetch RC details"}</button></div><p className="mt-1 text-[8.5px] text-[#98A2B3]">Provider response opens in a review popup. One lookup is made per click.</p>{lookupError?<p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{lookupError}</p>:null}{appliedRc?<p className="mt-2 text-[9px] font-bold text-emerald-700">✓ AuthBridge details applied · {appliedRc.transactionId}</p>:null}</div>
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required />
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required />
        <Select label="Class of vehicle" value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" required />
        <DerivedDisplay label="Vehicle classification" value={vehicleMeta?.description || "Auto from class"} source="Auto" />
        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" />
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" />
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" />
        <Field label={vehicleMeta?.capacityLabel||"CC / Seating / GVW / Category"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder="Enter value" disabled={!form.vehicleClass}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:40},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" />
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" />
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" />
        <Field label="RTO state" value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="Madhya Pradesh" />
        <Field label="RTO name / code" value={form.rtoName} onChange={e=>update("rtoName",e.target.value.toUpperCase())} placeholder="SATNA ARTO" />
      </Section>

      <Section number="03" title="Policy product, premium & validity" subtitle="Premium calculations are saved with calculation version prototype_v1." badge="Manual + calculated">
        <Select label="Policy product" value={form.policyProduct} onChange={e=>update("policyProduct",e.target.value)} options={policyProducts} placeholder="Select product" disabled={!form.vehicleClass} required />
        <Field label="IDV / Sum insured" type="number" min="0" value={form.idv} onChange={e=>update("idv",e.target.value)} placeholder="₹ 0.00" required />
        <Field label="OD premium" type="number" min="0" value={form.od} onChange={e=>update("od",e.target.value)} placeholder="₹ 0.00" required />
        <Field label="Third party premium" type="number" min="0" value={form.tp} onChange={e=>update("tp",e.target.value)} placeholder="₹ 0.00" required />
        <Select label="CPA opted" value={form.cpaOpted} onChange={e=>update("cpaOpted",e.target.value)} options={["Yes","No"]} placeholder="Select" />
        <Field label="CPA amount" type="number" min="0" value={form.cpaOpted==="Yes"?form.cpa:"0"} onChange={e=>update("cpa",e.target.value)} disabled={form.cpaOpted==="No"} placeholder="₹ 0.00" />
        <PremiumCalculationBand
          net={calculations.net}
          gst={calculations.gst}
          gross={calculations.gross}
          gstRule={form.vehicleClass === "GCV" ? "18% OD + CPA · 5% TP" : "18% on Net"}
        />
        <Field label="Policy number" value={form.policyNo} onChange={e=>update("policyNo",e.target.value.toUpperCase())} placeholder="Policy number" required />
        <div><label className={labelClass}>Insurance company <Required/></label><select className={inputClass} value={form.insurerId} onChange={e=>update("insurerId",e.target.value)}><option value="">Select insurer</option>{insurers.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
        <Field label="Valid from" type="date" value={form.validFrom} onChange={e=>update("validFrom",e.target.value)} required/><Field label="Valid upto" type="date" value={form.validUpto} onChange={e=>update("validUpto",e.target.value)} required/>
      </Section>

      <Section number="04" title="Projected insurer pay-in" subtitle="Projected receivable and billing values are saved separately." badge="prototype_v1">
        <PercentField label="Projected OD pay-in %" value={form.projectedOdPercent} onChange={v=>update("projectedOdPercent",v)}/><CalculatedOutcome label="Projected OD amount" value={money.format(calculations.projectedOd)} />
        <PercentField label="Projected TP pay-in %" value={form.projectedTpPercent} onChange={v=>update("projectedTpPercent",v)}/><CalculatedOutcome label="Projected TP amount" value={money.format(calculations.projectedTp)} />
        <Field label="Any insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={e=>update("insurerScheme",e.target.value)} placeholder="₹ 0.00"/>
        <PayinCalculationBand
          total={calculations.totalPayin}
          tds={calculations.tds}
          afterTds={calculations.payinAfterTds}
        />
        <Field label="Retention" type="number" min="0" value={form.retention} onChange={e=>update("retention",e.target.value)} placeholder="₹ 0.00"/>
      </Section>

      <Section number="05" title="Intermediary payout & settlement" subtitle="Stores the proposed partner payout and settlement status." badge="Finance workflow">
        <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)}/><PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"}/>
        <CalculatedOutcome label="Gross partner payout" value={money.format(calculations.grossPayout)} accent />
        <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status"/>
        <Field label="Payout date" type="date" value={form.payoutDate} onChange={e=>update("payoutDate",e.target.value)}/><Field label="Payout voucher number" value={form.payoutVoucherNo} onChange={e=>update("payoutVoucherNo",e.target.value.toUpperCase())} placeholder="Voucher / reference"/>
        <div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-20 w-full rounded-xl border border-[#D8DEE9] px-3 py-2 text-[11px] outline-none focus:border-[#315B9A]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy, billing or payout notes"/></div>
      </Section>
    </div>

    <LiveSummary net={calculations.net} gst={calculations.gst} gross={calculations.gross} payinAfterTds={calculations.payinAfterTds} grossPayout={calculations.grossPayout}/></div>

    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</Link><button type="button" onClick={submitPolicy} disabled={isSubmitting} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{isSubmitting ? "Booking policy…" : "Book Active Policy"}</button></div></div>

    {submitError ? <ValidationErrorDialog message={submitError} onClose={()=>setSubmitError(null)} /> : null}
    {rcReview ? <RcModal review={rcReview} groups={applyGroups} setGroups={setApplyGroups} onCancel={()=>setRcReview(null)} onUse={useRcDetails}/> : null}
    {customerCandidates ? <CustomerMatchModal candidates={customerCandidates} onChoose={chooseCustomer} onCancel={()=>setCustomerCandidates(null)}/> : null}
    {ownershipConflict ? <OwnershipModal conflict={ownershipConflict} onResolve={resolveOwnership} onCancel={()=>setOwnershipConflict(null)}/> : null}
  </div>;
}



function DerivedDisplay({ label, value, source }: { label: string; value: string; source?: string }) {
  return <div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3">
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">{label}</span>
      {source ? <span className="rounded-full bg-[#EDF7F2] px-1.5 py-0.5 text-[7px] font-bold text-[#18794E]">{source}</span> : null}
    </div>
    <div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{value || "—"}</div>
  </div>;
}

function CompactSourceMeta({ label, value, source, hiddenValue, onHiddenChange }: { label: string; value: string; source?: string; hiddenValue?: string; onHiddenChange?: (value: string) => void }) {
  return <div className="mt-1.5 min-h-[15px] px-0.5 leading-none">
    <label className="flex min-w-0 items-center gap-1.5 text-[7.5px] font-semibold tracking-[.02em] text-[#7A8CA5]">
      <span className="shrink-0">{label}</span>
      {source ? <span className="text-[6.5px] font-bold uppercase tracking-[.08em] text-[#4F8C7A]">{source}</span> : null}
      {onHiddenChange ? <input className="sr-only" value={hiddenValue ?? ""} onChange={(event) => onHiddenChange(event.target.value)} tabIndex={-1} aria-label={label} /> : null}
      <span className={`min-w-0 truncate text-[8.5px] font-semibold ${value && value !== "Select lead source" ? "text-[#526A87]" : "text-[#A0AAB8]"}`}>· {value}</span>
    </label>
  </div>;
}

function PremiumCalculationBand({ net, gst, gross, gstRule }: { net: number; gst: number; gross: number; gstRule: string }) {
  return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[linear-gradient(90deg,#F8FBFF,#F4F8FD)]">
    <div className="grid grid-cols-3 divide-x divide-[#DFE7F1]">
      <CalculationMetric label="Net premium" value={money.format(net)} />
      <CalculationMetric label="GST" value={money.format(gst)} note={gstRule} />
      <CalculationMetric label="Gross premium" value={money.format(gross)} accent />
    </div>
  </div>;
}

function PayinCalculationBand({ total, tds, afterTds }: { total: number; tds: number; afterTds: number }) {
  return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]">
    <div className="grid grid-cols-3 divide-x divide-[#DFE7F1]">
      <CalculationMetric label="Total projected pay-in" value={money.format(total)} />
      <CalculationMetric label="TDS" value={money.format(tds)} note="10%" />
      <CalculationMetric label="Pay-in after TDS" value={money.format(afterTds)} accent />
    </div>
  </div>;
}

function CalculationMetric({ label, value, note, accent = false }: { label: string; value: string; note?: string; accent?: boolean }) {
  return <div className={`px-3 py-2.5 ${accent ? "bg-[#EEF4FF]" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</span>
      {note ? <span className="text-[7px] font-semibold text-[#98A2B3]">{note}</span> : null}
    </div>
    <div className={`mt-1 text-[12px] font-bold ${accent ? "text-[#4F46E5]" : "text-[#17365D]"}`}>{value}</div>
  </div>;
}

function CalculatedOutcome({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex min-h-10 items-center justify-between gap-3 border-b border-dashed border-[#D9E2F0] px-1 py-1">
    <div>
      <div className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</div>
      <div className="mt-0.5 text-[7px] font-medium text-[#98A2B3]">Calculated</div>
    </div>
    <div className={`text-[11px] font-bold ${accent ? "text-[#4F46E5]" : "text-[#17365D]"}`}>{value}</div>
  </div>;
}

function LiveSummary({ net, gst, gross, payinAfterTds, grossPayout }: { net:number;gst:number;gross:number;payinAfterTds:number;grossPayout:number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left:number; width:number; top:number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (window.innerWidth < 1280 || !anchorRef.current) {
        setPosition(null);
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();
      const safeTop = 172;
      setPosition({ left: rect.left, width: rect.width, top: Math.max(rect.top, safeTop) });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const observer = new ResizeObserver(updatePosition);
    if (anchorRef.current) observer.observe(anchorRef.current);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      observer.disconnect();
    };
  }, []);

  const card = <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="border-b bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold">Policy Financials</h3></div><div className="space-y-2.5 p-4"><SummaryRow label="Net Premium" value={money.format(net)} bold/><SummaryRow label="GST" value={money.format(gst)}/><SummaryRow label="Gross Premium" value={money.format(gross)} bold accent/><Divider/><SummaryRow label="Pay-in after TDS" value={money.format(payinAfterTds)}/><SummaryRow label="Partner payout" value={money.format(grossPayout)}/><SummaryRow label="Indicative margin" value={money.format(payinAfterTds-grossPayout)} bold/></div></div>;

  return <aside className="xl:self-stretch">
    <div className="xl:hidden">{card}</div>
    <div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true" />
    {position && typeof document !== "undefined" ? createPortal(
      <div className="fixed z-30" style={{ left: position.left, width: position.width, top: position.top }}>{card}</div>,
      document.body,
    ) : null}
  </aside>;
}

function ValidationErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    okRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="policy-validation-title" aria-describedby="policy-validation-message">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(7,29,73,.42)]">
        <div className="px-6 pb-5 pt-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF3E8] text-[#D45B16] ring-8 ring-[#FFF8F2]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 2.7 17.1A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h2 id="policy-validation-title" className="mt-5 text-[17px] font-bold text-[#102A4C]">Please check the form</h2>
          <p id="policy-validation-message" className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#667085]">{message}</p>
        </div>
        <div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-6 py-4">
          <button ref={okRef} type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#102A4C] focus:outline-none focus:ring-2 focus:ring-[#315B9A] focus:ring-offset-2">OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModalShell({ title, subtitle, onClose, children, footer }: { title:string;subtitle:string;onClose:()=>void;children:ReactNode;footer:ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#071D49]/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(7,29,73,.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-3"><p className="truncate text-[15px] font-bold text-[#102A4C]">{title}</p><p className="mt-1 truncate text-[9.5px] text-[#667085]">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-lg text-[#475467] hover:bg-[#F2F5F9]" aria-label="Close">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        <div className="shrink-0 border-t border-[#E6EBF2] bg-white px-4 py-3 sm:px-5 sm:py-4">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
function RcModal({ review, groups, setGroups, onCancel, onUse }: { review:PolicyRcReview;groups:ApplyGroups;setGroups:(value:ApplyGroups)=>void;onCancel:()=>void;onUse:()=>void }) {
  const toggles: Array<[keyof ApplyGroups,string,string]> = [["ownerIdentity","Owner identity","Name and available mobile"],["ownerAddress","Owner address","Address, city, district, state and pincode"],["vehicleIdentity","Vehicle identity","Class, make, model, fuel and year"],["technical","Technical details","Capacity, chassis and engine"],["compliance","Registration & compliance","RTO, registration, fitness, tax, permit and PUC"],["finance","Hypothecation","Financed status and financer"]];
  return <ModalShell title="AuthBridge RC Verification" subtitle={`${review.registrationNumber} · ${review.registrationStatus || "RC details found"} · Review before applying`} onClose={onCancel} footer={<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] text-[#667085]">Existing manually entered fields are preserved. Existing RC insurance is reference-only.</p><div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={onUse} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-[10px] font-bold text-white">Use These Details</button></div></div>}>
    <div className="mb-5 rounded-2xl border border-[#DCE5F0] bg-[#F8FAFD] p-4"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#315B9A]">Select what to apply</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{toggles.map(([key,title,text])=><label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-[#DCE5F0] bg-white p-3"><input type="checkbox" checked={groups[key]} onChange={e=>setGroups({...groups,[key]:e.target.checked})} className="mt-0.5 h-4 w-4 accent-[#17365D]"/><span><span className="block text-[10px] font-bold text-[#17203A]">{title}</span><span className="mt-0.5 block text-[8px] leading-3 text-[#667085]">{text}</span></span></label>)}</div></div>
    <RcGroup title="Vehicle summary" items={[["Registration",review.registrationNumber],["Owner / insured",review.ownerName],["Vehicle class",review.vehicleClass],["Category",review.vehicleCategory],["Manufacturer",review.make],["Model",review.model],["Fuel",review.fuelType],["Manufacture date",review.manufactureDate],["Colour",review.color],["Commercial",review.isCommercial]]}/>
    <RcGroup title="Technical details" items={[["Engine capacity / CC",review.engineCapacity],["Seating capacity",review.seatingCapacity],["Standing capacity",review.standingCapacity],["Sleeper capacity",review.sleeperCapacity],["Gross weight / GVW",review.grossWeight],["Unladen weight",review.unladenWeight],["Wheel base",review.wheelBase],["Cylinders",review.cylinders],["Body type",review.bodyType],["Emission norm",review.normsType],["Chassis number",review.chassisNumber],["Engine number",review.engineNumber]]}/>
    <RcGroup title="Registration & compliance" items={[["Registration date",review.registrationDate],["RC status",review.registrationStatus],["Status as on",review.statusAsOn],["RTO",review.rtoName],["RTO state",review.rtoState],["Fitness / RC expiry",review.fitnessExpiryDate],["Tax upto",review.taxUpto],["PUC number",review.pucNumber],["PUC upto",review.pucUpto],["Permit number",review.permitNumber],["Permit type",review.permitType],["Permit valid upto",review.permitValidUpto],["National permit number",review.nationalPermitNumber],["National permit upto",review.nationalPermitUpto],["Blacklist status",review.blacklistStatus]]}/>
    <RcGroup title="Existing insurance — reference only" items={[["Insurance company",review.insuranceCompany],["Policy number",review.insurancePolicyNumber],["Insurance upto",review.insuranceUpto]]}/>
    <RcGroup title="Hypothecation" items={[["Financed",review.financed],["Financer",review.financerName]]}/>
    <RcGroup title="Owner address" items={[["City",review.ownerCity],["District",review.ownerDistrict],["State",review.ownerState],["Pincode",review.ownerPincode],["Present address",review.presentAddress],["Permanent address",review.permanentAddress]]}/>
    <p className="mt-5 rounded-xl bg-[#F2F5F9] px-3 py-2 text-[8px] text-[#667085]">INSUREIT transaction: {review.transactionId ?? "—"} · Provider transaction: {review.providerTransactionId ?? "—"}</p>
  </ModalShell>;
}
function CustomerMatchModal({ candidates, onChoose, onCancel }: { candidates:PolicyCustomerCandidate[];onChoose:(id:string|null)=>void;onCancel:()=>void }) {
  return <ModalShell title="Possible Customer Matches" subtitle="Choose an existing customer or explicitly create a new customer." onClose={onCancel} footer={<div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={()=>onChoose(null)} className="rounded-xl bg-[#17365D] px-4 py-2.5 text-[10px] font-bold text-white">Create New Customer</button></div>}><div className="space-y-2">{candidates.map(candidate=><button type="button" key={candidate.id} onClick={()=>onChoose(candidate.id)} className="flex w-full items-center justify-between rounded-2xl border border-[#DCE5F0] bg-white p-4 text-left hover:border-[#7C9BC3] hover:bg-[#F8FAFD]"><div><p className="text-[11px] font-bold text-[#17203A]">{candidate.name}</p><p className="mt-1 text-[9px] text-[#667085]">{candidate.phone} · {[candidate.city,candidate.state].filter(Boolean).join(", ") || "Location not available"}</p></div><span className="rounded-lg bg-[#EEF4FB] px-3 py-2 text-[9px] font-bold text-[#17365D]">Use customer</span></button>)}</div></ModalShell>;
}
function OwnershipModal({ conflict, onResolve, onCancel }: { conflict:PolicyOwnershipConflict;onResolve:(decision:"keep_existing"|"transfer")=>void;onCancel:()=>void }) {
  return <ModalShell title="Vehicle Ownership Conflict" subtitle={`${conflict.registrationNumber} is already linked to another customer.`} onClose={onCancel} footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={()=>onResolve("keep_existing")} className="rounded-xl border border-[#9BB3D0] bg-[#EEF4FB] px-4 py-2.5 text-[10px] font-bold text-[#17365D]">Keep Existing Customer</button>{conflict.canTransfer?<button type="button" onClick={()=>onResolve("transfer")} className="rounded-xl bg-amber-600 px-4 py-2.5 text-[10px] font-bold text-white">Confirm Ownership Transfer</button>:null}</div>}><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-[10px] font-bold text-amber-900">Current linked customer</p><p className="mt-2 text-[14px] font-bold text-[#17203A]">{conflict.customerName}</p><p className="mt-1 text-[10px] text-[#667085]">{conflict.customerPhone || "Phone not available"}</p><p className="mt-4 text-[9px] leading-4 text-amber-800">Transferring ownership creates an auditable ownership-history record. Only Manager/Admin roles can approve this action.</p>{!conflict.canTransfer?<p className="mt-3 rounded-lg bg-white px-3 py-2 text-[9px] font-bold text-red-700">Your role cannot transfer ownership. Keep the existing customer or ask a Manager/Admin to complete the booking.</p>:null}</div></ModalShell>;
}
function RcGroup({ title, items }: { title:string;items:Array<[string,string|null]> }) { const visible=items.filter(([,value])=>value&&value!=="NA"); if(!visible.length)return null; return <div className="mb-5"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#315B9A]">{title}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{visible.map(([label,value])=><ReviewItem key={label} label={label} value={value}/>)}</div></div>; }
function Section({ number,title,subtitle,badge,children }: { number:string;title:string;subtitle:string;badge:string;children:ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2><p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p></div></div><span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label:string }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><input {...props} required={required} className={inputClass}/></div>; }
function Select({ label, options, placeholder, required, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label:string;options:string[];placeholder:string }) { return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>; }
function PercentField({ label,value,onChange,disabled }: { label:string;value:string;onChange:(v:string)=>void;disabled?:boolean }) { return <Field label={label} type="number" min="0" max="100" step="0.01" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder="0.00"/>; }
function ReadOnly({ label,value,strong,accent }: { label:string;value:string;strong?:boolean;accent?:boolean }) { return <div><label className={labelClass}>{label}<Tag text="Auto" tone="green"/></label><div className={`flex h-10 items-center rounded-xl border px-3 text-[11px] ${accent?"border-indigo-200 bg-indigo-50 text-indigo-800":"border-emerald-100 bg-emerald-50/50 text-emerald-900"} ${strong?"font-bold":"font-semibold"}`}>{value}</div></div>; }
function ReviewItem({ label,value }: { label:string;value:string|null }) { return <div className="min-w-0 rounded-xl border border-[#DCE5F0] bg-[#F8FAFD] px-3 py-2.5"><p className="text-[7px] font-bold uppercase tracking-[.08em] text-[#52749E]">{label}</p><p className="mt-1 break-words text-[9.5px] font-semibold text-[#17203A]">{value||"Not returned"}</p></div>; }
function Required(){return <span className="text-red-500">*</span>;} function Tag({text,tone}:{text:string;tone:"amber"|"green"}){return <span className={`rounded px-1.5 py-0.5 text-[7px] font-bold normal-case ${tone==="amber"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>{text}</span>;}
function SummaryRow({label,value,bold,accent}:{label:string;value:string;bold?:boolean;accent?:boolean}){return <div className="flex justify-between gap-3"><span className={`text-[9.5px] ${bold?"font-semibold":"text-[#667085]"}`}>{label}</span><span className={`text-[10px] ${bold?"font-bold":"font-semibold"} ${accent?"text-[#4F46E5]":""}`}>{value}</span></div>;} function Divider(){return <div className="border-t border-dashed"/>;}
