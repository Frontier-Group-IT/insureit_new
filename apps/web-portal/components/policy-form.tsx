"use client";

import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useMemo, useState } from "react";

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
  PCP: { description: "Private Car", capacityLabel: "CC" },
  TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" },
  PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" },
  CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" }
};

const emptyState: FormState = {
  issuanceDate: new Date().toISOString().slice(0, 10), rmName: "", intermediaryType: "", leadSource: "", intermediaryCode: "", businessLine: "Motor",
  registrationNo: "", insuredName: "", phoneNo: "", vehicleClass: "", make: "", model: "", fuelType: "", capacity: "", manufacturingYear: "", chassisNo: "", engineNo: "", rtoState: "", rtoName: "",
  policyProduct: "", idv: "", od: "", tp: "", cpaOpted: "Yes", cpa: "", policyNo: "", insurerId: "", validFrom: "", validUpto: "", payoutBasis: "NET", projectedOdPercent: "", projectedTpPercent: "", insurerScheme: "",
  payinBillNo: "", payinBilledAmount: "", payinBillDate: "", payinStatus: "Unbilled", retention: "", payoutOdPercent: "", payoutTpPercent: "", payoutStatus: "Pending", payoutDate: "", payoutVoucherNo: "", remarks: ""
};

export function PolicyForm({ action, createInsurerAction, customers, vehicles, insurers, values, submitLabel = "Create Policy" }: Props) {
  void action; void createInsurerAction; void customers; void vehicles; void submitLabel;
  const [form, setForm] = useState<FormState>({ ...emptyState, insurerId: values?.insurance_company_id ?? "", policyNo: values?.policy_no ?? "", policyProduct: values?.policy_type ?? "", idv: values?.insured_declared_value?.toString() ?? "", validFrom: values?.start_date ?? "", validUpto: values?.end_date ?? "" });
  const [activeSection, setActiveSection] = useState(0);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found">("idle");

  const numeric = (value: string) => Number(value || 0);
  const calculations = useMemo(() => {
    const od = numeric(form.od); const tp = numeric(form.tp); const cpa = form.cpaOpted === "Yes" ? numeric(form.cpa) : 0;
    const net = od + tp + cpa;
    const gst = form.vehicleClass === "GCV" ? ((od + cpa) * 0.18) + (tp * 0.05) : net * 0.18;
    const gross = net + gst;
    const odBase = form.payoutBasis === "OD" ? od : od;
    const projectedOd = odBase * numeric(form.projectedOdPercent) / 100;
    const projectedTp = tp * numeric(form.projectedTpPercent) / 100;
    const scheme = numeric(form.insurerScheme);
    const totalPayin = projectedOd + projectedTp + scheme;
    const tds = totalPayin * 0.10;
    const payinAfterTds = totalPayin - tds;
    const payoutOd = od * numeric(form.payoutOdPercent) / 100;
    const payoutTp = form.payoutBasis === "OD" ? 0 : tp * numeric(form.payoutTpPercent) / 100;
    const grossPayout = Math.max(0, payoutOd + payoutTp - numeric(form.retention));
    const shortPayout = Math.max(0, totalPayin - numeric(form.payinBilledAmount));
    return { net, gst, gross, projectedOd, projectedTp, totalPayin, tds, payinAfterTds, grossPayout, shortPayout };
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeVehicleClass(value: string) {
    setForm((current) => ({ ...current, vehicleClass: value, capacity: "", policyProduct: "" }));
  }

  function simulateVehicleLookup() {
    if (form.registrationNo.replace(/\s/g, "").length < 4) return;
    setLookupState("loading");
    window.setTimeout(() => {
      setForm((current) => ({ ...current, insuredName: current.insuredName || "SUBHASH", vehicleClass: current.vehicleClass || "PCP", make: current.make || "Tata Motors", model: current.model || "Tiago", fuelType: current.fuelType || "Petrol", manufacturingYear: current.manufacturingYear || "2021", chassisNo: current.chassisNo || "MAT632101MPCG9706", engineNo: current.engineNo || "REVTRN10CYXM64025", rtoState: current.rtoState || "Delhi / NCR", rtoName: current.rtoName || "HR51 – Faridabad" }));
      setLookupState("found");
    }, 650);
  }

  const vehicleMeta = vehicleClassMap[form.vehicleClass];
  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP"
    ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"]
    : ["Package", "Third Party", "SAOD"];

  return (
    <div className="mx-auto max-w-[1480px] pb-24">
      <div className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#E7ECF3] bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em]">V1 UI Prototype</span><span className="text-[9px] text-white/70">No database migration in this build</span></div>
            <h1 className="mt-2 text-[18px] font-semibold tracking-tight">Policy Onboarding</h1>
            <p className="mt-0.5 max-w-2xl text-[10px] leading-4 text-white/70">Book the policy first. INSUREIT will later resolve or create the customer and vehicle during final submission.</p>
          </div>
          <div className="flex items-center gap-2"><button type="button" className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[10px] font-semibold hover:bg-white/15">Save Draft</button><button type="button" className="rounded-lg bg-white px-4 py-2 text-[10px] font-bold text-[#071D49] shadow-sm">Submit for Review</button></div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 py-2">
          {sections.map((section, index) => <button key={section} type="button" onClick={() => setActiveSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold transition ${activeSection === index ? "bg-[#EEF2FF] text-[#4338CA]" : "text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${activeSection === index ? "bg-[#4F46E5] text-white" : "bg-[#EEF2F6] text-[#667085]"}`}>{index + 1}</span>{section}</button>)}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Manual + master selections">
            <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={(e) => update("issuanceDate", e.target.value)} required />
            <ReadOnly label="Month" value={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto from issuance date"} />
            <Select label="RM name" value={form.rmName} onChange={(e) => update("rmName", e.target.value)} options={["Pramod", "Parsottam", "Krishan Kumar", "Megha", "Jayesh", "Jatin"]} placeholder="Select RM" required />
            <Select label="Intermediary type" value={form.intermediaryType} onChange={(e) => update("intermediaryType", e.target.value)} options={["POSP", "MISP", "SIBL / Partner"]} placeholder="Select type" required />
            <Field label="Lead source" value={form.leadSource} onChange={(e) => update("leadSource", e.target.value)} placeholder="Search person / channel" />
            <Field label="Intermediary code" value={form.intermediaryCode} onChange={(e) => update("intermediaryCode", e.target.value.toUpperCase())} placeholder="POSP/0001" hint="Will be auto-linked from intermediary master" />
            <Select label="Policy type" value={form.businessLine} onChange={(e) => update("businessLine", e.target.value)} options={["Motor"]} placeholder="Select policy type" />
          </Section>

          <Section number="02" title="Insured & vehicle identification" subtitle="Search by registration first. Existing records will be linked; missing records will be created during final submission." badge="API assisted">
            <div className="md:col-span-2 xl:col-span-2"><label className={labelClass}>Registration number <Required /> <Tag text="API lookup" tone="amber" /></label><div className="flex gap-2"><input className={`${inputClass} uppercase`} value={form.registrationNo} onChange={(e) => { update("registrationNo", e.target.value.toUpperCase()); setLookupState("idle"); }} placeholder="Enter at least first 4 characters" /><button type="button" onClick={simulateVehicleLookup} className="min-w-[112px] rounded-lg bg-[#17365D] px-3 text-[9.5px] font-bold text-white disabled:opacity-40" disabled={form.registrationNo.replace(/\s/g, "").length < 4 || lookupState === "loading"}>{lookupState === "loading" ? "Searching…" : lookupState === "found" ? "Refresh" : "Find Vehicle"}</button></div>{lookupState === "found" ? <p className="mt-1 text-[9px] font-semibold text-emerald-600">Vehicle details found. Review and correct where required.</p> : <p className="mt-1 text-[8.5px] text-[#98A2B3]">Example lookup is simulated in this V1 interface.</p>}</div>
            <Field label="Insured name" value={form.insuredName} onChange={(e) => update("insuredName", e.target.value.toUpperCase())} placeholder="Customer / insured name" badge="API" required />
            <Field label="Phone number" value={form.phoneNo} onChange={(e) => update("phoneNo", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit mobile" inputMode="numeric" />
            <Select label="Class of vehicle" value={form.vehicleClass} onChange={(e) => changeVehicleClass(e.target.value)} options={Object.keys(vehicleClassMap)} placeholder="Select class" badge="Dropdown" required />
            <ReadOnly label="Vehicle class description" value={vehicleMeta?.description || "Auto from class"} />
            <Field label="Make" value={form.make} onChange={(e) => update("make", e.target.value)} placeholder="Vehicle manufacturer" badge="API" />
            <Field label="Model" value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="Model / variant" badge="API" />
            <Select label="Fuel type" value={form.fuelType} onChange={(e) => update("fuelType", e.target.value)} options={["Petrol", "Diesel", "CNG", "Electric", "Hybrid", "Bi-Fuel", "Other"]} placeholder="Select fuel" />
            <Field label={vehicleMeta?.capacityLabel || "CC / Seating / GVW / Category"} value={form.capacity} onChange={(e) => update("capacity", e.target.value)} placeholder={vehicleMeta ? `Enter ${vehicleMeta.capacityLabel.toLowerCase()}` : "Select vehicle class first"} disabled={!form.vehicleClass} />
            <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={(e) => update("manufacturingYear", e.target.value)} options={Array.from({ length: 31 }, (_, i) => String(new Date().getFullYear() - i))} placeholder="Select year" />
            <Field label="Chassis number" value={form.chassisNo} onChange={(e) => update("chassisNo", e.target.value.toUpperCase())} placeholder="Enter chassis number" badge="API" />
            <Field label="Engine number" value={form.engineNo} onChange={(e) => update("engineNo", e.target.value.toUpperCase())} placeholder="Enter engine number" badge="API" />
            <Select label="RTO state" value={form.rtoState} onChange={(e) => update("rtoState", e.target.value)} options={["Delhi / NCR", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan", "Punjab", "Other"]} placeholder="Select state" />
            <Field label="RTO name / code" value={form.rtoName} onChange={(e) => update("rtoName", e.target.value.toUpperCase())} placeholder="HR30 – Palwal" badge="Auto" />
          </Section>

          <Section number="03" title="Policy product, premium & validity" subtitle="Enter insurer-issued premium components. Net, GST and Gross update automatically." badge="Manual + calculated">
            <Select label="Policy product" value={form.policyProduct} onChange={(e) => update("policyProduct", e.target.value)} options={policyProducts} placeholder={form.vehicleClass ? "Select product" : "Select vehicle class first"} disabled={!form.vehicleClass} required />
            <Field label="IDV / Sum insured" type="number" min="0" value={form.idv} onChange={(e) => update("idv", e.target.value)} placeholder="₹ 0.00" required />
            <Field label="OD premium" type="number" min="0" value={form.od} onChange={(e) => update("od", e.target.value)} placeholder="₹ 0.00" required />
            <Field label="Third party premium" type="number" min="0" value={form.tp} onChange={(e) => update("tp", e.target.value)} placeholder="₹ 0.00" required />
            <Select label="CPA opted" value={form.cpaOpted} onChange={(e) => update("cpaOpted", e.target.value)} options={["Yes", "No"]} placeholder="Select" />
            <Field label="CPA amount" type="number" min="0" value={form.cpaOpted === "Yes" ? form.cpa : "0"} onChange={(e) => update("cpa", e.target.value)} placeholder="₹ 0.00" disabled={form.cpaOpted === "No"} badge="Rule based" />
            <ReadOnly label="Net premium" value={money.format(calculations.net)} strong />
            <ReadOnly label="GST" value={money.format(calculations.gst)} strong hint={form.vehicleClass === "GCV" ? "18% OD+CPA and 5% TP" : "18% of Net"} />
            <ReadOnly label="Gross premium" value={money.format(calculations.gross)} strong accent />
            <Field label="Policy number" value={form.policyNo} onChange={(e) => update("policyNo", e.target.value.toUpperCase())} placeholder="Enter policy number" required />
            <div><label className={labelClass}>Insurance company <Required /></label><select className={inputClass} value={form.insurerId} onChange={(e) => update("insurerId", e.target.value)}><option value="">Select insurer</option>{insurers.map((insurer) => <option key={insurer.value} value={insurer.value}>{insurer.label}</option>)}</select></div>
            <Field label="Valid from" type="date" value={form.validFrom} onChange={(e) => update("validFrom", e.target.value)} required />
            <Field label="Valid upto" type="date" value={form.validUpto} onChange={(e) => update("validUpto", e.target.value)} hint="Editable for short and multi-year policies" required />
          </Section>

          <Section number="04" title="Projected insurer pay-in" subtitle="Capture the projected commission receivable from the insurance company." badge="Rate assisted">
            <PercentField label="Projected OD pay-in %" value={form.projectedOdPercent} onChange={(value) => update("projectedOdPercent", value)} />
            <ReadOnly label="Projected OD pay-in" value={money.format(calculations.projectedOd)} strong />
            <PercentField label="Projected TP pay-in %" value={form.projectedTpPercent} onChange={(value) => update("projectedTpPercent", value)} />
            <ReadOnly label="Projected TP pay-in" value={money.format(calculations.projectedTp)} strong />
            <Field label="Any insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={(e) => update("insurerScheme", e.target.value)} placeholder="₹ 0.00" />
            <ReadOnly label="Total projected pay-in" value={money.format(calculations.totalPayin)} strong accent />
            <ReadOnly label="TDS on pay-in" value={money.format(calculations.tds)} hint="Prototype assumes 10%" />
            <ReadOnly label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)} strong />
            <Field label="Retention" type="number" min="0" value={form.retention} onChange={(e) => update("retention", e.target.value)} placeholder="₹ 0.00" />
          </Section>

          <Section number="05" title="Intermediary payout & settlement" subtitle="Record the proposed payout payable to POSP, MISP or Partner." badge="Finance workflow">
            <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={(value) => update("payoutOdPercent", value)} />
            <PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={(value) => update("payoutTpPercent", value)} disabled={form.payoutBasis === "OD"} hint={form.payoutBasis === "OD" ? "Zero as per current Excel note" : undefined} />
            <ReadOnly label="Gross payout" value={money.format(calculations.grossPayout)} strong accent />
            <Select label="Payout status" value={form.payoutStatus} onChange={(e) => update("payoutStatus", e.target.value)} options={["Pending", "Approved", "On Hold", "Processed", "Paid", "Cancelled"]} placeholder="Select status" />
            <Field label="Payout date" type="date" value={form.payoutDate} onChange={(e) => update("payoutDate", e.target.value)} />
            <Field label="Payout voucher number" value={form.payoutVoucherNo} onChange={(e) => update("payoutVoucherNo", e.target.value.toUpperCase())} placeholder="Voucher / reference" />
            <div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-20 w-full resize-y rounded-lg border border-[#D8DEE9] bg-white px-3 py-2 text-[11px] text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Add policy, billing or payout notes" /></div>
          </Section>
        </div>

        <aside className="space-y-4 xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:sticky xl:top-4 xl:z-10">
            <div className="border-b border-[#E7ECF3] bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#4F46E5]">Live summary</p><h3 className="mt-1 text-[13px] font-semibold text-[#101828]">Policy Financials</h3></div>
            <div className="space-y-2.5 p-4"><SummaryRow label="OD Premium" value={calculations.net ? money.format(numeric(form.od)) : "—"} /><SummaryRow label="Third Party" value={calculations.net ? money.format(numeric(form.tp)) : "—"} /><SummaryRow label="CPA" value={calculations.net ? money.format(form.cpaOpted === "Yes" ? numeric(form.cpa) : 0) : "—"} /><Divider /><SummaryRow label="Net Premium" value={money.format(calculations.net)} bold /><SummaryRow label="GST" value={money.format(calculations.gst)} /><SummaryRow label="Gross Premium" value={money.format(calculations.gross)} bold accent /><Divider /><SummaryRow label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)} /><SummaryRow label="Partner payout" value={money.format(calculations.grossPayout)} /><SummaryRow label="Indicative margin" value={money.format(calculations.payinAfterTds - calculations.grossPayout)} bold /></div>
          </div>
          <div className="rounded-2xl border border-[#D9E2F0] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#667085]">Field behaviour</p><div className="mt-3 space-y-2"><Legend tone="amber" title="API assisted" text="Fetched or suggested from vehicle lookup" /><Legend tone="indigo" title="Dropdown / master" text="Controlled options to avoid spelling differences" /><Legend tone="green" title="Auto calculated" text="Updates from premium and payout values" /><Legend tone="slate" title="Manual entry" text="Entered directly from the policy document" /></div></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-bold text-amber-900">Prototype safeguard</p><p className="mt-1 text-[9px] leading-4 text-amber-800">Buttons are intentionally non-submitting. This screen is for UI/UX approval before database mapping and final business-rule implementation.</p></div>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3"><div className="hidden sm:block"><p className="text-[10px] font-semibold text-[#344054]">V1 Policy Onboarding Prototype</p><p className="text-[8.5px] text-[#98A2B3]">Review all sections before sharing with the client.</p></div><div className="ml-auto flex gap-2"><Link href="/policies" className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-[10px] font-semibold text-[#344054] hover:bg-[#F8FAFC]">Cancel</Link><button type="button" className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2 text-[10px] font-semibold text-[#4338CA]">Save Draft</button><button type="button" className="rounded-lg bg-[#17365D] px-5 py-2 text-[10px] font-bold text-white shadow-sm">Submit for UI Review</button></div></div></div>
    </div>
  );
}

function Section({ number, title, subtitle, badge, children }: { number: string; title: string; subtitle: string; badge: string; children: ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.045)]"><div className="flex flex-col gap-2 border-b border-[#E7ECF3] bg-[#FBFCFE] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold text-[#101828]">{title}</h2><p className="mt-0.5 text-[9px] leading-4 text-[#667085]">{subtitle}</p></div></div><span className="w-fit rounded-full border border-[#D0D5DD] bg-white px-2.5 py-1 text-[8px] font-semibold text-[#667085]">{badge}</span></div><div className="grid gap-x-3 gap-y-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, badge, hint, required, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; badge?: string; hint?: string }) { return <div className={className}><label className={labelClass}>{label}{required ? <Required /> : null}{badge ? <Tag text={badge} tone="amber" /> : null}</label><input {...props} required={required} className={`${inputClass} ${props.type === "number" ? "tabular-nums" : ""}`} />{hint ? <p className="mt-1 text-[8px] leading-3 text-[#98A2B3]">{hint}</p> : null}</div>; }
function Select({ label, options, placeholder, badge, required, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[]; placeholder: string; badge?: string }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}{badge ? <Tag text={badge} tone="indigo" /> : null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>; }
function PercentField({ label, value, onChange, disabled, hint }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; hint?: string }) { return <div><label className={labelClass}>{label}<Tag text="%" tone="indigo" /></label><div className="relative"><input type="number" min="0" max="100" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${inputClass} pr-8 tabular-nums`} placeholder="0.00" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#98A2B3]">%</span></div>{hint ? <p className="mt-1 text-[8px] text-[#98A2B3]">{hint}</p> : null}</div>; }
function ReadOnly({ label, value, strong, accent, hint }: { label: string; value: string; strong?: boolean; accent?: boolean; hint?: string }) { return <div><label className={labelClass}>{label}<Tag text="Auto" tone="green" /></label><div className={`flex h-9 items-center rounded-lg border px-3 text-[11px] tabular-nums ${accent ? "border-[#B7C5F8] bg-[#EEF2FF] text-[#3730A3]" : "border-[#DDE5DD] bg-[#F6FBF6] text-[#365A3C]"} ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>{hint ? <p className="mt-1 text-[8px] text-[#98A2B3]">{hint}</p> : null}</div>; }
function Required() { return <span className="text-red-500">*</span>; }
function Tag({ text, tone }: { text: string; tone: "amber" | "indigo" | "green" }) { const styles = tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "indigo" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"; return <span className={`rounded px-1.5 py-0.5 text-[7px] font-bold normal-case tracking-normal ${styles}`}>{text}</span>; }
function SummaryRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className={`text-[9.5px] ${bold ? "font-semibold text-[#344054]" : "text-[#667085]"}`}>{label}</span><span className={`text-[10px] tabular-nums ${bold ? "font-bold" : "font-semibold"} ${accent ? "text-[#4F46E5]" : "text-[#101828]"}`}>{value}</span></div>; }
function Divider() { return <div className="border-t border-dashed border-[#D0D5DD]" />; }
function Legend({ tone, title, text }: { tone: "amber" | "indigo" | "green" | "slate"; title: string; text: string }) { const dot = tone === "amber" ? "bg-amber-400" : tone === "indigo" ? "bg-indigo-500" : tone === "green" ? "bg-emerald-500" : "bg-slate-400"; return <div className="flex items-start gap-2.5"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} /><div><p className="text-[9px] font-semibold text-[#344054]">{title}</p><p className="text-[8px] leading-3 text-[#98A2B3]">{text}</p></div></div>; }
