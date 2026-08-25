"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Building2, ChevronDown, ChevronUp, FileText, HandCoins, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { createNonMotorPolicy, type NonMotorPolicyPayload } from "@/app/policies/non-motor-policy-actions";

export type NonMotorInsurerOption = { value: string; label: string };
export type NonMotorCustomerOption = { id: string; name: string; contactName: string; phone: string; email: string };

type Props = { insurers: NonMotorInsurerOption[]; customers: NonMotorCustomerOption[] };
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
  insurerPayin: string;
  partnerPayout: string;
};

const CATEGORIES = ["Fire & Property", "Marine", "Engineering", "Liability", "Burglary", "Employee Compensation", "Cyber", "Travel", "Personal Accident", "Package Policy", "Other"];
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const emptyForm: FormState = {
  customerMode: "existing", customerId: "", customerType: "Organisation", insuredName: "", contactName: "", phone: "", email: "", address: "",
  policyNumber: "", insurerId: "", productName: "", category: "", status: "Active",
  riskTitle: "", riskLocation: "", occupancyType: "", cargoDescription: "", transitFrom: "", transitTo: "", transitMode: "", projectName: "", projectValue: "", natureOfBusiness: "", liabilityType: "", employeeCount: "", annualWages: "", businessName: "", annualTurnover: "",
  sumInsured: "", deductible: "", netPremium: "", gstAmount: "", grossPremium: "", startDate: "", endDate: "",
  proposalNumber: "", previousInsurer: "", previousPolicyNumber: "", previousClaims: "", addOns: "", warranties: "", specialConditions: "", endorsements: "", remarks: "", insurerPayin: "", partnerPayout: "",
};

export function NonMotorPolicyForm({ insurers, customers }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const selectedCustomer = customers.find((item) => item.id === form.customerId) ?? null;
  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";

  const required = useMemo(() => {
    const base = [form.customerMode === "existing" ? form.customerId : form.insuredName, form.policyNumber, form.insurerId, form.productName, form.category, form.sumInsured, form.grossPremium, form.startDate, form.endDate];
    const riskRequired = riskCoreValues(form);
    return [...base, ...riskRequired];
  }, [form]);
  const completed = required.filter((value) => String(value ?? "").trim()).length;
  const completion = required.length ? Math.round((completed / required.length) * 100) : 0;

  function changeCustomer(value: string) {
    const customer = customers.find((item) => item.id === value);
    setForm((current) => ({ ...current, customerId: value, insuredName: customer?.name ?? "", contactName: customer?.contactName ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "" }));
  }

  function submit() {
    setError(null);
    const payload: NonMotorPolicyPayload = {
      customerId: form.customerMode === "existing" ? form.customerId : undefined,
      customer: { customerType: form.customerType, insuredName: form.insuredName, contactName: form.contactName, phone: form.phone, email: form.email, address: form.address },
      policy: { policyNumber: form.policyNumber, insurerId: form.insurerId, productName: form.productName, category: form.category, status: form.status, startDate: form.startDate, endDate: form.endDate, sumInsured: form.sumInsured, netPremium: form.netPremium, gstAmount: form.gstAmount, grossPremium: form.grossPremium, deductible: form.deductible },
      risk: buildRiskPayload(form),
      additional: { proposalNumber: form.proposalNumber, previousInsurer: form.previousInsurer, previousPolicyNumber: form.previousPolicyNumber, previousClaims: form.previousClaims, addOns: form.addOns, warranties: form.warranties, specialConditions: form.specialConditions, endorsements: form.endorsements, remarks: form.remarks },
      commercials: { insurerPayin: form.insurerPayin, partnerPayout: form.partnerPayout },
    };
    startTransition(async () => {
      const result = await createNonMotorPolicy(payload);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/policies?success=policy_created&policy=${encodeURIComponent(result.policyCode)}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1480px] pb-24">
      <div className="overflow-hidden rounded-t-xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,.05)]">
        <div className="flex min-h-[52px] items-center justify-between gap-3 bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-4 py-2 text-white sm:px-5">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/65">Policy onboarding</p><h1 className="text-[15px] font-semibold tracking-[-0.01em]">Add Non-Motor Policy</h1></div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.09em]">Broker record</span>
        </div>
      </div>
      <nav className="sticky top-[72px] z-30 mb-3 flex min-h-[36px] items-center gap-5 overflow-x-auto rounded-b-xl border border-t-0 border-[#D9E2F0] bg-white/96 px-4 shadow-[0_5px_14px_rgba(15,23,42,.06)] backdrop-blur">
        {["Customer & Policy", "Risk Details", "Cover & Validity", "Additional Details", "Documents"].map((item, index) => <span key={item} className="flex min-w-fit items-center gap-1.5 py-2 text-[9px] font-semibold text-[#667085]"><span className="text-[8px] font-bold tabular-nums text-[#98A2B3]">{String(index + 1).padStart(2, "0")}</span>{item}</span>)}
      </nav>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-4">
          <Section number="01" title="Customer & policy">
            <div className="sm:col-span-2 xl:col-span-1"><Segmented label="Customer record" value={form.customerMode} options={["existing", "new"]} labels={["Existing", "New"]} onChange={(value) => { update("customerMode", value as CustomerMode); if (value === "new") setForm((current) => ({ ...current, customerMode: "new", customerId: "", insuredName: "", contactName: "", phone: "", email: "" })); }} /></div>
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
            <Field label="Product / policy name" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="e.g. Bharat Sookshma Udyam Suraksha" required />
            <Select label="Non-Motor category" value={form.category} onChange={(e) => update("category", e.target.value)} required><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select>
            <Select label="Policy status" value={form.status} onChange={(e) => update("status", e.target.value)}><option>Active</option><option>Pending</option><option>Expired</option><option>Cancelled</option></Select>
          </Section>

          <Section number="02" title="Risk details" subtitle="Only the key servicing information for the selected Non-Motor category is shown.">
            <RiskFields form={form} update={update} />
          </Section>

          <Section number="03" title="Cover, premium & validity">
            <Field label={form.category === "Liability" ? "Liability limit" : "Sum insured / limit"} value={form.sumInsured} onChange={(e) => update("sumInsured", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" required />
            <Field label="Deductible / excess" value={form.deductible} onChange={(e) => update("deductible", numeric(e.target.value))} placeholder="Optional" inputMode="decimal" />
            <Field label="Net premium" value={form.netPremium} onChange={(e) => update("netPremium", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" />
            <Field label="GST" value={form.gstAmount} onChange={(e) => update("gstAmount", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" />
            <Field label="Gross premium" value={form.grossPremium} onChange={(e) => update("grossPremium", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" required />
            <Field label="Policy start" type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} required />
            <Field label="Policy expiry" type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} required />
          </Section>

          <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_5px_16px_rgba(15,23,42,.04)]">
            <button type="button" onClick={() => setAdditionalOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left sm:px-5">
              <div className="flex items-center gap-3"><NumberBadge value="04" /><div><h2 className="text-[11px] font-semibold text-[#17203A]">Additional policy details</h2><p className="mt-0.5 text-[9px] text-[#7C8798]">Optional information for future reference. It does not affect onboarding completion.</p></div></div>
              <span className="flex items-center gap-1 text-[9px] font-bold text-[#315B9A]">{additionalOpen ? "Collapse" : "Expand"}{additionalOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
            </button>
            {additionalOpen ? <div className="grid gap-3 border-t border-[#E9EDF3] px-4 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-5">
              <Field label="Proposal number" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value)} placeholder="Optional" />
              <Field label="Previous insurer" value={form.previousInsurer} onChange={(e) => update("previousInsurer", e.target.value)} placeholder="Optional" />
              <Field label="Previous policy number" value={form.previousPolicyNumber} onChange={(e) => update("previousPolicyNumber", e.target.value)} placeholder="Optional" />
              <Field label="Previous claims" value={form.previousClaims} onChange={(e) => update("previousClaims", e.target.value)} placeholder="Brief reference" />
              <Field label="Add-ons" value={form.addOns} onChange={(e) => update("addOns", e.target.value)} placeholder="Comma separated" />
              <Field label="Warranties" value={form.warranties} onChange={(e) => update("warranties", e.target.value)} placeholder="Key warranties" />
              <Field label="Special conditions" value={form.specialConditions} onChange={(e) => update("specialConditions", e.target.value)} placeholder="Important conditions" />
              <Field label="Endorsements" value={form.endorsements} onChange={(e) => update("endorsements", e.target.value)} placeholder="Endorsement reference" />
              <div className="sm:col-span-2"><Field label="Remarks" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Internal servicing notes" /></div>
              <Field label="Projected insurer pay-in" value={form.insurerPayin} onChange={(e) => update("insurerPayin", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" />
              <Field label="Projected partner payout" value={form.partnerPayout} onChange={(e) => update("partnerPayout", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" />
            </div> : null}
          </section>

          <Section number="05" title="Documents" subtitle="Keep the policy record compact; supporting files can be attached from the Policy Register after the policy is created.">
            <DocumentCard title="Policy copy" detail="Recommended after saving" />
            <DocumentCard title="Proposal form" detail="Optional" />
            <DocumentCard title="KYC / risk document" detail="Optional" />
            <DocumentCard title="Other document" detail="Optional" />
          </Section>
        </div>

        <aside className="xl:sticky xl:top-[120px] xl:self-start">
          <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">
            <div className="border-b border-[#E6EBF2] px-4 py-4"><div className="flex items-start justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#7C8798]">Policy status</p><h3 className="mt-1 text-[12px] font-semibold text-[#17365D]">Onboarding summary</h3></div><div className="grid h-12 w-12 place-items-center rounded-full border-[5px] border-[#DDE7F5] text-[9px] font-bold text-[#17365D]">{completion}%</div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EEF2F7]"><div className="h-full rounded-full bg-[#315B9A] transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-[8.5px] text-[#7C8798]">{completed} of {required.length} core items complete · additional details optional</p></div>
            <div className="space-y-3 px-4 py-4"><SummaryRow icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Category" value={form.category || "Not selected"} /><SummaryRow icon={<IndianRupee className="h-3.5 w-3.5" />} label="Sum insured / limit" value={currency(form.sumInsured)} /><SummaryRow icon={<HandCoins className="h-3.5 w-3.5" />} label="Gross premium" value={currency(form.grossPremium)} /><SummaryRow icon={<MapPin className="h-3.5 w-3.5" />} label="Risk / location" value={summaryRisk(form)} /><SummaryRow icon={<Building2 className="h-3.5 w-3.5" />} label="Insurer" value={selectedInsurer} /><SummaryRow icon={<FileText className="h-3.5 w-3.5" />} label="Expiry" value={form.endDate || "Not entered"} /></div>
            <div className="border-t border-[#E6EBF2] px-4 py-4"><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#7C8798]">Pay-in / payout</p><div className="mt-2 grid gap-2"><CommercialMini title="Insurer Pay-in" value={form.insurerPayin} /><CommercialMini title="Partner Payout" value={form.partnerPayout} /></div></div>
          </div>
        </aside>
      </div>

      {error ? <div className="fixed bottom-20 left-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 rounded-xl border border-red-200 bg-white px-4 py-3 shadow-2xl"><p className="text-[10px] font-semibold text-red-700">{error}</p></div> : null}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold text-[#344054]">Cancel</Link><button type="button" onClick={submit} disabled={isPending} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white transition hover:bg-[#214A7A] disabled:opacity-60">{isPending ? "Saving policy…" : "Upload Policy"}</button></div></div>
    </div>
  );
}

function RiskFields({ form, update }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  if (!form.category) return <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-5 text-[10px] text-[#667085]">Select a Non-Motor category above to show the relevant risk fields.</div>;
  if (form.category === "Fire & Property" || form.category === "Burglary" || form.category === "Package Policy") return <><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="Primary insured location" required /><Field label="Property / occupancy type" value={form.occupancyType} onChange={(e) => update("occupancyType", e.target.value)} placeholder="Factory, warehouse, office…" required /><Field label="Risk description" value={form.riskTitle} onChange={(e) => update("riskTitle", e.target.value)} placeholder="Brief property / stock description" /></>;
  if (form.category === "Marine") return <><Field label="Cargo / interest description" value={form.cargoDescription} onChange={(e) => update("cargoDescription", e.target.value)} placeholder="Goods / cargo insured" required /><Field label="Transit from" value={form.transitFrom} onChange={(e) => update("transitFrom", e.target.value)} placeholder="Origin" required /><Field label="Transit to" value={form.transitTo} onChange={(e) => update("transitTo", e.target.value)} placeholder="Destination" required /><Select label="Transit mode" value={form.transitMode} onChange={(e) => update("transitMode", e.target.value)} required><option value="">Select mode</option><option>Road</option><option>Rail</option><option>Air</option><option>Sea</option><option>Multimodal</option></Select></>;
  if (form.category === "Engineering") return <><Field label="Project / equipment name" value={form.projectName} onChange={(e) => update("projectName", e.target.value)} placeholder="Project or equipment" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="Project / equipment location" required /><Field label="Project / equipment value" value={form.projectValue} onChange={(e) => update("projectValue", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" /></>;
  if (form.category === "Liability") return <><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} placeholder="Business activity" required /><Select label="Liability type" value={form.liabilityType} onChange={(e) => update("liabilityType", e.target.value)} required><option value="">Select liability type</option><option>Public Liability</option><option>Product Liability</option><option>Professional Indemnity</option><option>Directors & Officers</option><option>Commercial General Liability</option><option>Other</option></Select></>;
  if (form.category === "Employee Compensation") return <><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} placeholder="Business activity" required /><Field label="Employee count" value={form.employeeCount} onChange={(e) => update("employeeCount", digits(e.target.value))} placeholder="0" inputMode="numeric" required /><Field label="Estimated annual wages" value={form.annualWages} onChange={(e) => update("annualWages", numeric(e.target.value))} placeholder="₹ 0.00" inputMode="decimal" /></>;
  if (form.category === "Cyber") return <><Field label="Business name" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} placeholder="Insured business" required /><Field label="Nature of business" value={form.natureOfBusiness} onChange={(e) => update("natureOfBusiness", e.target.value)} placeholder="Industry / activity" required /><Field label="Annual turnover" value={form.annualTurnover} onChange={(e) => update("annualTurnover", numeric(e.target.value))} placeholder="Optional" inputMode="decimal" /></>;
  return <><Field label="Risk / interest description" value={form.riskTitle} onChange={(e) => update("riskTitle", e.target.value)} placeholder="What is insured?" required /><Field label="Risk location" value={form.riskLocation} onChange={(e) => update("riskLocation", e.target.value)} placeholder="Location, if applicable" /></>;
}

function buildRiskPayload(form: FormState): Record<string, string> { return { riskTitle: form.riskTitle, riskLocation: form.riskLocation, occupancyType: form.occupancyType, cargoDescription: form.cargoDescription, transitFrom: form.transitFrom, transitTo: form.transitTo, transitMode: form.transitMode, projectName: form.projectName, projectValue: form.projectValue, natureOfBusiness: form.natureOfBusiness, liabilityType: form.liabilityType, employeeCount: form.employeeCount, annualWages: form.annualWages, businessName: form.businessName, annualTurnover: form.annualTurnover }; }
function riskCoreValues(form: FormState) { if (["Fire & Property", "Burglary", "Package Policy"].includes(form.category)) return [form.riskLocation, form.occupancyType]; if (form.category === "Marine") return [form.cargoDescription, form.transitFrom, form.transitTo, form.transitMode]; if (form.category === "Engineering") return [form.projectName, form.riskLocation]; if (form.category === "Liability") return [form.natureOfBusiness, form.liabilityType]; if (form.category === "Employee Compensation") return [form.natureOfBusiness, form.employeeCount]; if (form.category === "Cyber") return [form.businessName, form.natureOfBusiness]; return form.category ? [form.riskTitle] : []; }
function summaryRisk(form: FormState) { return form.riskLocation || form.cargoDescription || form.projectName || form.natureOfBusiness || form.riskTitle || "Not entered"; }
function numeric(value: string) { return value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); }
function digits(value: string) { return value.replace(/\D/g, ""); }
function currency(value: string) { const parsed = Number(value || 0); return value && Number.isFinite(parsed) ? money.format(parsed) : "₹0.00"; }

function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: ReactNode }) { return <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_5px_16px_rgba(15,23,42,.04)]"><div className="flex items-center gap-3 border-b border-[#E9EDF3] px-4 py-3 sm:px-5"><NumberBadge value={number} /><div><h2 className="text-[11px] font-semibold text-[#17203A]">{title}</h2>{subtitle ? <p className="mt-0.5 text-[9px] text-[#7C8798]">{subtitle}</p> : null}</div></div><div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-5">{children}</div></section>; }
function NumberBadge({ value }: { value: string }) { return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{value}</span>; }
function Required() { return <span className="text-red-500">*</span>; }
function Field({ label, required, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <div className={className}><label className={labelClass}>{label}{required ? <Required /> : null}</label><input {...props} required={required} className={inputClass} /></div>; }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}</label><select {...props} required={required} className={inputClass}>{children}</select></div>; }
function Segmented({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) { return <div><label className={labelClass}>{label}</label><div className="flex h-10 rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] p-1">{options.map((option, index) => <button key={option} type="button" onClick={() => onChange(option)} className={`flex-1 rounded-lg text-[9px] font-bold transition ${value === option ? "bg-white text-[#17365D] shadow-sm" : "text-[#7C8798]"}`}>{labels[index]}</button>)}</div></div>; }
function SummaryRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F1F5FA] text-[#315B9A]">{icon}</span><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#8A94A4]">{label}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#26324A]" title={value}>{value}</p></div></div>; }
function CommercialMini({ title, value }: { title: string; value: string }) { return <div className="flex items-center justify-between rounded-xl border border-[#E1E7EF] bg-[#FAFBFD] px-3 py-2.5"><span className="text-[9px] font-semibold text-[#475467]">{title}</span><span className="text-[9px] font-bold text-[#17365D]">{value ? currency(value) : "Not entered"}</span></div>; }
function DocumentCard({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-[#E1E7EF] bg-[#FAFBFD] px-3 py-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#315B9A] shadow-sm"><FileText className="h-3.5 w-3.5" /></span><div><p className="text-[9.5px] font-semibold text-[#344054]">{title}</p><p className="mt-0.5 text-[8px] text-[#98A2B3]">{detail}</p></div></div></div>; }
