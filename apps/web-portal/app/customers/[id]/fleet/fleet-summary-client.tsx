"use client";

import Link from "next/link";
import { Bike, BusFront, CarFront, ChevronDown, ChevronRight, Construction, FileText, ShieldCheck, Tractor, Truck } from "lucide-react";
import { useMemo, useState } from "react";

type Customer = {
  id: string;
  contact_name: string;
  company_name: string | null;
  customer_code: string;
};

type Vehicle = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  registration_date: string | null;
  vehicle_class_description: string | null;
  vehicle_category: string | null;
  body_type: string | null;
  fuel_type: string | null;
  gvw_kg: number | null;
  seating_capacity: number | null;
  registration_status: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  permit_type: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
  financed: boolean | null;
  financer_name: string | null;
};

type Policy = {
  id: string;
  vehicle_id: string | null;
  policy_no: string;
  policy_type: string;
  business_type: string | null;
  start_date: string;
  end_date: string;
  premium_amount: number | null;
  insured_declared_value: number | null;
  status: string | null;
  insurance_companies: { name: string } | null;
};

type Props = {
  customer: Customer;
  vehicles: Vehicle[];
  policies: Policy[];
};

export function FleetSummaryClient({ customer, vehicles, policies }: Props) {
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [policyVehicleId, setPolicyVehicleId] = useState<string | null>(null);

  const policiesByVehicle = useMemo(() => {
    const grouped = new Map<string, Policy[]>();
    for (const policy of policies) {
      if (!policy.vehicle_id) continue;
      const current = grouped.get(policy.vehicle_id) ?? [];
      current.push(policy);
      grouped.set(policy.vehicle_id, current);
    }
    return grouped;
  }, [policies]);

  function toggleVehicle(vehicleId: string) {
    setExpandedVehicleId((current) => {
      const next = current === vehicleId ? null : vehicleId;
      if (next !== vehicleId) setPolicyVehicleId(null);
      else if (current !== vehicleId) setPolicyVehicleId(null);
      return next;
    });
  }

  function togglePolicies(vehicleId: string) {
    setPolicyVehicleId((current) => current === vehicleId ? null : vehicleId);
  }

  return (
    <div className="space-y-3 pb-6">
      <section className="overflow-hidden rounded-2xl bg-[#0D2F63] shadow-[0_10px_28px_rgba(13,47,99,0.18)]">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-sm">
            <CarFront className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-bold leading-tight text-white">Fleet Summary</h1>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:flex-nowrap">
              <span className="min-w-0 truncate text-[11.5px] font-semibold text-white">
                {customer.company_name?.trim() || customer.contact_name}
              </span>
              <span className="shrink-0 text-[9px] font-medium text-white/65">{customer.customer_code}</span>
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 text-[8.5px] font-semibold uppercase tracking-[0.04em] text-white/80">
                <span>No. of Fleet</span>
                <span className="text-[12px] font-bold leading-none text-white">{vehicles.length}</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {vehicles.length === 0 ? (
        <section className="rounded-2xl border border-[#DCE3EE] bg-white px-4 py-8 text-center shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
          <CarFront className="mx-auto h-8 w-8 text-[#A5B0C0]" strokeWidth={1.7} />
          <p className="mt-3 text-[12px] font-semibold text-[#334155]">No vehicles have been added for this customer yet.</p>
        </section>
      ) : (
        <section className="space-y-2">
          {vehicles.map((vehicle) => {
            const isExpanded = expandedVehicleId === vehicle.id;
            const vehiclePolicies = policiesByVehicle.get(vehicle.id) ?? [];
            const policiesExpanded = isExpanded && policyVehicleId === vehicle.id;
            return (
              <article key={vehicle.id} className="overflow-hidden rounded-2xl border border-[#DCE3EE] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.045)]">
                <button type="button" onClick={() => toggleVehicle(vehicle.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#F8FAFC]" aria-expanded={isExpanded}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF3FF] text-[#315FEA]">
                    <VehicleClassIcon vehicle={vehicle} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-[12px] font-semibold text-[#173E7B]">{vehicle.vehicle_no || "Unregistered vehicle"}</p>
                      <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[8.5px] font-semibold text-[#64748B]">{vehicle.vehicle_type || "Vehicle"}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[9.5px] text-[#7B8798]">{[vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(" · ") || "Vehicle details available"}</p>
                  </div>
                  <div className="hidden items-center gap-5 text-right sm:flex">
                    <CompactMetric label="Policies" value={String(vehiclePolicies.length)} />
                    <CompactMetric label="Status" value={vehicle.registration_status || "—"} />
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B]" />}
                </button>

                {isExpanded ? (
                  <div className="border-t border-[#E7EBF1] bg-[#FBFCFE] px-4 py-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="grid flex-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Registration No." value={vehicle.vehicle_no} />
                        <Detail label="Vehicle Class" value={vehicle.vehicle_class_description || vehicle.vehicle_category} />
                        <Detail label="Manufacturer" value={vehicle.make} />
                        <Detail label="Model" value={vehicle.model} />
                        <Detail label="Manufacturing Year" value={vehicle.year ? String(vehicle.year) : null} />
                        <Detail label="Fuel Type" value={vehicle.fuel_type} />
                        <Detail label="Registration Date" value={formatDate(vehicle.registration_date)} />
                        <Detail label="GVW" value={vehicle.gvw_kg != null ? `${formatNumber(vehicle.gvw_kg)} kg` : null} />
                        <Detail label="Seating Capacity" value={vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : null} />
                        <Detail label="Fitness Expiry" value={formatDate(vehicle.fitness_expiry_date)} />
                        <Detail label="PUC Expiry" value={formatDate(vehicle.puc_expiry_date)} />
                        <Detail label="Permit Type" value={vehicle.permit_type} />
                        <Detail label="Permit Expiry" value={formatDate(vehicle.national_permit_expiry_date || vehicle.local_permit_expiry_date)} />
                        <Detail label="Financer" value={vehicle.financed ? vehicle.financer_name || "Financed" : "Not financed"} />
                      </div>
                      <button type="button" onClick={() => togglePolicies(vehicle.id)} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-[#173E7B] px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-[#113365]" aria-expanded={policiesExpanded}>
                        <FileText className="h-3.5 w-3.5" />
                        View Policy{vehiclePolicies.length > 1 ? ` (${vehiclePolicies.length})` : ""}
                      </button>
                    </div>

                    {policiesExpanded ? (
                      <div className="mt-3 border-t border-[#E1E7EF] pt-3">
                        {vehiclePolicies.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[#D6DEE9] bg-white px-3 py-4 text-center text-[10.5px] font-medium text-[#7B8798]">No policy is currently linked to this vehicle.</div>
                        ) : (
                          <div className="space-y-2">
                            {vehiclePolicies.map((policy, index) => (
                              <div key={policy.id} className="rounded-xl border border-[#DFE5EE] bg-white px-3 py-2.5">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEF7F2] text-[#17824A]"><ShieldCheck className="h-4 w-4" strokeWidth={1.8} /></span>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-[10.5px] font-semibold text-[#173E7B]">{policy.policy_no}</p>
                                        {index === 0 ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[7.5px] font-semibold text-emerald-700">Latest</span> : null}
                                      </div>
                                      <p className="mt-0.5 text-[9px] text-[#7B8798]">{policy.insurance_companies?.name || "Insurer not recorded"}</p>
                                    </div>
                                  </div>
                                  <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-3 md:min-w-[54%]">
                                    <PolicyMetric label="Policy Type" value={policy.policy_type} />
                                    <PolicyMetric label="Validity" value={`${formatDate(policy.start_date)} – ${formatDate(policy.end_date)}`} />
                                    <PolicyMetric label="Status" value={policy.status || "—"} />
                                    <PolicyMetric label="Business Type" value={policy.business_type || "—"} />
                                    <PolicyMetric label="Premium" value={formatCurrency(policy.premium_amount)} />
                                    <PolicyMetric label="IDV" value={formatCurrency(policy.insured_declared_value)} />
                                  </div>
                                  <Link
                                    href={`/policies/${policy.id}/edit`}
                                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-3 text-[9px] font-semibold text-[#173E7B] transition hover:border-[#173E7B] hover:bg-[#F8FAFC]"
                                  >
                                    Policy Details
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function VehicleClassIcon({ vehicle }: { vehicle: Vehicle }) {
  const classText = [vehicle.vehicle_type, vehicle.vehicle_class_description, vehicle.vehicle_category, vehicle.body_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const iconProps = { className: "h-4.5 w-4.5", strokeWidth: 1.8 };

  if (/two[ -]?wheeler|motorcycle|motor cycle|scooter|bike/.test(classText)) return <Bike {...iconProps} />;
  if (/bus|coach|passenger|pcv/.test(classText)) return <BusFront {...iconProps} />;
  if (/tractor|agricultur/.test(classText)) return <Tractor {...iconProps} />;
  if (/jcb|construction|excavator|crane|earth ?mover|cpm|misc/.test(classText)) return <Construction {...iconProps} />;
  if (/goods|gcv|truck|lorry|cargo|pickup|pick-up|commercial/.test(classText)) return <Truck {...iconProps} />;
  return <CarFront {...iconProps} />;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[0.05em] text-[#96A1B1]">{label}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#334155]" title={value || "—"}>{value || "—"}</p></div>;
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-[#A0AABA]">{label}</p><p className="mt-0.5 max-w-[110px] truncate text-[9.5px] font-semibold text-[#475569]">{value}</p></div>;
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[7.5px] font-semibold uppercase tracking-[0.05em] text-[#A0AABA]">{label}</p><p className="mt-0.5 text-[9px] font-semibold text-[#475569]">{value}</p></div>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}