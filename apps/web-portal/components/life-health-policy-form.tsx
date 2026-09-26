"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, IndianRupee, Upload } from "lucide-react";
import { createLifeHealthCase } from "@/app/policies/life-health-policy-actions";
import { CustomerSearchField } from "@/components/customer-search-field";

export type LifeHealthSourceOption = {
  type: "POSP" | "MISP" | "SIBL / Partner";
  value: string;
  label: string;
  code: string;
  rmName: string;
  rmCode: string;
  mobile?: string;
};

export type LifeHealthCustomerOption = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
};

type Props = {
  policyType: "Life" | "Health";
  insurers: Array<{ label: string; value: string }>;
  customers: LifeHealthCustomerOption[];
  sources: LifeHealthSourceOption[];
};

type CustomerMode = "new" | "existing";
type State = {
  customerMode: CustomerMode;
  customerId: string;
  insuredName: string;
  phone: string;
  email: string;
  insurerId: string;
  productName: string;
  proposalNumber: string;
  ppt: string;
  pd: string;
  paymentFrequency: string;
  premiumAmount: string;
  paymentMode: string;
  remarks: string;
};

type SourceSnapshot = {
  sourcingDate: string;
  intermediaryType: string;
  sourceId: string;
  leadSource: string;
  intermediaryCode: string;
  rmName: string;
  rmCode: string;
};

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"];
const PAYMENT_MODES = ["Cash", "Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function sourceSnapshot(sources: LifeHealthSourceOption[]): SourceSnapshot {
  const controls = Array.from(document.querySelectorAll("label"));
  const control = (label: string) => {
    const found = controls.find((item) => item.textContent?.trim().toLowerCase().startsWith(label.toLowerCase()));
    return found?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null;
  };
  const sourcingDate = control("Policy issuance date")?.value.trim() ?? "";
  const intermediaryType = control("Intermediary type")?.value.trim() ?? "";
  const leadSourceControl = control("Lead source") as HTMLSelectElement | null;
  const sourceId = leadSourceControl?.value.trim() ?? "";
  const selected = sources.find((item) => item.value === sourceId);
  return {
    sourcingDate,
    intermediaryType,
    sourceId,
    leadSource: selected?.label ?? "",
    intermediaryCode: selected?.code ?? "",
    rmName: selected?.rmName ?? "",
    rmCode: selected?.rmCode ?? "",
  };
}

export function LifeHealthPolicyForm({ policyType, insurers, customers, sources }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<State>({
    customerMode: "new", customerId: "", insuredName: "", phone: "", email: "",
    insurerId: "", productName: "", proposalNumber: "", ppt: "", pd: "", paymentFrequency: "",
    premiumAmount: "", paymentMode: "", remarks: "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({ proposalForm: null, benefitIllustration: null, premiumReceipt: null });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const update = <K extends keyof State>(key: K, value: State[K]) => setForm((current) => ({ ...current, [key]: value }));
  const customerOptions = useMemo(() => customers.map((item) => ({ value: item.id, label: `${item.name}${item.phone ? ` · ${item.phone}` : ""}` })), [customers]);
  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";
  const documentCount = Object.values(files).filter(Boolean).length;
  const required = [form.customerMode === "existing" ? form.customerId : form.insuredName, form.customerMode === "existing" ? "existing" : form.phone, form.insurerId, form.productName, form.proposalNumber, form.paymentFrequency, form.premiumAmount, form.paymentMode];
  const completion = Math.round((required.filter((value) => String(value).trim()).length / required.length) * 80 + (documentCount / 3) * 20);

  function chooseCustomer(id: string) {
    const selected = customers.find((item) => item.id === id);
    setForm((current) => ({ ...current, customerId: id, insuredName: selected?.name ?? "", phone: selected?.phone ?? "", email: selected?.email ?? "" }));
  }

  function submit() {
    setError(null);
    const source = sourceSnapshot(sources);
    const data = new FormData();
    data.set("businessLine", policyType);
    Object.entries(source).forEach(([key, value]) => data.set(key, value));
    Object.entries(form).forEach(([key, value]) => data.set(key, value));
    for (const [key, file] of Object.entries(files)) if (file) data.set(key, file);
    startTransition(async () => {
      const result = await createLifeHealthCase(data);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/policies/life-health-cases/${result.caseId}?created=1`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="space-y-4">
        <Section number="02" title="Customer / proposer" subtitle="New customer is the default for Life and Health; switch to Existing when the customer is already in INSUREIT.">
          <Segmented value={form.customerMode} onChange={(value) => setForm((current) => ({ ...current, customerMode: value, customerId: value === "new" ? "" : current.customerId }))} />
          {form.customerMode === "existing" ? (
            <div className="md:col-span-1 xl:col-span-3"><CustomerSearchField label="Customer / proposer" name="life_health_customer_id" options={customerOptions} defaultValue={form.customerId} required portalResults onSelectionChange={chooseCustomer} /></div>
          ) : (
            <>
              <Field label="Client / proposer name" value={form.insuredName} onChange={(event) => update("insuredName", event.target.value)} placeholder="Name on proposal" required />
              <Field label="Client mobile number" value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10 digit mobile" required />
              <Field label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" placeholder="Optional" />
            </>
          )}
        </Section>

        <Section number="03" title="Case & product" subtitle={`${policyType} case details from the RM Case Mapping Tracker.`}>
          <Select label="Insurance company" value={form.insurerId} onChange={(event) => update("insurerId", event.target.value)} required><option value="">Select insurer</option>{insurers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
          <Field label="Product name" value={form.productName} onChange={(event) => update("productName", event.target.value)} placeholder="Product / plan name" required />
          <Field label="Case / proposal number" value={form.proposalNumber} onChange={(event) => update("proposalNumber", event.target.value.toUpperCase())} placeholder="Proposal number" required />
          <Field label="PPT · Premium Paying Term" value={form.ppt} onChange={(event) => update("ppt", event.target.value)} placeholder="e.g. 10 Years / Single Pay" />
          <Field label="PD · Policy Duration / Term" value={form.pd} onChange={(event) => update("pd", event.target.value)} placeholder="e.g. 20 Years / 1 Year" />
          <Select label="Payment frequency" value={form.paymentFrequency} onChange={(event) => update("paymentFrequency", event.target.value)} required><option value="">Select frequency</option>{PAYMENT_FREQUENCIES.map((item) => <option key={item}>{item}</option>)}</Select>
        </Section>

        <Section number="04" title="Premium & payment">
          <Field label="Premium amount" value={form.premiumAmount} onChange={(event) => update("premiumAmount", numeric(event.target.value))} inputMode="decimal" placeholder="₹ 0.00" required />
          <Select label="Payment mode" value={form.paymentMode} onChange={(event) => update("paymentMode", event.target.value)} required><option value="">Select payment mode</option>{PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}</Select>
          <div className="xl:col-span-2"><label className={labelClass}>Remarks</label><textarea value={form.remarks} onChange={(event) => update("remarks", event.target.value)} rows={3} placeholder="Optional servicing / underwriting note" className="w-full resize-none rounded-xl border border-[#D8DEE9] bg-white px-3 py-2.5 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></div>
        </Section>

        <Section number="05" title="Documents" subtitle="The Y/N tracker values are derived automatically from actual uploads — no separate Y/N entry is required.">
          <DocumentTile label="Proposal Form" file={files.proposalForm} onChange={(file) => setFiles((current) => ({ ...current, proposalForm: file }))} />
          <DocumentTile label="Benefit Illustration" file={files.benefitIllustration} onChange={(file) => setFiles((current) => ({ ...current, benefitIllustration: file }))} />
          <DocumentTile label="Premium Receipt" file={files.premiumReceipt} onChange={(file) => setFiles((current) => ({ ...current, premiumReceipt: file }))} />
          <div className="flex min-h-[86px] items-center rounded-xl border border-dashed border-[#CBD7E6] bg-[#F8FAFD] px-3 text-[9px] leading-4 text-[#667085]">Policy Copy is intentionally collected later when the insurer issues the policy and the case is converted to a real policy.</div>
        </Section>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</div> : null}
        <div className="flex justify-end gap-2 pb-4"><Link href="/policies/life-health-cases" className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#475467]">View Cases</Link><button type="button" onClick={submit} disabled={isPending} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#214A7A] disabled:opacity-60">{isPending ? "Creating case…" : "Create Case"}</button></div>
      </div>

      <aside className="self-start overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.08)] xl:sticky xl:top-[150px]">
        <div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">{policyType} case</p><h3 className="mt-0.5 text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><div className="grid h-12 w-12 place-items-center rounded-full border-[5px] border-[#E4EAF2] text-[9px] font-bold text-[#17365D]">{completion}%</div><span className="rounded-full bg-[#FFF3CD] px-2.5 py-1 text-[8px] font-bold text-[#A96A00]">Awaiting policy</span></div>
        <div className="space-y-4 px-4 py-4">
          <SummaryBlock title="Case" rows={[["Proposal", form.proposalNumber || "Not entered"], ["Insurer", selectedInsurer], ["Product", form.productName || "Not entered"]]} />
          <SummaryBlock title="Customer" rows={[["Name", form.insuredName || "Not selected"], ["Mobile", form.phone || "—"]]} />
          <div><div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><IndianRupee className="h-3.5 w-3.5" /></span><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Premium</p></div><p className="text-[17px] font-bold text-[#17365D]">{money.format(Number(form.premiumAmount || 0))}</p><p className="mt-1 text-[9px] text-[#667085]">{form.paymentFrequency || "Frequency pending"} · {form.paymentMode || "Mode pending"}</p></div>
          <div className="rounded-xl border border-[#DCE6F1] bg-[#F8FBFE] px-3 py-3"><div className="flex items-center justify-between"><span className="text-[9px] font-bold text-[#17365D]">Documents</span><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${documentCount === 3 ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#F1F4F8] text-[#667085]"}`}>{documentCount} / 3 uploaded</span></div><p className="mt-1 text-[8.5px] leading-4 text-[#667085]">Proposal Form, Benefit Illustration and Premium Receipt remain linked to the case and are reused when the final policy is created.</p></div>
        </div>
      </aside>
    </div>
  );
}

function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: ReactNode }) {
  return <section id={`policy-section-${number}`} className="scroll-mt-[148px] overflow-visible rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-12 items-center border-b bg-[#FBFCFE] px-4 py-2.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold leading-tight">{title}</h2>{subtitle ? <p className="mt-0.5 text-[9px] leading-tight text-[#667085]">{subtitle}</p> : null}</div></div></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}
function Required() { return <span className="text-red-500">*</span>; }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}</label><input {...props} required={required} className={inputClass} /></div>; }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}</label><select {...props} required={required} className={inputClass}>{children}</select></div>; }
function Segmented({ value, onChange }: { value: CustomerMode; onChange: (value: CustomerMode) => void }) { return <div><label className={labelClass}>Customer record</label><div className="inline-flex h-10 w-full rounded-xl border border-[#D8DEE9] bg-[#F7F9FC] p-1"><button type="button" onClick={() => onChange("new")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "new" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>New</button><button type="button" onClick={() => onChange("existing")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "existing" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>Existing</button></div></div>; }
function DocumentTile({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) { const id = `lh-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; return <div className={`min-h-[86px] rounded-xl border px-3 py-3 ${file ? "border-emerald-200 bg-emerald-50/40" : "border-[#D8E1EC] bg-white"}`}><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-lg ${file ? "bg-emerald-100 text-emerald-700" : "bg-[#EEF4FB] text-[#315B9A]"}`}>{file ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-bold text-[#17365D]">{label}</p><p className="truncate text-[8px] text-[#667085]">{file ? file.name : "Not uploaded"}</p></div><label htmlFor={id} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#CAD7E7] bg-white px-2 py-1.5 text-[8px] font-bold text-[#315B9A]"><Upload className="h-3 w-3" />{file ? "Replace" : "Upload"}</label><input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div></div>; }
function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div><p className="mb-1.5 text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">{title}</p><div className="divide-y divide-[#E8EDF3]">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 py-2 text-[9.5px]"><span className="text-[#667085]">{label}</span><span className="max-w-[190px] truncate text-right font-semibold text-[#17365D]" title={value}>{value}</span></div>)}</div></div>; }
function numeric(value: string) { const normalized = value.replace(/[^0-9.]/g, ""); const parts = normalized.split("."); return parts.length > 2 ? `${parts.shift()}.${parts.join("")}` : normalized; }
