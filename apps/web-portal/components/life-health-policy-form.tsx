"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useTransition, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, IndianRupee, Upload } from "lucide-react";
import { createLifeHealthCase } from "@/app/policies/life-health-policy-actions";
import { CustomerSearchField } from "@/components/customer-search-field";

export type LifeHealthSourceOption = { type: "POSP" | "MISP" | "SIBL / Partner"; value: string; label: string; code: string; rmName: string; rmCode: string; mobile?: string };
export type LifeHealthCustomerOption = { id: string; name: string; contactName: string; phone: string; email: string };
type Props = { policyType: "Life" | "Health"; insurers: Array<{ label: string; value: string }>; customers: LifeHealthCustomerOption[]; sources: LifeHealthSourceOption[]; summaryTarget?: HTMLElement | null };
type CustomerMode = "new" | "existing";
type State = { customerMode: CustomerMode; customerId: string; insuredName: string; phone: string; email: string; insurerId: string; productName: string; proposalNumber: string; ppt: string; pd: string; paymentFrequency: string; premiumAmount: string; paymentMode: string; remarks: string };
type SourceSnapshot = { sourcingDate: string; intermediaryType: string; sourceId: string; leadSource: string; intermediaryCode: string; rmName: string; rmCode: string };

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"];
const PAYMENT_MODES = ["Cash", "Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"];
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

export function LifeHealthPolicyForm({ policyType, insurers, customers, sources, summaryTarget }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<State>({ customerMode: "new", customerId: "", insuredName: "", phone: "", email: "", insurerId: "", productName: "", proposalNumber: "", ppt: "", pd: "", paymentFrequency: "", premiumAmount: "", paymentMode: "", remarks: "" });
  const [files, setFiles] = useState<Record<string, File | null>>({ proposalForm: null, benefitIllustration: null, premiumReceipt: null });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const update = <K extends keyof State>(key: K, value: State[K]) => setForm((current) => ({ ...current, [key]: value }));
  const customerOptions = useMemo(() => customers.map((item) => ({ value: item.id, label: `${item.name}${item.phone ? ` · ${item.phone}` : ""}` })), [customers]);
  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";
  const documentCount = Object.values(files).filter(Boolean).length;
  const required = [form.customerMode === "existing" ? form.customerId : form.insuredName, form.customerMode === "existing" ? "existing" : form.phone, form.insurerId, form.productName, form.proposalNumber, form.paymentFrequency, form.premiumAmount, form.paymentMode];
  const completion = Math.round((required.filter((value) => String(value).trim()).length / required.length) * 80 + (documentCount / 3) * 20);

  function chooseCustomer(id: string) { const selected = customers.find((item) => item.id === id); setForm((current) => ({ ...current, customerId: id, insuredName: selected?.name ?? "", phone: selected?.phone ?? "", email: selected?.email ?? "" })) }
  function submit() {
    setError(null); const source = sourceSnapshot(sources); const data = new FormData(); data.set("businessLine", policyType);
    Object.entries(source).forEach(([key, value]) => data.set(key, value)); Object.entries(form).forEach(([key, value]) => data.set(key, value)); for (const [key, file] of Object.entries(files)) if (file) data.set(key, file);
    startTransition(async () => { const result = await createLifeHealthCase(data); if (!result.ok) { setError(result.error); return } router.push(`/policies/life-health-cases/${result.caseId}?created=1`); router.refresh() });
  }

  const summary = <FollowSummary completion={completion} proposal={form.proposalNumber} insurer={selectedInsurer} product={form.productName} customer={form.insuredName} mobile={form.phone} premium={form.premiumAmount} frequency={form.paymentFrequency} paymentMode={form.paymentMode} documentCount={documentCount} />;

  return <>
    <div className="space-y-3">
      <Section number="02" title="Customer / proposer" contentClassName="md:grid-cols-2 xl:grid-cols-4">
        <Segmented value={form.customerMode} onChange={(value) => setForm((current) => ({ ...current, customerMode: value, customerId: value === "new" ? "" : current.customerId }))} />
        {form.customerMode === "existing" ? <div className="md:col-span-1 xl:col-span-3"><CustomerSearchField label="Customer / proposer" name="life_health_customer_id" options={customerOptions} defaultValue={form.customerId} required portalResults onSelectionChange={chooseCustomer} /></div> : <><Field label="Client / proposer name" value={form.insuredName} onChange={(e) => update("insuredName", e.target.value)} placeholder="Name on proposal" required /><Field label="Client mobile number" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10 digit mobile" required /><Field label="Email" value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="Optional" /></>}
      </Section>

      <Section number="03" title="Policy product & case details" contentClassName="md:grid-cols-2 xl:grid-cols-3">
        <Select label="Insurance company" value={form.insurerId} onChange={(e) => update("insurerId", e.target.value)} required><option value="">Select insurer</option>{insurers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        <Field label="Product name" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Product / plan name" required />
        <Field label="Case / proposal number" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value.toUpperCase())} placeholder="Proposal number" required />
        <Field label="PPT · Premium Paying Term" value={form.ppt} onChange={(e) => update("ppt", e.target.value)} placeholder="e.g. 10 Years / Single Pay" />
        <Field label="PD · Policy Duration / Term" value={form.pd} onChange={(e) => update("pd", e.target.value)} placeholder="e.g. 20 Years / 1 Year" />
        <Select label="Payment frequency" value={form.paymentFrequency} onChange={(e) => update("paymentFrequency", e.target.value)} required><option value="">Select frequency</option>{PAYMENT_FREQUENCIES.map((item) => <option key={item}>{item}</option>)}</Select>
      </Section>

      <Section number="04" title="Premium & payment" contentClassName="md:grid-cols-2 xl:grid-cols-[minmax(0,.8fr)_minmax(0,.8fr)_minmax(0,1.6fr)]">
        <Field label="Premium amount" value={form.premiumAmount} onChange={(e) => update("premiumAmount", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00" required />
        <Select label="Payment mode" value={form.paymentMode} onChange={(e) => update("paymentMode", e.target.value)} required><option value="">Select payment mode</option>{PAYMENT_MODES.map((item) => <option key={item}>{item}</option>)}</Select>
        <div className="md:col-span-2 xl:col-span-1"><label className={labelClass}>Remarks</label><textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} rows={2} placeholder="Optional servicing / underwriting note" className="min-h-10 w-full resize-none rounded-xl border border-[#D8DEE9] bg-white px-3 py-2.5 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></div>
      </Section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-semibold text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-2 sm:grid-cols-3 xl:max-w-[760px]">
            <DocumentTile label="Proposal Form" file={files.proposalForm} onChange={(file) => setFiles((c) => ({ ...c, proposalForm: file }))} />
            <DocumentTile label="Benefit Illustration" file={files.benefitIllustration} onChange={(file) => setFiles((c) => ({ ...c, benefitIllustration: file }))} />
            <DocumentTile label="Premium Receipt" file={files.premiumReceipt} onChange={(file) => setFiles((c) => ({ ...c, premiumReceipt: file }))} />
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Link href="/policies/life-health-cases" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold text-[#344054]">View Cases</Link>
            <button type="button" onClick={submit} disabled={isPending} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{isPending ? "Creating case…" : "Create Case"}</button>
          </div>
        </div>
      </section>
    </div>
    {summaryTarget ? createPortal(summary, summaryTarget) : summary}
  </>;
}

function FollowSummary({ completion, proposal, insurer, product, customer, mobile, premium, frequency, paymentMode, documentCount }: { completion: number; proposal: string; insurer: string; product: string; customer: string; mobile: string; premium: string; frequency: string; paymentMode: string; documentCount: number }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; width: number; top: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const anchor = anchorRef.current;
    const boundary = anchor?.closest("[data-life-health-layout='true']") as HTMLElement | null;
    if (!anchor || !boundary) { setPosition(null); return; }
    const updatePosition = () => {
      if (window.innerWidth < 1280 || !anchorRef.current) { setPosition(null); return; }
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const boundaryRect = boundary.getBoundingClientRect();
      const fixedCard = document.getElementById("life-health-summary-fixed-card");
      const cardHeight = fixedCard?.getBoundingClientRect().height ?? 0;
      const preferredTop = Math.max(anchorRect.top, 172);
      const boundaryTop = cardHeight > 0 ? boundaryRect.bottom - cardHeight : preferredTop;
      setPosition({ left: anchorRect.left, width: anchorRect.width, top: Math.min(preferredTop, boundaryTop) });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updatePosition); };
    updatePosition(); frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true);
    const observer = new ResizeObserver(schedule); observer.observe(boundary); observer.observe(document.documentElement);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); observer.disconnect(); };
  }, []);

  const card = <aside id="life-health-summary-fixed-card" className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]">
    <div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">Policy status</p><h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><CompletionRing value={completion}/><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${completion >= 100 ? "bg-[#E8F7EF] text-[#14845B]" : "bg-[#FFF3CD] text-[#A96A00]"}`}>{completion >= 100 ? "Complete" : "In progress"}</span></div>
    <div className="space-y-3 px-4 py-3"><SummaryBlock title="Case" rows={[["Proposal", proposal || "Not entered"], ["Insurer", insurer], ["Product", product || "Not entered"]]} /><SummaryBlock title="Customer" rows={[["Name", customer || "Not selected"], ["Mobile", mobile || "—"]]} /><div><div className="mb-1.5 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><IndianRupee className="h-3.5 w-3.5" /></span><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Premium</p></div><p className="text-[17px] font-bold text-[#17365D]">{money.format(Number(premium || 0))}</p><p className="mt-1 text-[9px] text-[#667085]">{frequency || "Frequency pending"} · {paymentMode || "Mode pending"}</p></div><div className="rounded-xl border border-[#DCE6F1] bg-[#F8FBFE] px-3 py-2.5"><div className="flex items-center justify-between"><span className="text-[9px] font-bold text-[#17365D]">Documents</span><span className={`rounded-full px-2 py-1 text-[8px] font-bold ${documentCount === 3 ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#F1F4F8] text-[#667085]"}`}>{documentCount} / 3 uploaded</span></div></div></div>
  </aside>;

  return <div ref={anchorRef} className="min-h-[1px] w-full">{position && typeof document !== "undefined" ? createPortal(<div style={{ position: "fixed", left: position.left, width: position.width, top: position.top, zIndex: 30 }}>{card}</div>, document.body) : card}</div>;
}

function CompletionRing({ value }: { value: number }) { const clamped = Math.max(0, Math.min(100, value)); const radius = 19, circumference = 2 * Math.PI * radius, offset = circumference - (clamped / 100) * circumference; return <div className="relative h-12 w-12 shrink-0"><svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90"><circle cx="24" cy="24" r={radius} fill="none" stroke="#E3EAF2" strokeWidth="5"/><circle cx="24" cy="24" r={radius} fill="none" stroke="#315B9A" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}/></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#17365D]">{clamped}%</span></div> }
function Section({ number, title, children, contentClassName = "md:grid-cols-2 xl:grid-cols-4" }: { number: string; title: string; children: ReactNode; contentClassName?: string }) { return <section id={`policy-section-${number}`} className="scroll-mt-[148px] overflow-visible rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-11 items-center border-b bg-[#FBFCFE] px-4 py-2"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[12px] font-semibold leading-tight">{title}</h2></div></div><div className={`grid gap-3 p-3 ${contentClassName}`}>{children}</div></section> }
function Required() { return <span className="text-red-500">*</span> }
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <div><label className={labelClass}>{label}{required ? <Required/> : null}</label><input {...props} required={required} className={inputClass}/></div> }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) { return <div><label className={labelClass}>{label}{required ? <Required/> : null}</label><select {...props} required={required} className={inputClass}>{children}</select></div> }
function Segmented({ value, onChange }: { value: CustomerMode; onChange: (value: CustomerMode) => void }) { return <div><label className={labelClass}>Customer record</label><div className="inline-flex h-10 w-full rounded-xl border border-[#D8DEE9] bg-[#F7F9FC] p-1"><button type="button" onClick={() => onChange("new")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "new" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>New</button><button type="button" onClick={() => onChange("existing")} className={`flex-1 rounded-lg text-[9.5px] font-bold transition ${value === "existing" ? "bg-[#17365D] text-white shadow" : "text-[#667085]"}`}>Existing</button></div></div> }
function DocumentTile({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) { const id = `lh-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; return <div className={`rounded-xl border px-3 py-2.5 ${file ? "border-emerald-200 bg-emerald-50/40" : "border-[#D8E1EC] bg-white"}`}><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-lg ${file ? "bg-emerald-100 text-emerald-700" : "bg-[#EEF4FB] text-[#315B9A]"}`}>{file ? <CheckCircle2 className="h-4 w-4"/> : <FileText className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><p className="truncate text-[9.5px] font-bold text-[#17365D]">{label}</p><p className="truncate text-[8px] text-[#667085]">{file ? file.name : "Not uploaded"}</p></div><label htmlFor={id} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#CAD7E7] bg-white text-[#315B9A]" aria-label={`${file ? "Replace" : "Upload"} ${label}`} title={`${file ? "Replace" : "Upload"} ${label}`}><Upload className="h-3.5 w-3.5"/></label><input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)}/></div></div> }
function SummaryBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div><p className="mb-1 text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">{title}</p><div className="divide-y divide-[#E8EDF3]">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 py-1.5 text-[9.5px]"><span className="text-[#667085]">{label}</span><span className="max-w-[190px] truncate text-right font-semibold text-[#17365D]" title={value}>{value}</span></div>)}</div></div> }
function numeric(value: string) { const normalized = value.replace(/[^0-9.]/g, ""); const parts = normalized.split("."); return parts.length > 2 ? `${parts.shift()}.${parts.join("")}` : normalized }
