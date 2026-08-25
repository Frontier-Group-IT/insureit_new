"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown, ChevronUp, FileText, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { createNonMotorPolicy, type NonMotorPolicyPayload } from "@/app/policies/non-motor-policy-actions";
import type { PolicySourceOption } from "@/components/policy-unified-form";
import type { NonMotorCustomerOption, NonMotorInsurerOption } from "@/components/non-motor-policy-form";

type Props = {
  insurers: NonMotorInsurerOption[];
  customers: NonMotorCustomerOption[];
  sources: PolicySourceOption[];
};

type CustomerMode = "existing" | "new";
type FormState = {
  customerMode: CustomerMode;
  customerId: string;
  customerType: "Individual" | "Organisation";
  insuredName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  policyNumber: string;
  insurerId: string;
  productName: string;
  category: string;
  status: string;
  riskTitle: string;
  riskLocation: string;
  occupancyType: string;
  cargoDescription: string;
  transitFrom: string;
  transitTo: string;
  transitMode: string;
  projectName: string;
  projectValue: string;
  natureOfBusiness: string;
  liabilityType: string;
  employeeCount: string;
  annualWages: string;
  businessName: string;
  annualTurnover: string;
  sumInsured: string;
  deductible: string;
  netPremium: string;
  gstAmount: string;
  grossPremium: string;
  startDate: string;
  endDate: string;
  proposalNumber: string;
  previousInsurer: string;
  previousPolicyNumber: string;
  previousClaims: string;
  addOns: string;
  warranties: string;
  specialConditions: string;
  endorsements: string;
  remarks: string;
};

type SharedSource = {
  issuanceDate: string;
  intermediaryType: "" | "POSP" | "MISP" | "SIBL / Partner";
  sourceId: string;
};

const CATEGORIES = ["Fire & Property", "Marine", "Engineering", "Liability", "Burglary", "Employee Compensation", "Cyber", "Travel", "Personal Accident", "Package Policy", "Other"];
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const emptyForm: FormState = {
  customerMode: "existing", customerId: "", customerType: "Organisation", insuredName: "", contactName: "", phone: "", email: "", address: "",
  policyNumber: "", insurerId: "", productName: "", category: "", status: "Active",
  riskTitle: "", riskLocation: "", occupancyType: "", cargoDescription: "", transitFrom: "", transitTo: "", transitMode: "", projectName: "", projectValue: "", natureOfBusiness: "", liabilityType: "", employeeCount: "", annualWages: "", businessName: "", annualTurnover: "",
  sumInsured: "", deductible: "", netPremium: "", gstAmount: "", grossPremium: "", startDate: "", endDate: "",
  proposalNumber: "", previousInsurer: "", previousPolicyNumber: "", previousClaims: "", addOns: "", warranties: "", specialConditions: "", endorsements: "", remarks: "",
};

function fieldControl(labelText: string) {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  const container = label?.parentElement;
  if (!container) return null;
  return container.querySelector("select, input") as HTMLSelectElement | HTMLInputElement | null;
}

function sharedSource(): SharedSource {
  const issuance = fieldControl("Policy issuance date") as HTMLInputElement | null;
  const intermediary = fieldControl("Intermediary type") as HTMLSelectElement | null;
  const leadSource = fieldControl("Lead source") as HTMLSelectElement | null;
  const value = intermediary?.value ?? "";
  const intermediaryType = value === "POSP" || value === "MISP" || value === "SIBL / Partner" ? value : "";
  return { issuanceDate: issuance?.value ?? "", intermediaryType, sourceId: leadSource?.value ?? "" };
}

export function NonMotorInlineSections({ insurers, customers, sources }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const sync = () => {
      const type = fieldControl("Policy type") as HTMLSelectElement | null;
      setVisible(type?.value === "Non Motor");
    };
    document.addEventListener("change", sync, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { document.removeEventListener("change", sync, true); observer.disconnect(); };
  }, []);

  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";
  const riskLocation = form.riskLocation || form.transitFrom || form.projectName || "Not entered";
  const requiredValues = useMemo(() => [
    form.customerMode === "existing" ? form.customerId : form.insuredName,
    form.policyNumber, form.insurerId, form.productName, form.category,
    ...riskCoreValues(form), form.sumInsured, form.grossPremium, form.startDate, form.endDate,
  ], [form]);
  const completed = requiredValues.filter((value) => String(value ?? "").trim()).length;
  const completion = requiredValues.length ? Math.round((completed / requiredValues.length) * 100) : 0;

  if (!visible) return null;

  function changeCustomer(value: string) {
    const customer = customers.find((item) => item.id === value);
    setForm((current) => ({ ...current, customerId: value, insuredName: customer?.name ?? "", contactName: customer?.contactName ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "" }));
  }

  function submit() {
    setError(null);
    const sourceState = sharedSource();
    const source = sources.find((item) => item.value === sourceState.sourceId);
    if (!sourceState.issuanceDate || !sourceState.intermediaryType || !source) {
      setError("Complete Policy source & ownership in Section 01 before saving the Non-Motor policy.");
      return;
    }
    const payload: NonMotorPolicyPayload = {
      source: {
        issuanceDate: sourceState.issuanceDate,
        intermediaryType: sourceState.intermediaryType,
        intermediaryCode: source.code,
        leadSource: source.label,
        rmName: source.rmName,
      },
      customerId: form.customerMode === "existing" ? form.customerId : undefined,
      customer: { customerType: form.customerType, insuredName: form.insuredName, contactName: form.contactName, phone: form.phone, email: form.email, address: form.address },
      policy: { policyNumber: form.policyNumber, insurerId: form.insurerId, productName: form.productName, category: form.category, status: form.status, startDate: form.startDate, endDate: form.endDate, sumInsured: form.sumInsured, netPremium: form.netPremium, gstAmount: form.gstAmount, grossPremium: form.grossPremium, deductible: form.deductible },
      risk: buildRiskPayload(form),
      additional: { proposalNumber: form.proposalNumber, previousInsurer: form.previousInsurer, previousPolicyNumber: form.previousPolicyNumber, previousClaims: form.previousClaims, addOns: form.addOns, warranties: form.warranties, specialConditions: form.specialConditions, endorsements: form.endorsements, remarks: form.remarks },
    };
    startTransition(async () => {
      const result = await createNonMotorPolicy(payload);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/policies?success=policy_created&policy=${encodeURIComponent(result.policyCode)}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto -mt-20 max-w-[1480px] pb-24 pt-20">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-4">
          <Section number="02" title="Customer & policy">
            <Segmented label="Customer record" value={form.customerMode} options={["existing", "new"]} labels={["Existing", "New"]} onChange={(value) => { const mode = value as CustomerMode; setForm((current) => ({ ...current, customerMode: mode, ...(mode === "new" ? { customerId: "", insuredName: "", contactName: "", phone: "", email: "" } : {}) })); }} />
            {form.customerMode === "existing" ? <div className="sm:col-span-2 xl:col-span-3"><Select label="Customer / organisation" value={form.customerId} onChange={(e) => changeCustomer(e.target.value)} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</Select></div> : <>
              <Select label="Customer type" value={form.customerType} onChange={(e) => update("customerType", e.target.value as FormState["customerType"])}><option>Organisation</option><option>Individual</option></Select>
              <Field label="Insured / organisation name" value={form.insuredName} onChange={(e) => update("insuredName", e.target.value)} placeholder="Name on policy" required />
              <Field label="Contact person" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Primary contact" />
              <Field label="Mobile number" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit mobile" inputMode="numeric" required />
              <Field label="Email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Optional" type="email" />
              <Field label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Optional" />
            </>}
            <Field label="Policy number" value={form.policyNumber} onChange={(e) => update("policyNumber", e.target.value.toUpperCase())} placeholder="Policy number" required />
            <Select label="Insurance company" value={form.insurerId} onChange={(e) => update("insurerId", e.target.value)} required><option value="">Select insurer</option>{insurers.map((insurer) => <option key={insurer.value} value={insurer.value}>{insurer.label}</option>)}</Select>
            <Field label="Product / policy name" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Policy / product" required />
            <Select label="Non-Motor category" value={form.category} onChange={(e) => update("category", e.target.value)} required><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select>
            <Select label="Policy status" value={form.status} onChange={(e) => update("status", e.target.value)}><option>Active</option><option>Pending</option><option>Expired</option><option>Cancelled</option></Select>
          </Section>

          <Section number="03" title="Risk details" subtitle="Only the key servicing information for the selected category is shown.">
            <RiskFields form={form} update={update} />
          </Section>

          <Section number="04" title="Cover, premium & validity">
            <Field label={form.category === "Liability" ? "Liability limit" : "Sum insured / limit"} value={form.sumInsured} onChange={(e) => update("sumInsured", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" required />
            <Field label="Deductible / excess" value={form.deductible} onChange={(e) => update("deductible", numeric(e.target.value))} placeholder="Optional" inputMode="decimal" />
            <Field label="Net premium" value={form.netPremium} onChange={(e) => { const net = numeric(e.target.value); update("netPremium", net); if (net && form.gstAmount) update("grossPremium", String(Number(net) + Number(form.gstAmount))); }} placeholder="₹ 0.00" inputMode="decimal" />
            <Field label="GST" value={form.gstAmount} onChange={(e) => { const gst = numeric(e.target.value); update("gstAmount", gst); if (form.netPremium) update("grossPremium", String(Number(form.netPremium) + Number(gst || 0))); }} placeholder="₹ 0.00" inputMode="decimal" />
            <Field label="Gross premium" value={form.grossPremium} onChange={(e) => update("grossPremium", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" required />
            <Field label="Policy start" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} required />
            <Field label="Policy expiry" type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} required />
          </Section>

          <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_5px_16px_rgba(15,23,42,.04)]">
            <button type="button" onClick={() => setAdditionalOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left sm:px-5">
              <div className="flex items-center gap-3"><NumberBadge value="05" /><div><h2 className="text-[11px] font-semibold text-[#17203A]">Additional policy details</h2><p className="mt-0.5 text-[9px] text-[#7C8798]">Optional information for future reference. It does not affect onboarding completion.</p></div></div>
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#315B9A]">{additionalOpen ? "Collapse" : "Expand"}{additionalOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
            </button>
            {additionalOpen ? <div className="grid gap-3 border-t border-[#E9EDF3] px-4 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-5">
              <Field label="Proposal number" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value)} placeholder="Optional" />
              <Field label="Previous insurer" value={form.previousInsurer} onChange={(e) => update("previousInsurer", e.target.value)} placeholder="Optional" />
              <Field label="Previous policy number" value={form.previousPolicyNumber} onChange={(e) => update("previousPolicyNumber", e.target.value)} placeholder="Optional" />
              <Field label="Previous claims" value={form.previousClaims} onChange={(e) => update("previousClaims", e.target.value)} placeholder="Brief reference" />
              <Field label="Add-ons" value={form.addOns} onChange={(e) => update("addOns", e.target.value)} placeholder="Optional" />
              <Field label="Warranties" value={form.warranties} onChange={(e) => update("warranties", e.target.value)} placeholder="Optional" />
              <Field label="Special conditions" value={form.specialConditions} onChange={(e) => update("specialConditions", e.target.value)} placeholder="Optional" />
              <Field label="Endorsements" value={form.endorsements} onChange={(e) => update("endorsements", e.target.value)} placeholder="Optional" />
              <div className="sm:col-span-2 xl:col-span-4"><Field label="Remarks" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Any servicing note for future reference" /></div>
            </div> : null}
          </section>

          <Section number="06" title="Documents" subtitle="Keep onboarding fast; documents remain managed from the policy record after save.">
            {["Policy Copy", "Proposal Form", "KYC", "Other Document"].map((document) => <div key={document} className="flex h-14 items-center gap-3 rounded-xl border border-dashed border-[#CDD6E3] bg-[#FAFBFD] px-3"><FileText className="h-4 w-4 text-[#315B9A]" /><div><p className="text-[10px] font-semibold text-[#344054]">{document}</p><p className="text-[8.5px] text-[#98A2B3]">Attach from Policy Register after saving</p></div></div>)}
          </Section>
        </div>

        <aside className="xl:sticky xl:top-[82px] xl:self-start">
          <div className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,.06)]">
            <div className="border-b border-[#E8EDF4] px-4 py-3.5"><div className="flex items-center justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#98A2B3]">Policy status</p><h3 className="mt-1 text-[12px] font-semibold text-[#25324B]">Onboarding summary</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-full border-[5px] border-[#E8EEF7] text-[10px] font-bold text-[#315B9A]">{completion}%</div></div><p className="mt-2 text-[8.5px] text-[#98A2B3]">Core fields from Section 02 onward · optional details excluded</p></div>
            <div className="space-y-3 px-4 py-4">
              <SummaryRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Category" value={form.category || "Non Motor"} />
              <SummaryRow icon={<IndianRupee className="h-3.5 w-3.5" />} label="Sum insured / limit" value={Number(form.sumInsured || 0) ? money.format(Number(form.sumInsured)) : "₹0"} />
              <SummaryRow icon={<IndianRupee className="h-3.5 w-3.5" />} label="Gross premium" value={Number(form.grossPremium || 0) ? money.format(Number(form.grossPremium)) : "₹0"} />
              <SummaryRow icon={<MapPin className="h-3.5 w-3.5" />} label="Risk reference" value={riskLocation} />
              <SummaryRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Insurer" value={selectedInsurer} />
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3"><p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#98A2B3]">Policy expiry</p><p className="mt-1 text-[11px] font-semibold text-[#344054]">{form.endDate || "Not entered"}</p></div>
            </div>
          </div>
        </aside>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-medium text-red-700">{error}</div> : null}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DDE4ED] bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,.07)] backdrop-blur lg:left-[268px]"><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#D5DCE7] px-5 py-2.5 text-[10px] font-semibold text-[#475467]">Cancel</Link><button type="button" onClick={submit} disabled={isPending} className="rounded-xl bg-[#123B75] px-6 py-2.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-[#0C315F] disabled:cursor-not-allowed disabled:opacity-60">{isPending ? "Saving..." : "Save Policy"}</button></div></div>
    </div>
  );
}

function RiskFields({ form, update }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  if (!form.category) return <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-dashed border-[#CDD6E3] bg-[#FAFBFD] px-4 py-5 text-center text-[10px] text-[#7C8798]">Select a Non-Motor category to show the relevant risk fields.</div>;
  if (form.category === "Fire & Property" || form.category === "Burglary" || form.category === "Package Policy") return <><Field label="Risk / property description" value={form.riskTitle} onChange={(e) => update("riskTitle", e.target.value)} placeholder="What is insured" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="City / site / address" required /><Field label="Occupancy / property type" value={form.occupancyType} onChange={(e) => update("occupancyType", e.target.value)} placeholder="Warehouse, shop, factory..." required /></>;
  if (form.category === "Marine") return <><Field label="Cargo / interest description" value={form.cargoDescription} onChange={(e) => update("cargoDescription", e.target.value)} placeholder="Goods / cargo" required /><Field label="Transit from" value={form.transitFrom} onChange={(e) => update("transitFrom", e.target.value)} required /><Field label="Transit to" value={form.transitTo} onChange={(e) => update("transitTo", e.target.value)} required /><Select label="Transit mode" value={form.transitMode} onChange={(e) => update("transitMode", e.target.value)} required><option value="">Select mode</option><option>Road</option><option>Rail</option><option>Air</option><option>Sea</option><option>Multimodal</option></Select></>;
  if (form.category === "Engineering") return <><Field label="Project / equipment" value={form.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="Project or equipment name" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} required /><Field label="Project / equipment value" value={form.projectValue} onChange={(e) => update("projectValue", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00" /></>;
  if (form.category === "Liability") return <><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} required /><Field label="Liability type" value={form.liabilityType} onChange={(e) => update("liabilityType", e.target.value)} placeholder="Public / Product / Professional..." required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="Primary location" /></>;
  if (form.category === "Employee Compensation") return <><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} required /><Field label="Employee count" value={form.employeeCount} onChange={(e) => update("employeeCount", e.target.value.replace(/\D/g, ""))} inputMode="numeric" required /><Field label="Estimated annual wages" value={form.annualWages} onChange={(e) => update("annualWages", numeric(e.target.value))} inputMode="decimal" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} /></>;
  if (form.category === "Cyber") return <><Field label="Business name" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} required /><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} required /><Field label="Annual turnover" value={form.annualTurnover} onChange={(e) => update("annualTurnover", numeric(e.target.value))} inputMode="decimal" placeholder="Optional" /></>;
  return <><Field label="Risk description" value={form.riskTitle} onChange={(e) => update("riskTitle", e.target.value)} placeholder="What is insured" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="Primary location / destination" required /></>;
}

function riskCoreValues(form: FormState) {
  if (!form.category) return [""];
  if (["Fire & Property", "Burglary", "Package Policy"].includes(form.category)) return [form.riskTitle, form.riskLocation, form.occupancyType];
  if (form.category === "Marine") return [form.cargoDescription, form.transitFrom, form.transitTo, form.transitMode];
  if (form.category === "Engineering") return [form.projectName, form.riskLocation];
  if (form.category === "Liability") return [form.natureOfBusiness, form.liabilityType];
  if (form.category === "Employee Compensation") return [form.natureOfBusiness, form.employeeCount, form.annualWages];
  if (form.category === "Cyber") return [form.businessName, form.natureOfBusiness];
  return [form.riskTitle, form.riskLocation];
}

function buildRiskPayload(form: FormState): Record<string, string> {
  return { riskTitle: form.riskTitle, riskLocation: form.riskLocation, occupancyType: form.occupancyType, cargoDescription: form.cargoDescription, transitFrom: form.transitFrom, transitTo: form.transitTo, transitMode: form.transitMode, projectName: form.projectName, projectValue: form.projectValue, natureOfBusiness: form.natureOfBusiness, liabilityType: form.liabilityType, employeeCount: form.employeeCount, annualWages: form.annualWages, businessName: form.businessName, annualTurnover: form.annualTurnover };
}

function numeric(value: string) { return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); }
function NumberBadge({ value }: { value: string }) { return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#123B75] text-[9px] font-bold text-white">{value}</span>; }
function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: ReactNode }) { return <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_5px_16px_rgba(15,23,42,.04)]"><div className="flex items-center gap-3 border-b border-[#E9EDF3] px-4 py-3 sm:px-5"><NumberBadge value={number} /><div><h2 className="text-[11px] font-semibold text-[#17203A]">{title}</h2>{subtitle ? <p className="mt-0.5 text-[9px] text-[#7C8798]">{subtitle}</p> : null}</div></div><div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-5">{children}</div></section>; }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) { return <label><span className={labelClass}>{label}{required ? <span className="text-red-500">*</span> : null}</span><input {...props} required={required} className={inputClass} /></label>; }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; children: ReactNode }) { return <label><span className={labelClass}>{label}{required ? <span className="text-red-500">*</span> : null}</span><select {...props} required={required} className={inputClass}>{children}</select></label>; }
function Segmented({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) { return <div><span className={labelClass}>{label}</span><div className="flex h-10 rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] p-1">{options.map((option, index) => <button key={option} type="button" onClick={() => onChange(option)} className={`flex-1 rounded-lg text-[9px] font-semibold transition ${value === option ? "bg-white text-[#123B75] shadow-sm" : "text-[#667085]"}`}>{labels[index]}</button>)}</div></div>; }
function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#315B9A]">{icon}</span><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]">{label}</p><p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#344054]" title={value}>{value}</p></div></div>; }
