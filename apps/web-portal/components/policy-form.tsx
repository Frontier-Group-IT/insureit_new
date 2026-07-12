"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { FormSubmitButton } from "./form-submit-button";

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

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function PolicyForm({ action, createInsurerAction, customers, vehicles, insurers: initialInsurers, values, submitLabel = "Save record" }: Props) {
  const [customerId, setCustomerId] = useState(values?.customer_id ?? "");
  const [vehicleId, setVehicleId] = useState(values?.vehicle_id ?? "");
  const [insurerId, setInsurerId] = useState(values?.insurance_company_id ?? "");
  const [insurers, setInsurers] = useState(initialInsurers);
  const [modalOpen, setModalOpen] = useState(false);
  const [insurerName, setInsurerName] = useState("");
  const [insurerError, setInsurerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.customerId === customerId), [customerId, vehicles]);

  function changeCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    if (!vehicles.some((vehicle) => vehicle.value === vehicleId && vehicle.customerId === nextCustomerId)) setVehicleId("");
  }

  function createInsurer() {
    const name = insurerName.trim();
    if (!name) { setInsurerError("Enter the insurance company name."); return; }
    setInsurerError(null);
    const formData = new FormData();
    formData.set("name", name);
    startTransition(async () => {
      const result = await createInsurerAction(formData);
      if (!result.ok || !result.insurer) { setInsurerError(result.error ?? "Unable to add insurance company."); return; }
      setInsurers((current) => [...current.filter((item) => item.value !== result.insurer!.value), result.insurer!].sort((a, b) => a.label.localeCompare(b.label)));
      setInsurerId(result.insurer.value);
      setInsurerName("");
      setModalOpen(false);
    });
  }

  return <>
    {modalOpen ? <div className="fixed inset-0 z-[150] grid place-items-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6366F1]">Insurance master</p><h2 className="mt-1 text-[17px] font-semibold text-[#0F172A]">Add insurance company</h2><p className="mt-1 text-[10.5px] text-[#64748B]">The company will be saved to Supabase and available for future policies.</p></div><button type="button" onClick={() => { setModalOpen(false); setInsurerError(null); }} className="grid h-8 w-8 place-items-center rounded-md border border-[#E2E8F0] text-[#64748B]">×</button></div>
        <div className="mt-4"><label className={labelClass} htmlFor="new_insurer_name">Insurance company name *</label><input id="new_insurer_name" value={insurerName} onChange={(event) => setInsurerName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); createInsurer(); } }} autoFocus className={inputClass} placeholder="Enter company name" />{insurerError ? <p className="mt-1.5 text-[10.5px] font-medium text-red-600">{insurerError}</p> : null}</div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setModalOpen(false); setInsurerError(null); }} className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</button><button type="button" disabled={isPending} onClick={createInsurer} className="rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60">{isPending ? "Saving..." : "Add Company"}</button></div>
      </div>
    </div> : null}

    <div className="mx-auto max-w-[1240px] pb-20"><form action={action} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Section title="Policy mapping"><Select label="Customer" name="customer_id" options={customers} value={customerId} onChange={changeCustomer} required emptyLabel="Select customer" /><Select label="Vehicle" name="vehicle_id" options={filteredVehicles} value={vehicleId} onChange={setVehicleId} required disabled={!customerId} emptyLabel={customerId ? (filteredVehicles.length ? "Select vehicle" : "No vehicles for selected customer") : "Select customer first"} /><Field label="Policy number" name="policy_no" placeholder="POL-123456" required defaultValue={values?.policy_no ?? ""} uppercase /></Section>
      <Section title="Insurer details"><div><label className={labelClass} htmlFor="insurance_company_id">Insurance company *</label><div className="flex gap-2"><select id="insurance_company_id" name="insurance_company_id" required value={insurerId} onChange={(event) => setInsurerId(event.target.value)} className={inputClass}><option value="">Select insurer</option>{insurers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="button" onClick={() => setModalOpen(true)} className="shrink-0 rounded-md border border-[#C7D2FE] bg-[#EEF2FF] px-3 text-[10.5px] font-semibold text-[#4338CA] hover:bg-[#E0E7FF]">+ Add Company</button></div></div><Field label="Policy type" name="policy_type" placeholder="Comprehensive / Third-party" required defaultValue={values?.policy_type ?? ""} /></Section>
      <Section title="Coverage and validity"><Field label="Insured declared value (IDV)" name="insured_declared_value" placeholder="Amount" type="number" min="0" defaultValue={values?.insured_declared_value?.toString() ?? ""} /><Field label="Start date" name="start_date" type="date" required defaultValue={values?.start_date ?? ""} /><Field label="End date" name="end_date" type="date" required defaultValue={values?.end_date ?? ""} /></Section>
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href="/policies" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</Link><FormSubmitButton label={submitLabel} /></div>
    </form></div>
  </>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">{title}</h3><div className="grid gap-x-3 gap-y-3 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>; }
function Field({ label, name, placeholder = "", type = "text", required = false, defaultValue, uppercase = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; uppercase?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue ?? ""} className={`${inputClass} ${uppercase ? "uppercase" : ""}`} {...props} /></div>; }
function Select({ label, name, options, value, onChange, emptyLabel, required = false, disabled = false }: { label: string; name: string; options: SelectOption[]; value: string; onChange: (value: string) => void; emptyLabel: string; required?: boolean; disabled?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} className={inputClass} required={required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
