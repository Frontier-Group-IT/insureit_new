"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { createExternalPolicy, updateExternalPolicy, type ExternalPolicyPayload } from "./external-policy-actions";

type CustomerOption = {
  id: string;
  label: string;
  phone: string | null;
  vehicles: { id: string; vehicle_no: string; make: string | null; model: string | null }[];
};
type InsurerOption = { id: string; name: string };

export type ExternalPolicyInitialValues = ExternalPolicyPayload & { policyId?: string };

const emptyValues: ExternalPolicyInitialValues = {
  customerId: "",
  vehicleId: "",
  insuranceCompanyId: "",
  policyNo: "",
  policyType: "Commercial comprehensive",
  startDate: "",
  endDate: "",
  premiumAmount: "",
  insuredDeclaredValue: "",
};

export function ExternalPolicyForm({
  mode,
  customers,
  insurers,
  initialValues,
}: {
  mode: "create" | "edit";
  customers: CustomerOption[];
  insurers: InsurerOption[];
  initialValues?: ExternalPolicyInitialValues;
}) {
  const [values, setValues] = useState<ExternalPolicyInitialValues>(initialValues ?? emptyValues);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCustomer = useMemo(() => customers.find((item) => item.id === values.customerId) ?? null, [customers, values.customerId]);
  const vehicles = selectedCustomer?.vehicles ?? [];

  function set<K extends keyof ExternalPolicyPayload>(key: K, value: ExternalPolicyPayload[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function changeCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    const nextVehicleId = customer?.vehicles.some((vehicle) => vehicle.id === values.vehicleId) ? values.vehicleId : "";
    setValues((current) => ({ ...current, customerId, vehicleId: nextVehicleId }));
  }

  function submit() {
    setMessage("");
    const payload: ExternalPolicyPayload = {
      customerId: values.customerId,
      vehicleId: values.vehicleId,
      insuranceCompanyId: values.insuranceCompanyId,
      policyNo: values.policyNo,
      policyType: values.policyType,
      startDate: values.startDate,
      endDate: values.endDate,
      premiumAmount: values.premiumAmount,
      insuredDeclaredValue: values.insuredDeclaredValue,
    };
    startTransition(async () => {
      const result = mode === "edit" && values.policyId
        ? await updateExternalPolicy(values.policyId, payload)
        : await createExternalPolicy(payload);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      window.location.href = "/policies/external";
    });
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-4">
      <div className="rounded-[22px] border border-[#DCE5F0] bg-white px-5 py-4 shadow-[0_16px_40px_rgba(31,48,86,.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#17365D]"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#65758B]">External policy</p>
              <h1 className="mt-1 text-[20px] font-extrabold tracking-[-0.02em] text-[#12203B]">{mode === "edit" ? "Edit External Policy" : "Add External Policy"}</h1>
              <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#66748A]">Link an outside insurance policy to an existing customer and one of that customer&apos;s existing vehicles. This record stays separate from the SIBL policy register and business calculations.</p>
            </div>
          </div>
          <Link href="/policies/external" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D3DFEC] bg-[#F8FAFC] px-3 text-[10.5px] font-bold text-[#334155]"><ArrowLeft className="h-4 w-4" />External Policies</Link>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-semibold text-red-700">{message}</div> : null}

      <section className="rounded-[22px] border border-[#DCE5F0] bg-white p-5 shadow-[0_16px_40px_rgba(31,48,86,.07)]">
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label="Customer" required>
            <select value={values.customerId} onChange={(event) => changeCustomer(event.target.value)} className={inputClass}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}{customer.phone ? ` • ${customer.phone}` : ""}</option>)}
            </select>
          </Field>

          <Field label="Existing Vehicle" required hint={values.customerId ? `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} available for selected customer` : "Select a customer first"}>
            <select value={values.vehicleId} onChange={(event) => set("vehicleId", event.target.value)} disabled={!values.customerId} className={`${inputClass} disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]`}>
              <option value="">Select vehicle</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_no}{[vehicle.make, vehicle.model].filter(Boolean).length ? ` • ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}` : ""}</option>)}
            </select>
          </Field>

          <Field label="Insurance Company" required>
            <select value={values.insuranceCompanyId} onChange={(event) => set("insuranceCompanyId", event.target.value)} className={inputClass}>
              <option value="">Select insurer</option>
              {insurers.map((insurer) => <option key={insurer.id} value={insurer.id}>{insurer.name}</option>)}
            </select>
          </Field>

          <Field label="Policy Number" required>
            <input value={values.policyNo} onChange={(event) => set("policyNo", event.target.value.toUpperCase())} placeholder="Enter policy number" className={inputClass} />
          </Field>

          <Field label="Policy Type" required>
            <input value={values.policyType} onChange={(event) => set("policyType", event.target.value)} placeholder="Commercial comprehensive" className={inputClass} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valid From" required><input type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} className={inputClass} /></Field>
            <Field label="Valid Upto" required><input type="date" value={values.endDate} onChange={(event) => set("endDate", event.target.value)} className={inputClass} /></Field>
          </div>

          <Field label="Premium Amount" hint="Optional"><MoneyInput value={values.premiumAmount} onChange={(value) => set("premiumAmount", value)} /></Field>
          <Field label="Insured Declared Value (IDV)" hint="Optional"><MoneyInput value={values.insuredDeclaredValue} onChange={(value) => set("insuredDeclaredValue", value)} /></Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#E8EEF5] pt-4 sm:flex-row sm:justify-end">
          <Link href="/policies/external" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D3DFEC] bg-white px-4 text-[11px] font-bold text-[#475569]">Cancel</Link>
          <button type="button" onClick={submit} disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.20)] disabled:opacity-60"><Save className="h-4 w-4" />{isPending ? "Saving..." : mode === "edit" ? "Save Changes" : "Add External Policy"}</button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-bold text-[#334155]"><span>{label}{required ? <span className="ml-0.5 text-red-500">*</span> : null}</span>{hint ? <span className="text-[9px] font-medium text-[#94A3B8]">{hint}</span> : null}</span>{children}</label>;
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="flex h-11 overflow-hidden rounded-xl border border-[#CBD8E6] bg-white focus-within:border-[#7EA5DC] focus-within:ring-2 focus-within:ring-[#DCEBFF]"><span className="grid w-10 place-items-center border-r border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-bold text-[#64748B]">₹</span><input value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent px-3 text-[11px] font-semibold text-[#0F172A] outline-none" /></div>;
}

const inputClass = "h-11 w-full rounded-xl border border-[#CBD8E6] bg-white px-3 text-[11px] font-semibold text-[#0F172A] outline-none transition focus:border-[#7EA5DC] focus:ring-2 focus:ring-[#DCEBFF]";
