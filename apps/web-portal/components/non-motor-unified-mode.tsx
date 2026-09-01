"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, HandCoins, IndianRupee, MapPin, ShieldCheck } from "lucide-react";
import { uploadNonMotorPolicyDocument } from "@/app/policies/non-motor-policy-document-actions";
import { createNonMotorPolicy, updateNonMotorPolicy, type NonMotorCommercialBasis, type NonMotorPolicyPayload } from "@/app/policies/non-motor-policy-actions";
import { usePolicyCommercialAccess } from "@/components/policy-commercial-access-context";
import { CustomerSearchField } from "@/components/customer-search-field";
import {
  NonMotorDocumentPicker,
  type NonMotorStagedDocuments,
} from "@/components/non-motor-document-picker";
import type { PolicySourceOption } from "@/components/policy-unified-form";
import type { NonMotorCustomerOption } from "@/components/non-motor-policy-form";

export type NonMotorProgress = { filled: number; total: number; complete: boolean; empty: boolean; remaining: number };

export type NonMotorUnifiedInitialValues = Partial<FormState>;

type Props = {
  mode?: "create" | "edit";
  policyId?: string;
  initialValues?: NonMotorUnifiedInitialValues;
  sourceSection: ReactNode;
  source: {
    issuanceDate: string;
    intermediaryType: string;
    sourceId: string;
    leadSource: string;
    intermediaryCode: string;
    rmName: string;
  };
  insurers: Array<{ value: string; label: string }>;
  customers: NonMotorCustomerOption[];
  sources: PolicySourceOption[];
  onProgressChange?: (progress: NonMotorProgress[]) => void;
};

type CustomerMode = "existing" | "new";
type CommercialModal = "payin" | "payout" | null;
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
  payinBasis: NonMotorCommercialBasis;
  payinPercent: string;
  payinFixedAmount: string;
  insurerSchemeAmount: string;
  payoutBasis: NonMotorCommercialBasis;
  payoutPercent: string;
  payoutFixedAmount: string;
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

type CommercialCalculations = {
  payinBase: number;
  totalPayin: number;
  tds: number;
  payinAfterTds: number;
  totalPayout: number;
  retention: number;
};

const CATEGORIES = ["Fire & Property", "Marine", "Engineering", "Liability", "Burglary", "Employee Compensation", "Cyber", "Travel", "Personal Accident", "Package Policy", "Other"];
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#E3E8EF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const emptyForm: FormState = {
  customerMode: "existing", customerId: "", customerType: "Organisation", insuredName: "", contactName: "", phone: "", email: "", address: "",
  policyNumber: "", insurerId: "", productName: "", category: "", status: "Active",
  riskTitle: "", riskLocation: "", occupancyType: "", cargoDescription: "", transitFrom: "", transitTo: "", transitMode: "", projectName: "", projectValue: "", natureOfBusiness: "", liabilityType: "", employeeCount: "", annualWages: "", businessName: "", annualTurnover: "",
  sumInsured: "", deductible: "", netPremium: "", gstAmount: "", grossPremium: "", startDate: "", endDate: "",
  payinBasis: "NET_PREMIUM_PERCENT", payinPercent: "", payinFixedAmount: "", insurerSchemeAmount: "",
  payoutBasis: "NET_PREMIUM_PERCENT", payoutPercent: "", payoutFixedAmount: "",
  proposalNumber: "", previousInsurer: "", previousPolicyNumber: "", previousClaims: "", addOns: "", warranties: "", specialConditions: "", endorsements: "", remarks: "",
};

export function NonMotorUnifiedMode({ mode = "create", policyId, initialValues, sourceSection, source, insurers, customers, sources, onProgressChange }: Props) {
  const router = useRouter();
  const commercialAccess = usePolicyCommercialAccess();
  const isEdit = mode === "edit";
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm, ...initialValues, ...(mode === "edit" ? { customerMode: "existing" as const } : {}) }));
  const [documents, setDocuments] = useState<NonMotorStagedDocuments>({});
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [commercialModal, setCommercialModal] = useState<CommercialModal>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPolicyCode, setSavedPolicyCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const selectedInsurer = insurers.find((item) => item.value === form.insurerId)?.label ?? "Not selected";
  const riskReference = form.riskLocation || form.transitFrom || form.projectName || form.riskTitle || "Not entered";
  const payinEntered = form.payinPercent.trim() !== "" || form.payinFixedAmount.trim() !== "" || form.insurerSchemeAmount.trim() !== "";
  const payoutEntered = form.payoutPercent.trim() !== "" || form.payoutFixedAmount.trim() !== "";
  const commercialCalculations = useMemo<CommercialCalculations>(() => {
    const netPremium = Number(form.netPremium || 0);
    const payinBase = form.payinBasis === "FIXED_AMOUNT" ? Number(form.payinFixedAmount || 0) : netPremium * Number(form.payinPercent || 0) / 100;
    const totalPayin = payinBase + Number(form.insurerSchemeAmount || 0);
    const tds = totalPayin * 0.10;
    const payinAfterTds = totalPayin - tds;
    const totalPayout = form.payoutBasis === "FIXED_AMOUNT" ? Number(form.payoutFixedAmount || 0) : netPremium * Number(form.payoutPercent || 0) / 100;
    return { payinBase, totalPayin, tds, payinAfterTds, totalPayout, retention: payinAfterTds - totalPayout };
  }, [form]);

  const sectionProgress = useMemo(() => {
    const groups = [
      [form.customerMode === "existing" ? form.customerId : form.insuredName, form.policyNumber, form.insurerId, form.productName, form.category],
      riskCoreValues(form),
      [form.sumInsured, form.grossPremium, form.startDate, form.endDate],
      [],
      [],
    ];
    return groups.map((values) => {
      const filled = values.filter((value) => String(value ?? "").trim() !== "").length;
      const total = values.length;
      return { filled, total, complete: total === 0 || filled === total, empty: filled === 0, remaining: Math.max(0, total - filled) };
    });
  }, [form]);

  useEffect(() => { onProgressChange?.(sectionProgress); }, [onProgressChange, sectionProgress]);
  useEffect(() => {
    if (!commercialModal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setCommercialModal(null); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [commercialModal]);

  const customerSearchOptions = useMemo(() => customers.map((customer) => ({ value: customer.id, label: `${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}` })), [customers]);

  const completionValues = useMemo(() => [
    source.issuanceDate, source.intermediaryType, source.sourceId, source.rmName, source.intermediaryCode,
    form.customerMode === "existing" ? form.customerId : form.insuredName,
    form.policyNumber, form.insurerId, form.productName, form.category,
    ...riskCoreValues(form), form.sumInsured, form.grossPremium, form.startDate, form.endDate,
  ], [source, form]);
  const completion = completionValues.length ? Math.round((completionValues.filter((value) => String(value ?? "").trim()).length / completionValues.length) * 100) : 0;

  function changeCustomer(value: string) {
    const customer = customers.find((item) => item.id === value);
    setForm((current) => ({ ...current, customerId: value, insuredName: customer?.name ?? "", contactName: customer?.contactName ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "" }));
  }

  function changeCommercialBasis(side: "payin" | "payout", basis: NonMotorCommercialBasis) {
    if (!commercialAccess) return;
    if (side === "payin") {
      setForm((current) => ({ ...current, payinBasis: basis, payinPercent: basis === "FIXED_AMOUNT" ? "" : current.payinPercent, payinFixedAmount: basis === "NET_PREMIUM_PERCENT" ? "" : current.payinFixedAmount }));
    } else {
      setForm((current) => ({ ...current, payoutBasis: basis, payoutPercent: basis === "FIXED_AMOUNT" ? "" : current.payoutPercent, payoutFixedAmount: basis === "NET_PREMIUM_PERCENT" ? "" : current.payoutFixedAmount }));
    }
  }

  function submit() {
    if (savedPolicyCode) {
      router.push(`/policies?policy=${encodeURIComponent(savedPolicyCode)}`);
      return;
    }
    setError(null);
    const selectedSource = sources.find((item) => item.value === source.sourceId);
    if (!source.issuanceDate || !source.intermediaryType || !selectedSource) { setError("Complete Policy source & ownership in Section 01 before saving the Non-Motor policy."); return; }
    if (form.customerMode === "existing" && !form.customerId) { setError("Select a customer or organisation in Section 02."); return; }
    if (form.customerMode === "new" && !form.insuredName.trim()) { setError("Enter the insured or organisation name in Section 02."); return; }
    if (!form.policyNumber || !form.insurerId || !form.productName || !form.category) { setError("Complete the required Customer & policy fields in Section 02."); return; }
    if (riskCoreValues(form).some((value) => !String(value ?? "").trim())) { setError("Complete the required Risk details in Section 03."); return; }
    if (!form.sumInsured || !form.grossPremium || !form.startDate || !form.endDate) { setError("Complete the required Cover, premium & validity fields in Section 04."); return; }
    if (commercialAccess && form.payinBasis === "NET_PREMIUM_PERCENT" && Number(form.payinPercent || 0) > 100) { setError("Projected insurer Pay-in percentage cannot exceed 100%."); return; }
    if (commercialAccess && form.payoutBasis === "NET_PREMIUM_PERCENT" && Number(form.payoutPercent || 0) > 100) { setError("Partner Payout percentage cannot exceed 100%."); return; }

    const payload: NonMotorPolicyPayload = {
      source: { issuanceDate: source.issuanceDate, intermediaryType: source.intermediaryType, intermediaryCode: selectedSource.code, leadSource: selectedSource.label, rmName: selectedSource.rmName },
      customerId: form.customerMode === "existing" ? form.customerId : undefined,
      customer: { customerType: form.customerType, insuredName: form.insuredName, contactName: form.contactName, phone: form.phone, email: form.email, address: form.address },
      policy: { policyNumber: form.policyNumber, insurerId: form.insurerId, productName: form.productName, category: form.category, status: form.status, startDate: form.startDate, endDate: form.endDate, sumInsured: form.sumInsured, netPremium: form.netPremium, gstAmount: form.gstAmount, grossPremium: form.grossPremium, deductible: form.deductible },
      commercial: commercialAccess ? { payinBasis: form.payinBasis, payinPercent: form.payinPercent, payinFixedAmount: form.payinFixedAmount, insurerSchemeAmount: form.insurerSchemeAmount, payoutBasis: form.payoutBasis, payoutPercent: form.payoutPercent, payoutFixedAmount: form.payoutFixedAmount } : undefined,
      risk: buildRiskPayload(form),
      additional: { proposalNumber: form.proposalNumber, previousInsurer: form.previousInsurer, previousPolicyNumber: form.previousPolicyNumber, previousClaims: form.previousClaims, addOns: form.addOns, warranties: form.warranties, specialConditions: form.specialConditions, endorsements: form.endorsements, remarks: form.remarks },
    };

    startTransition(async () => {
      const result = isEdit
        ? (policyId ? await updateNonMotorPolicy(policyId, payload) : { ok:false as const, error:"Policy reference is missing." })
        : await createNonMotorPolicy(payload);
      if (!result.ok) { setError(result.error); return; }

      const selectedDocuments = Object.entries(documents).filter((entry): entry is [keyof NonMotorStagedDocuments, File] => entry[1] instanceof File);
      for (const [documentType, file] of selectedDocuments) {
        const data = new FormData();
        data.set("policyId", result.policyId);
        data.set("documentType", documentType);
        data.set("file", file);
        const uploadResult = await uploadNonMotorPolicyDocument(data);
        if (!uploadResult.ok) {
          setSavedPolicyCode(result.policyCode);
          setError(isEdit
            ? `${uploadResult.error} Policy changes were saved, but this document was not uploaded. Reopen the policy to retry the document upload.`
            : `${uploadResult.error} Policy ${result.policyCode} has already been saved. Open it from the Policy Register to attach any remaining documents.`);
          router.refresh();
          return;
        }
      }

      router.push(`/policies?success=${isEdit ? "policy_updated" : "policy_created"}&policy=${encodeURIComponent(result.policyCode)}`);
      router.refresh();
    });
  }

  const customerModeControl = isEdit ? <div><span className={labelClass}>Customer record</span><div className="flex h-10 items-center rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] px-3 text-[10px] font-semibold text-[#667085]">Existing customer · locked in Policy Edit</div></div> : <Segmented label="Customer record" value={form.customerMode} options={["existing", "new"]} labels={["Existing", "New"]} onChange={(value) => {
    const mode = value as CustomerMode;
    setForm((current) => ({ ...current, customerMode: mode, ...(mode === "new" ? { customerId: "", insuredName: "", contactName: "", phone: "", email: "" } : {}) }));
  }} />;
  const categoryControl = <Select label="Non-Motor category" value={form.category} onChange={(e) => update("category", e.target.value)} required><option value="">Select category</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select>;
  const policyRow = <>
    <Field label="Policy number" value={form.policyNumber} onChange={(e) => update("policyNumber", e.target.value.toUpperCase())} placeholder="Policy number" required />
    <Select label="Insurance company" value={form.insurerId} onChange={(e) => update("insurerId", e.target.value)} required><option value="">Select insurer</option>{insurers.map((insurer) => <option key={insurer.value} value={insurer.value}>{insurer.label}</option>)}</Select>
    <Field label="Product / policy name" value={form.productName} onChange={(e) => update("productName", e.target.value)} placeholder="Policy / product" required />
    <Select label="Policy status" value={form.status} onChange={(e) => update("status", e.target.value)}><option>Active</option><option>Pending</option><option>Expired</option><option>Cancelled</option></Select>
  </>;

  return <>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="space-y-4">
        {sourceSection}

        <Section number="02" title="Customer & policy">
          {form.customerMode === "existing" ? <>
            <div>{customerModeControl}</div>
            <div className="md:col-span-1 xl:col-span-2"><CustomerSearchField label="Customer / organisation" name="non_motor_customer_id" options={customerSearchOptions} defaultValue={form.customerId} required disabled={isEdit} onSelectionChange={changeCustomer} /></div>
            <div>{categoryControl}</div>
            {policyRow}
          </> : <>
            {customerModeControl}
            <Select label="Customer type" value={form.customerType} onChange={(e) => update("customerType", e.target.value as FormState["customerType"])}><option>Organisation</option><option>Individual</option></Select>
            <Field label="Insured / organisation name" value={form.insuredName} onChange={(e) => update("insuredName", e.target.value)} placeholder="Name on policy" required />
            {categoryControl}
            <Field label="Contact person" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Primary contact" />
            <Field label="Mobile number" value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit mobile" inputMode="numeric" required />
            <Field label="Email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="Optional" type="email" />
            <Field label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Optional" />
            {policyRow}
          </>}
        </Section>

        <Section number="03" title="Risk details">
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

        <section id="policy-section-5" data-section-index="4" className="scroll-mt-[148px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
          <button type="button" onClick={() => setAdditionalOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between border-b bg-[#FBFCFE] px-4 py-2.5 text-left">
            <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">05</span><h2 className="text-[13px] font-semibold leading-tight">Additional policy details</h2></div>
            <span className="flex items-center gap-1 text-[9px] font-bold text-[#315B9A]">{additionalOpen ? "Collapse" : "Expand"}{additionalOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
          </button>
          {additionalOpen ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Proposal number" value={form.proposalNumber} onChange={(e) => update("proposalNumber", e.target.value)} placeholder="Optional" />
            <Field label="Previous insurer" value={form.previousInsurer} onChange={(e) => update("previousInsurer", e.target.value)} placeholder="Optional" />
            <Field label="Previous policy number" value={form.previousPolicyNumber} onChange={(e) => update("previousPolicyNumber", e.target.value)} placeholder="Optional" />
            <Field label="Previous claims" value={form.previousClaims} onChange={(e) => update("previousClaims", e.target.value)} placeholder="Brief reference" />
            <Field label="Add-ons" value={form.addOns} onChange={(e) => update("addOns", e.target.value)} placeholder="Optional" />
            <Field label="Warranties" value={form.warranties} onChange={(e) => update("warranties", e.target.value)} placeholder="Optional" />
            <Field label="Special conditions" value={form.specialConditions} onChange={(e) => update("specialConditions", e.target.value)} placeholder="Optional" />
            <Field label="Endorsements" value={form.endorsements} onChange={(e) => update("endorsements", e.target.value)} placeholder="Optional" />
            <div className="md:col-span-2 xl:col-span-4"><Field label="Remarks" value={form.remarks} onChange={(e) => update("remarks", e.target.value)} placeholder="Any servicing note for future reference" /></div>
          </div> : null}
        </section>

        <Section number="06" title="Documents">
          <NonMotorDocumentPicker files={documents} onChange={setDocuments} onError={setError} />
        </Section>
      </div>

      <NonMotorLiveSummary completion={completion} category={form.category || "Non Motor"} sumInsured={Number(form.sumInsured || 0)} grossPremium={Number(form.grossPremium || 0)} riskReference={riskReference} insurer={selectedInsurer} expiry={form.endDate || "Not entered"} commercialAccess={commercialAccess} payinEntered={payinEntered} payoutEntered={payoutEntered} payinBasis={form.payinBasis} payoutBasis={form.payoutBasis} payinPercent={form.payinPercent} payoutPercent={form.payoutPercent} calculations={commercialCalculations} onOpen={setCommercialModal} />
    </div>

    {commercialAccess && commercialModal === "payin" ? <ProjectedPayinModal form={form} update={update} calculations={commercialCalculations} onBasisChange={(basis) => changeCommercialBasis("payin", basis)} onClose={() => setCommercialModal(null)} /> : null}
    {commercialAccess && commercialModal === "payout" ? <PartnerPayoutModal form={form} update={update} calculations={commercialCalculations} onBasisChange={(basis) => changeCommercialBasis("payout", basis)} onClose={() => setCommercialModal(null)} /> : null}
    {error ? <ValidationErrorDialog message={error} onClose={() => setError(null)} /> : null}
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur">
      <div className="mx-auto flex max-w-[1480px] justify-end gap-2">
        <Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</Link>
        <button type="button" onClick={submit} disabled={isPending} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{isPending ? "Saving policy…" : savedPolicyCode ? "Open Policy Register" : isEdit ? "Save Policy Changes" : "Book Active Policy"}</button>
      </div>
    </div>
  </>;
}

function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  const index = Math.max(0, Number(number) - 1);
  return <section id={`policy-section-${index + 1}`} data-section-index={index} className="scroll-mt-[148px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
    <div className="flex min-h-12 items-center justify-between border-b bg-[#FBFCFE] px-4 py-2.5">
      <div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[13px] font-semibold leading-tight">{title}</h2></div>
    </div>
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
  </section>;
}

function RiskFields({ form, update }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  if (!form.category) return <div className="md:col-span-2 xl:col-span-4 rounded-xl border border-dashed border-[#CDD6E3] bg-[#FAFBFD] px-4 py-5 text-center text-[10px] text-[#7C8798]">Select a Non-Motor category to show the relevant risk fields.</div>;
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
function Field({ label, required, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}</label><input {...props} required={required} className={inputClass} /></div>; }
function Select({ label, required, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean; children: ReactNode }) { return <div><label className={labelClass}>{label}{required ? <Required /> : null}</label><select {...props} required={required} className={inputClass}>{children}</select></div>; }
function Required() { return <span className="text-red-500">*</span>; }
function Segmented({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) { return <div><span className={labelClass}>{label}</span><div className="flex h-10 rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] p-1">{options.map((option, index) => <button key={option} type="button" onClick={() => onChange(option)} className={`flex-1 rounded-lg text-[9px] font-semibold transition ${value === option ? "bg-white text-[#123B75] shadow-sm" : "text-[#667085]"}`}>{labels[index]}</button>)}</div></div>; }

function CompletionRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return <div className="relative h-12 w-12 shrink-0" aria-label={`${clamped}% complete`} title={`${clamped}% complete`}><svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90"><circle cx="24" cy="24" r={radius} fill="none" stroke="#E3EAF2" strokeWidth="5"/><circle cx="24" cy="24" r={radius} fill="none" stroke="url(#nonMotorCompletionGradient)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}/><defs><linearGradient id="nonMotorCompletionGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#315B9A"/><stop offset="1" stopColor="#19B5A5"/></linearGradient></defs></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#17365D]">{clamped}%</span></div>;
}

function NonMotorLiveSummary({ completion, category, sumInsured, grossPremium, riskReference, insurer, expiry, commercialAccess, payinEntered, payoutEntered, payinBasis, payoutBasis, payinPercent, payoutPercent, calculations, onOpen }: { completion: number; category: string; sumInsured: number; grossPremium: number; riskReference: string; insurer: string; expiry: string; commercialAccess: boolean; payinEntered: boolean; payoutEntered: boolean; payinBasis: NonMotorCommercialBasis; payoutBasis: NonMotorCommercialBasis; payinPercent: string; payoutPercent: string; calculations: CommercialCalculations; onOpen: (modal: CommercialModal) => void }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{ left: number; width: number; top: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const boundaryElement = boundaryRef.current;
    if (!boundaryElement) { setPosition(null); return; }
    const updatePosition = () => {
      if (window.innerWidth < 1280 || !anchorRef.current) { setPosition(null); return; }
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const boundaryRect = boundaryElement.getBoundingClientRect();
      const fixedCard = document.getElementById("non-motor-summary-fixed-card");
      const cardHeight = fixedCard?.getBoundingClientRect().height ?? 0;
      const preferredTop = Math.max(anchorRect.top, 172);
      const boundaryTop = cardHeight > 0 ? boundaryRect.bottom - cardHeight : preferredTop;
      setPosition({ left: anchorRect.left, width: anchorRect.width, top: Math.min(preferredTop, boundaryTop) });
    };
    const scheduleUpdate = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(updatePosition); };
    updatePosition();
    frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(boundaryElement);
    observer.observe(document.documentElement);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", scheduleUpdate); window.removeEventListener("scroll", scheduleUpdate, true); observer.disconnect(); };
  }, []);

  const complete = completion >= 100;
  const payinDetail = payinBasis === "FIXED_AMOUNT" ? "Fixed amount" : `${payinPercent || "0"}% of Net Premium`;
  const payoutDetail = payoutBasis === "FIXED_AMOUNT" ? "Fixed amount" : `${payoutPercent || "0"}% of Net Premium`;
  const commercialBlock = commercialAccess ? <div className="mt-3 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]"><div className="flex items-center gap-2 border-b border-[#E3EAF2] px-3 py-2"><HandCoins className="h-3.5 w-3.5 text-[#315B9A]"/><p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#667085]">Payin–Payout</p></div><CommercialSummaryButton label="Insurer Pay-in" entered={payinEntered} value={calculations.totalPayin} detail={payinDetail} onClick={() => onOpen("payin")}/><CommercialSummaryButton label="Partner Payout" entered={payoutEntered} value={calculations.totalPayout} detail={payoutDetail} onClick={() => onOpen("payout")}/><div className="flex items-center justify-between gap-3 border-t border-[#E3EAF2] px-3 py-2.5"><div><p className="text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#98A2B3]">Projected retention</p><p className={`mt-0.5 text-[10.5px] font-bold ${calculations.retention < 0 ? "text-red-600" : "text-[#344054]"}`}>{money.format(calculations.retention)}</p></div><span className="text-[7.5px] text-[#98A2B3]">After 10% TDS</span></div></div> : null;
  const card = <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">Policy status</p><h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><CompletionRing value={completion}/><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${complete ? "bg-[#E8F7EF] text-[#14845B]" : "bg-[#FFF3CD] text-[#A96A00]"}`}>{complete ? "Complete" : "In progress"}</span></div><div className="px-4 py-3"><SummaryItem icon={<ShieldCheck className="h-3.5 w-3.5"/>} label="Category" value={category}/><SummaryItem icon={<IndianRupee className="h-3.5 w-3.5"/>} label="Sum insured / limit" value={sumInsured ? money.format(sumInsured) : "₹0"}/><SummaryItem icon={<IndianRupee className="h-3.5 w-3.5"/>} label="Gross premium" value={grossPremium ? money.format(grossPremium) : "₹0"}/><SummaryItem icon={<MapPin className="h-3.5 w-3.5"/>} label="Risk reference" value={riskReference}/><SummaryItem icon={<ShieldCheck className="h-3.5 w-3.5"/>} label="Insurer" value={insurer}/>{commercialBlock}<div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3"><p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#98A2B3]">Policy expiry</p><p className="mt-1 text-[11px] font-semibold text-[#344054]">{expiry}</p></div></div></div>;
  return <aside ref={boundaryRef} className="xl:self-stretch"><div className="xl:hidden">{card}</div><div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true"/>{position && typeof document !== "undefined" ? createPortal(<div id="non-motor-summary-fixed-card" className="fixed z-30" style={{ left: position.left, width: position.width, top: position.top }}>{card}</div>, document.body) : null}</aside>;
}

function SummaryItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2.5 py-2"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EEF4FF] text-[#315B9A]">{icon}</span><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]">{label}</p><p className="mt-0.5 truncate text-[10.5px] font-semibold text-[#344054]" title={value}>{value}</p></div></div>; }
function CommercialSummaryButton({ label, entered, value, detail, onClick }: { label: string; entered: boolean; value: number; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white"><div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-[0.07em] text-[#667085]">{label}</p><p className="mt-0.5 text-[10.5px] font-bold text-[#17365D]">{entered ? money.format(value) : "Not entered"}</p>{entered ? <p className="mt-0.5 truncate text-[7.5px] text-[#98A2B3]">{detail}</p> : null}</div><span className="shrink-0 text-[8px] font-bold text-[#315B9A]">{entered ? "Edit" : "Add"}</span></button>; }

function ProjectedPayinModal({ form, update, calculations, onBasisChange, onClose }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void; calculations: CommercialCalculations; onBasisChange: (basis: NonMotorCommercialBasis) => void; onClose: () => void }) { return <CommercialModalShell title="Projected Insurer Pay-in" subtitle="Expected insurer income for this policy. This does not create billing or confirm the insurer's actual recognized pay-in." onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><Select label="Pay-in basis" value={form.payinBasis} onChange={(e) => onBasisChange(e.target.value as NonMotorCommercialBasis)}><option value="NET_PREMIUM_PERCENT">Net Premium %</option><option value="FIXED_AMOUNT">Fixed Amount</option></Select>{form.payinBasis === "NET_PREMIUM_PERCENT" ? <Field label="Pay-in %" type="number" min="0" max="100" step="0.01" value={form.payinPercent} onChange={(e) => update("payinPercent", numeric(e.target.value))} placeholder="0.00"/> : <Field label="Projected pay-in amount" value={form.payinFixedAmount} onChange={(e) => update("payinFixedAmount", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00"/>}<Field label="Insurer scheme / incentive" value={form.insurerSchemeAmount} onChange={(e) => update("insurerSchemeAmount", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00"/><CalculatedField label="Base projected pay-in" value={money.format(calculations.payinBase)}/><CalculatedField label="Projected total pay-in" value={money.format(calculations.totalPayin)}/><CalculatedField label="TDS @ 10%" value={money.format(calculations.tds)}/><CalculatedField label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)}/></div><p className="mt-4 rounded-xl border border-[#DCE6F2] bg-[#F8FAFD] px-3 py-2.5 text-[9px] leading-4 text-[#667085]">Blank means projected pay-in has not been entered. Entering 0 explicitly is valid and is preserved as an entered commercial value.</p></CommercialModalShell>; }
function PartnerPayoutModal({ form, update, calculations, onBasisChange, onClose }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void; calculations: CommercialCalculations; onBasisChange: (basis: NonMotorCommercialBasis) => void; onClose: () => void }) { return <CommercialModalShell title="Partner Payout" subtitle="Agreed payout for the Lead Source selected in Section 01. Payment approval, voucher and settlement remain in the partner-payment workflow." onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><Select label="Payout basis" value={form.payoutBasis} onChange={(e) => onBasisChange(e.target.value as NonMotorCommercialBasis)}><option value="NET_PREMIUM_PERCENT">Net Premium %</option><option value="FIXED_AMOUNT">Fixed Amount</option></Select>{form.payoutBasis === "NET_PREMIUM_PERCENT" ? <Field label="Payout %" type="number" min="0" max="100" step="0.01" value={form.payoutPercent} onChange={(e) => update("payoutPercent", numeric(e.target.value))} placeholder="0.00"/> : <Field label="Agreed payout amount" value={form.payoutFixedAmount} onChange={(e) => update("payoutFixedAmount", numeric(e.target.value))} inputMode="decimal" placeholder="₹ 0.00"/>}<CalculatedField label="Total agreed payout" value={money.format(calculations.totalPayout)}/><CalculatedField label="Projected retention" value={money.format(calculations.retention)} negative={calculations.retention < 0}/></div><p className="mt-4 rounded-xl border border-[#E4DFF2] bg-[#FAF8FF] px-3 py-2.5 text-[9px] leading-4 text-[#667085]">The payout is tagged automatically to the intermediary type and code selected in Section 01. Negative retention is allowed as a commercial exception and is highlighted for finance review.</p></CommercialModalShell>; }
function CalculatedField({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) { return <div><span className={labelClass}>{label}</span><div className={`flex h-10 items-center rounded-xl border bg-[#F8FAFC] px-3 text-[11px] font-bold ${negative ? "border-red-200 text-red-600" : "border-[#D8DEE9] text-[#344054]"}`}>{value}</div></div>; }
function CommercialModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) { if (typeof document === "undefined") return null; return createPortal(<div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#071D49]/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}><div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(7,29,73,.4)]"><div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3.5 sm:px-5"><div className="min-w-0 pr-3"><p className="text-[14px] font-bold text-[#102A4C]">{title}</p><p className="mt-1 text-[9.5px] leading-4 text-[#667085]">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-[17px] text-[#475467] transition hover:bg-[#F8FAFC]">×</button></div><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div><div className="shrink-0 border-t border-[#E6EBF2] bg-[#F8FAFC] px-4 py-3 sm:px-5"><div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white">Save & Close</button></div></div></div></div>, document.body); }

function ValidationErrorDialog({ message, onClose }: { message: string; onClose: () => void }) { const okRef = useRef<HTMLButtonElement>(null); useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; okRef.current?.focus(); return () => { document.body.style.overflow = previous; }; }, []); if (typeof document === "undefined") return null; return createPortal(<div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true"><div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]"><div className="px-6 pb-5 pt-6 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E8] text-[19px] font-bold text-[#D45B16] ring-6 ring-[#FFF8F2]">!</div><h2 className="mt-4 text-[15px] font-bold text-[#102A4C]">Check details</h2><p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[#667085]">{message}</p></div><div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5"><button ref={okRef} type="button" onClick={onClose} className="h-10 w-full rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white">OK</button></div></div></div>, document.body); }
