"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, IndianRupee, Upload } from "lucide-react";
import { createLifeHealthCase } from "@/app/policies/life-health-policy-actions";
import { CustomerSearchField } from "@/components/customer-search-field";

export type LifeHealthSourceOption = { type: "POSP" | "MISP" | "SIBL / Partner"; value: string; label: string; code: string; rmName: string; rmCode: string; mobile?: string };
export type LifeHealthCustomerOption = { id: string; name: string; contactName: string; phone: string; email: string };
type Props = { policyType: "Life" | "Health"; insurers: Array<{ label: string; value: string }>; customers: LifeHealthCustomerOption[]; sources: LifeHealthSourceOption[]; sourceSection?: ReactNode };
type CustomerMode = "new" | "existing";
type State = { customerMode: CustomerMode; customerId: string; insuredName: string; phone: string; email: string; insurerId: string; productName: string; proposalNumber: string; ppt: string; pd: string; paymentFrequency: string; premiumAmount: string; paymentMode: string; remarks: string };
type SourceSnapshot = { sourcingDate: string; intermediaryType: string; sourceId: string; leadSource: string; intermediaryCode: string; rmName: string; rmCode: string };

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"];
const PAYMENT_MODES = ["Cash", "Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"];
const YEAR_OPTIONS = Array.from({ length: 50 }, (_, index) => `${index + 1} Year${index === 0 ? "" : "s"}`);
const LIFE_HEALTH_SECTIONS = ["Source", "Customer / Proposer", "Policy Product & Case", "Premium & Payment"];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function sourceSnapshot(sources: LifeHealthSourceOption[]): SourceSnapshot {
  const controls = Array.from(document.querySelectorAll("label"));
  const control = (label: string) => { const found = controls.find((item) => item.textContent?.trim().toLowerCase().startsWith(label.toLowerCase())); return found?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null };
  const sourcingDate = control("Policy issuance date")?.value.trim() ?? "";
  const intermediaryType = control("Intermediary type")?.value.trim() ?? "";
  const leadSourceControl = control("Lead source") as HTMLSelectElement | null;
  const sourceId = leadSourceControl?.value.trim() ?? "";
  const selected = sources.find((item) => item.value === sourceId);
  return { sourcingDate, intermediaryType, sourceId, leadSource: selected?.label ?? "", intermediaryCode: selected?.code ?? "", rmName: selected?.rmName ?? "", rmCode: selected?.rmCode ?? "" };
}

function firstValidationError(source: SourceSnapshot, form: State) {
  const requiredFields: Array<[string, string]> = [["Policy Issuance Date", source.sourcingDate], ["Intermediary Type", source.intermediaryType], ["Lead Source", source.sourceId], [form.customerMode === "existing" ? "Customer / Proposer" : "Client / Proposer Name", form.customerMode === "existing" ? form.customerId : form.insuredName], ...(form.customerMode === "new" ? [["Client Mobile Number", form.phone] as [string, string]] : []), ["Insurance Company", form.insurerId], ["Product Name", form.productName], ["Case / Proposal Number", form.proposalNumber], ["Payment Frequency", form.paymentFrequency], ["Premium Amount", form.premiumAmount], ["Payment Mode", form.paymentMode]];
  const missing = requiredFields.find(([, value]) => !String(value).trim());
  if (missing) return `${missing[0]} is required.`;
  if (form.customerMode === "new" && !/^\d{10}$/.test(form.phone)) return "Client Mobile Number must be 10 digits.";
  return null;
}

export function LifeHealthPolicyForm({ policyType, insurers, customers, sources, sourceSection }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<State>({ customerMode: "new", customerId: "", insuredName: "", phone: "", email: "", insurerId: "", productName: "", proposalNumber: "", ppt: "", pd: "", paymentFrequency: "", premiumAmount: "", paymentMode: "", remarks: "" });
  const [files, setFiles] = useState<Record<string, File | null>>({ proposalForm: null, benefitIllustration: null, premiumReceipt: null, policyCopy: null, kyc: null, otherDocument: null });
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [isPending, startTransition] = useTransition();
  const update = <K extends keyof State>(key: K, value: State[K]) => setForm((current) => ({ ...current, [key]: value }));
  const customerOptions = useMemo(() => customers.map((item) => ({ value: item.id, label: `${item.name}${item.phone ? ` · ${item.phone}` : ""}` })), [customers]);
  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";
  const documentKeys = ["policyCopy", "proposalForm", "kyc", "otherDocument"];
  const documentCount = documentKeys.filter((key) => Boolean(files[key])).length;
  const documentTarget = documentKeys.length;
  const required = [form.customerMode === "existing" ? form.customerId : form.insuredName, form.customerMode === "existing" ? "existing" : form.phone, form.insurerId, form.productName, form.proposalNumber, form.paymentFrequency, form.premiumAmount, form.paymentMode];
  const completion = Math.round((required.filter((value) => String(value).trim()).length / required.length) * 80 + (documentCount / documentTarget) * 20);

  function chooseCustomer(id: string) { const selected = customers.find((item) => item.id === id); setForm((current) => ({ ...current, customerId: id, insuredName: selected?.name ?? "", phone: selected?.phone ?? "", email: selected?.email ?? "" })) }
  function goToSection(index: number) { setActiveSection(index); document.getElementById(`policy-section-${index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function submit() {
    setError(null);
    const source = sourceSnapshot(sources);
    const validationError = firstValidationError(source, form);
    if (validationError) { setError(validationError); return; }
    const data = new FormData();
    data.set("businessLine", policyType);
    Object.entries(source).forEach(([key, value]) => data.set(key, value));
    Object.entries(form).forEach(([key, value]) => data.set(key, value));
    for (const [key, file] of Object.entries(files)) if (file) data.set(key, file);
    startTransition(async () => {
      try {
        const result = await createLifeHealthCase(data);
        if (!result.ok) { setError(result.error || "The policy could not be saved. Please review the details and try again."); return; }
        router.push(`/policies/life-health-cases/${result.caseId}?created=1`);
        router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "The policy could not be saved. Please review the details and try again."); }
    });
  }

  const summary = <FollowSummary completion={completion} proposal={form.proposalNumber} insurer={selectedInsurer} product={form.productName} customer={form.insuredName} mobile={form.phone} premium={form.premiumAmount} frequency={form.paymentFrequency} paymentMode={form.paymentMode} documentCount={documentCount} documentTarget={documentTarget} />;
  const documents = <div className="flex flex-1 flex-wrap items-center gap-2"><CompactDocumentUpload label="Add Policy Copy" file={files.policyCopy} onChange={(file) => setFiles((c) => ({ ...c, policyCopy: file }))} /><CompactDocumentUpload label="Add Proposal Form" file={files.proposalForm} onChange={(file) => setFiles((c) => ({ ...c, proposalForm: file }))} /><CompactDocumentUpload label="Add KYC" file={files.kyc} onChange={(file) => setFiles((c) => ({ ...c, kyc: file }))} /><CompactDocumentUpload label="Add Other Document" file={files.otherDocument} onChange={(file) => setFiles((c) => ({ ...c, otherDocument: file }))} /></div>;
  const bottomSection = <section className="w-full rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex flex-col gap-3 p-3 xl:flex-row xl:items-center xl:justify-between">{documents}<div className="flex shrink-0 justify-end gap-2"><Link href="/policies/life-health-cases" className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] px-4 text-[10px] font-semibold text-[#344054]">View Cases</Link><button type="button" onClick={submit} disabled={isPending} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white disabled:opacity-60">{isPending ? "Creating case…" : "Create Case"}</button></div></div></section>;

  return <>
    <nav aria-label="Life and Health policy sections" className="sticky top-[72px] z-50 mb-3 flex min-h-[36px] items-stretch gap-4 overflow-x-auto rounded-b-xl border border-t-0 border-[#D9E2F0] bg-white/96 px-4 shadow-[0_5px_14px_rgba(15,23,42,.06)] backdrop-blur">
      {LIFE_HEALTH_SECTIONS.map((section, index) => <button key={section} type="button" onClick={() => goToSection(index)} aria-current={activeSection === index ? "step" : undefined} className={`group relative flex min-w-fit items-center gap-1.5 border-b-2 px-0.5 py-2 text-[9px] font-semibold transition ${activeSection === index ? "border-[#4F46E5] text-[#3346B8]" : "border-transparent text-[#667085] hover:border-[#CBD5E1] hover:text-[#344054]"}`}><span className={`text-[8px] font-bold tabular-nums ${activeSection === index ? "text-[#4F46E5]" : "text-[#98A2B3]"}`}>{String(index + 1).padStart(2, "0")}</span><span>{section}</span></button>)}
    </nav>
    <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="min-w-0 space-y-3">
        {sourceSection}
        <Section number="02" title="Customer / proposer" contentClassName="md:grid-cols-2 xl:grid-cols-4"><Segmented value={form.customerMode} onChange={(value) => setForm((current) => ({ ...current, customerMode: value, customerId: value === "new" ? "" : current.customerId }))} />{form.customerMode === "existing" ? <div className="md:col-span-1 xl:col-span-3"><CustomerSearchField label="Customer / proposer" name="life_health_customer_id" options={customerOptions} defaultValue={form.customerId} required portalResults onSelectionChange={chooseCustomer} /></div> : <><Field label="Client / proposer name" value={form.insuredName} onChange={(e) => update("insuredName", e.target.value)} placeholder="Name on proposal" required /><Field label="Client mobile number" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10 digit mobile" required /><Field label="Email" value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="Optional" /></>}</Section>
        <Section number="03" title="Policy product & case details" contentClassName="md:grid-cols-2 xl:grid-cols-3"><Select label="Insurance company" value={form.insurerId} onChange={(e) => update("insurerId", e.target.value)} required><option value="">Select insurer</option>{insurers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><Field label="Product name" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Product / plan name" required /><Field label="Case / proposal number" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value.toUpperCase())} placeholder="Proposal number" required /><Select label="PPT · Premium Paying Term" value={form.ppt} onChange={(e) => update("ppt", e.target.value)}><option value="">Select term</option><option value="Single Pay">Single Pay</option>{YEAR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</Select><Select label="PD · Policy Duration / Term" value={form.pd} onChange={(e) => update("pd", e.target.value)}><option value="">Select term</option>{YEAR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</Select><Select label="Payment frequency" value={form.paymentFrequency} onChange={(e) => update("paymentFrequency", e.target.value)} required><option value="">Select frequency</option>{PAYMENT_FREQUENCIES.map((item) => <option key={item}>{item}</option>)}</Select></Section>
        <Section number="04" title="Premium & payment" contentClassName="md:grid-cols-2 xl:grid-cols-3"><Field label="Premium amount" value={form.premiumAmount} onChange={(e) => update("premiumAmount", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00" required /><Select label="Payment mode" value={form.paymentMode} onChange={(e) => update("paymentMode", e.target.value)} required><option value="">Select payment mode</option>{PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}</Select><div><label className={labelClass}>Remarks</label><textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} rows={1} placeholder="Optional servicing / underwriting note" className="h-10 w-full resize-none rounded-xl border border-[#D8DEE9] bg-white px-3 py-2.5 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></div></Section>
      </div>
      <div className="min-w-0 self-start xl:sticky xl:top-[124px]">{summary}</div>
    </div>
    <div className="mt-3 w-full">{bottomSection}</div>
    {error ? <ErrorModal message={error} onClose={() => setError(null)} /> : null}
  </>;
}

function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) { return <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#17365D]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="policy-error-title"><div className="w-full max-w-[505px] overflow-hidden rounded-[20px] bg-white shadow-2xl"><div className="flex flex-col items-center px-7 pb-7 pt-7 text-center"><span className="grid h-14 w-14 place-items-center rounded-full bg-[#FFF3E8] text-[25px] font-semibold leading-none text-[#E66A19]">!</span><h3 id="policy-error-title" className="mt-5 text-[18px] font-bold text-[#102A4C]">Check details</h3><p className="mt-3 text-[13px] leading-5 text-[#7A869A]">{message}</p></div><div className="border-t border-[#DDE4EC] p-4"><button type="button" onClick={onClose} className="h-12 w-full rounded-xl bg-[#173F6D] text-[13px] font-bold text-white transition hover:bg-[#12355E]">OK</button></div></div></div> }
function FollowSummary({ completion, proposal, insurer, product, customer, mobile, premium, frequency, paymentMode, documentCount, documentTarget }: { completion: number; proposal: string; insurer: string; product: string; customer: string; mobile: string; premium: string; frequency: string; paymentMode: string; documentCount: number; documentTarget: number }) { return <aside className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">Policy status</p><h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><CompletionRing value={completion}/><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${completion >= 100 ? "bg-[#E8F7EF] text-[#14845B]" : "bg-[#FFF3CD] text-[#A96A00]"}`}>{completion >= 100 ? "Complete" : "In progress"}</span></div><div className="space-y-3 px-4 py-3"><SummaryBlock title="Case" rows={[["Proposal", proposal || "Not entered"], ["Insurer", insurer], ["Product", product || "Not entered"]]} /><SummaryBlock title="Customer" rows={[["Name", customer || "Not selected"], ["Mobile", mobile || "—"]]} /><div><div className="mb-1.5 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><IndianRupee className="h-3.5 w-3.5" /></span><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Premium</p></div><p className="text-[17px] font-bold text-[#17365D]">{money.format(Number(premium || 0))}</p><p className="mt-1 text-[9px] text-[#667085]">{frequency || "Frequency pending"} · {paymentMode || "Mode pending"}</p></div><div className="rounded-xl border border-[#DCE6F1] bg-[#F8FBFE] px-3 py-2.5"><div className="flex items-center justify-between"><span className="text-[9px] font-bold text-[#17365D]">Documents</span><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${documentCount === documentTarget ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#F1F4F8] text-[#667085]"}`}>{documentCount} / {documentTarget} uploaded</span></div></div></div></aside> }
function CompletionRing({ value }: { value: number }) { const clamped = Math.max(0, Math.min(100, value)); const radius = 19, circumference = 2 * Math.PI * radius, offset = circumference - (clamped / 100) * circumference; return <div className="relative h-12 w-12 shrink-0"><svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90"><circle cx="24" cy="24" r={radius} fill="none" stroke="#E3EAF2" strokeWidth="5"/><circle cx="24" cy="24" r={radius} fill="none" stroke="#315B9A" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}/></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#17365D]">{clamped}%</span></div> }
function Section({ number, title, children, contentClassName = "md:grid-cols-2 xl:grid-cols-4" }: { number: string; title: string; children: ReactNode; contentClassName?: string }) { return <section id={`policy-section-${number}`} className="scroll-mt-[148px] overflow-visible rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-11 items-center border-b bg-[#FBFCFE] px-4 py-2"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[12px] font-semibold leading-tight">{title}</h2></div></div><div className={`grid gap-3 p-3 ${contentClassName}`}>{children}</div></section> }
function Required() { return <span className="text-red-500">*</span> }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <div><label className={labelClass}>{label}{required ? <Required/> : null}</label><input {...props} required={required} className={inputClass}/></div> }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <div><label className={labelClass}>{label}{required ? <Required/> : null}</label><select {...props} required={required} className={inputClass}>{children}</select></div> }
function Segmented({ value, onChange }: { value: CustomerMode; onChange: (value: CustomerMode) => void }) { return <div><label className={labelClass}>Customer record</label><div className="inline-flex h-10 w-full rounded-xl border border-[#D8DEE9] bg-[#F7F9FC] p-1"><button type="button" onClick={() => onChange("new")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "new" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>New</button><button type="button" onClick={() => onChange("existing")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "existing" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>Existing</button></div></div> }
function CompactDocumentUpload({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) { const id = `lh-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; const documentName = label.replace(/^Add /, ""); const stateLabel = file ? `${documentName} Uploaded` : label; return <label htmlFor={id} className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-[10px] font-semibold transition ${file ? "border-[#A7DCC3] bg-[#EFFAF4] text-[#18794E] hover:border-[#82C9A7] hover:bg-[#E5F7ED]" : "border-[#8BB8F5] bg-white text-[#0A43A3] hover:border-[#5E9DEB] hover:bg-[#F5F9FF]"}`} aria-label={`${file ? "Replace" : "Upload"} ${documentName}`} title={file?.name || label}>{file ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0"/> : <Upload className="h-3.5 w-3.5 shrink-0"/>}<span className="whitespace-nowrap">{stateLabel}</span><input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => onChange(event.target.files?.[0] ?? null)}/></label> }
function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div><p className="mb-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">{title}</p><div className="divide-y divide-[#E8EDF3]">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 py-1.5 text-[9.5px]"><span className="text-[#667085]">{label}</span><span className="max-w-[190px] truncate text-right font-semibold text-[#17365D]" title={value}>{value}</span></div>)}</div></div> }
function numeric(value: string) { const normalized = value.replace(/[^0-9.]/g, ""); const parts = normalized.split("."); return parts.length > 2 ? `${parts.shift()}.${parts.join("")}` : normalized }
