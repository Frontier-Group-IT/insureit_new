import Link from "next/link";
import {
  ArrowRight,
  Car,
  ChevronDown,
  ClipboardList,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { PartnerCustomerDetail } from "@/lib/partner-web";

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(parsed);
}

function statusLabel(value: string | null) {
  return (value || "active")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function policyLifecycle(endDate: string | null) {
  if (!endDate) return "Active";
  const parsed = new Date(endDate.length === 10 ? endDate + "T23:59:59" : endDate);
  if (Number.isNaN(parsed.getTime())) return "Active";
  return parsed.getTime() < Date.now() ? "Expired" : "Active";
}

function display(...values: Array<string | number | null | undefined>) {
  return values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" · ");
}

function vehicleKey(value: string | null | undefined) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function PartnerCustomerFleetSummary({ data }: { data: PartnerCustomerDetail }) {
  const customer = data.customer;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#153D7A] px-4 py-3 text-white shadow-[0_8px_22px_rgba(15,52,111,0.16)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#315FEA]">
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold leading-none">Fleet Summary</h2>
            <p className="mt-1 truncate text-[9px] font-semibold text-white/85">
              {customer.customer_name}
              {customer.customer_code ? <span className="ml-1.5 text-white/65">{customer.customer_code}</span> : null}
            </p>
          </div>
        </div>
        <span className="rounded-md border border-white/25 bg-white/5 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.05em]">
          No. of Fleet&nbsp; {data.vehicles.length}
        </span>
      </div>

      {data.vehicles.length ? (
        <div className="space-y-3">
          {data.vehicles.map((vehicle) => {
            const key = vehicleKey(vehicle.vehicle_no);
            const policies = key ? data.policies.filter((policy) => vehicleKey(policy.vehicle_no) === key) : [];
            const claims = key ? data.claims.filter((claim) => vehicleKey(claim.vehicle_no) === key) : [];
            const currentPolicy = [...policies].sort((a, b) => String(b.end_date || "").localeCompare(String(a.end_date || "")))[0] ?? null;
            const lifecycle = currentPolicy ? policyLifecycle(currentPolicy.end_date) : null;

            return (
              <details
                key={vehicle.vehicle_id}
                className="group overflow-hidden rounded-2xl border border-[#DCE5F0] bg-white shadow-[0_5px_18px_rgba(31,55,86,0.055)]"
              >
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-[#FBFCFE] xl:grid-cols-[minmax(260px,1.4fr)_repeat(3,minmax(110px,.75fr))_minmax(125px,.75fr)_24px] xl:items-center [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#176AF0]">
                      <Car className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[11px] font-extrabold text-[#174A91]">{vehicle.vehicle_no || "Vehicle"}</p>
                        {vehicle.vehicle_type ? (
                          <span className="rounded-full border border-[#D7E0EC] bg-[#F5F8FC] px-2 py-0.5 text-[7.5px] font-bold text-[#60748F]">{vehicle.vehicle_type}</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[8px] font-medium text-[#7A8DA7]">
                        {display(vehicle.make, vehicle.model, vehicle.year) || "Vehicle details"}
                      </p>
                    </div>
                  </div>
                  <SummaryField label="Make" value={vehicle.make || "—"} />
                  <SummaryField label="Model" value={vehicle.model || "—"} />
                  <SummaryField label="Year" value={vehicle.year || "—"} />
                  <SummaryField label="Policy Status" value={lifecycle || "No linked policy"} tone={lifecycle === "Active" ? "green" : lifecycle === "Expired" ? "red" : "neutral"} />
                  <ChevronDown className="h-4 w-4 justify-self-end text-[#64748B] transition-transform duration-200 group-open:rotate-180" />
                </summary>

                <div className="relative border-t border-[#E7EDF4]">
                  <div className="grid gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(5,minmax(0,1fr))_140px]">
                    <Detail label="Registration No." value={vehicle.vehicle_no || "—"} />
                    <Detail label="Vehicle Class" value={vehicle.vehicle_type || "—"} />
                    <Detail label="Manufacturer" value={vehicle.make || "—"} />
                    <Detail label="Model" value={vehicle.model || "—"} />
                    <Detail label="Manufacturing Year" value={vehicle.year ? String(vehicle.year) : "—"} />
                    {policies.length ? <div className="hidden xl:block" aria-hidden="true" /> : null}
                    <Detail label="Fitness Expiry" value={dateLabel(vehicle.fitness_expiry_date)} />
                    <Detail label="PUC Expiry" value={dateLabel(vehicle.puc_expiry_date)} />
                    <Detail label="Road Tax Expiry" value={dateLabel(vehicle.road_tax_expiry_date)} />
                    <Detail label="National Permit" value={dateLabel(vehicle.national_permit_expiry_date)} />
                    <Detail label="Local Permit" value={dateLabel(vehicle.local_permit_expiry_date)} />
                  </div>

                  {policies.length ? (
                    <details className="group/policies">
                      <summary className="flex cursor-pointer list-none justify-end px-4 pb-3 [&::-webkit-details-marker]:hidden xl:absolute xl:right-4 xl:top-3 xl:p-0">
                        <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#123D82] px-3 text-[8.5px] font-bold text-white transition hover:bg-[#0D326D]">
                          <FileText className="h-3.5 w-3.5" />
                          View Policy
                          <ChevronDown className="h-3 w-3 transition-transform duration-200 group-open/policies:rotate-180" />
                        </span>
                      </summary>

                      <div className="border-t border-[#E8EDF4] px-4 py-3">
                        <div className="space-y-2">
                          {policies.map((policy, index) => {
                            const policyState = policyLifecycle(policy.end_date);
                            return (
                              <Link
                                key={policy.policy_id}
                                href={"/partner/policies/" + encodeURIComponent(policy.policy_id)}
                                prefetch={false}
                                className="group/policy grid gap-2 rounded-xl border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white sm:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(100px,.65fr))_auto] sm:items-center"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EAF8F1] text-[#1B9A63]">
                                    <ShieldCheck className="h-4 w-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="truncate text-[9.5px] font-extrabold text-[#173A69]">{policy.policy_no || policy.policy_code || "Policy"}</p>
                                      {index === 0 ? (
                                        <span className="rounded-full border border-[#BDEBD3] bg-[#ECFAF3] px-1.5 py-0.5 text-[7px] font-bold text-[#15915B]">Latest</span>
                                      ) : null}
                                    </div>
                                    <p className="mt-0.5 truncate text-[8px] font-medium text-[#7A8CA4]">{policy.insurer_name || "Insurer not recorded"}</p>
                                  </div>
                                </div>
                                <Detail label="Policy Type" value={policy.policy_type || policy.policy_product || "—"} compact />
                                <Detail label="Validity" value={policy.end_date ? `Until ${dateLabel(policy.end_date)}` : "—"} compact />
                                <Detail label="Premium" value={policy.premium_amount != null ? `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(policy.premium_amount) || 0)}` : "—"} compact />
                                <SummaryField label="Status" value={policyState} tone={policyState === "Active" ? "green" : "red"} />
                                <span className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#CCD9EA] bg-white px-3 text-[8px] font-bold text-[#174A91]">
                                  Policy Details <ArrowRight className="h-3 w-3 transition group-hover/policy:translate-x-0.5" />
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ) : null}

                  {claims.length ? (
                    <div className="border-t border-[#E8EDF4] px-4 py-3">
                      <p className="mb-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#6B7F9A]">Linked Claims</p>
                      <div className="space-y-2">
                        {claims.map((claim) => (
                          <Link
                            key={claim.claim_id}
                            href={"/partner/claims/" + encodeURIComponent(claim.claim_id)}
                            prefetch={false}
                            className="group/claim flex items-center gap-3 rounded-lg border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white"
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFF1E8] text-[#DE6B22]">
                              <ClipboardList className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-[9.5px] font-extrabold text-[#173A69]">{claim.claim_no || "Claim"}</p>
                              <p className="mt-0.5 break-words text-[8px] font-medium text-[#7A8CA4]">{display(claim.insurer_name, dateLabel(claim.created_at)) || "Claim details"}</p>
                            </div>
                            <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[8px] font-bold text-[#425672]">{statusLabel(claim.current_status)}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-[#176AF0] transition group-hover/claim:translate-x-0.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#DCE5F0] bg-white py-10 text-center">
          <Car className="mx-auto h-7 w-7 text-[#9AABC0]" />
          <p className="mt-3 text-[11px] font-bold text-[#23395D]">No vehicles recorded.</p>
        </div>
      )}
    </section>
  );
}

function SummaryField({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "green" | "red";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[7px] font-black uppercase tracking-[0.05em] text-[#8191A7]">{label}</p>
      {tone === "neutral" ? (
        <p className="mt-1 truncate text-[9px] font-semibold text-[#38516F]">{value}</p>
      ) : (
        <span className={"mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7.5px] font-bold " + (tone === "green" ? "bg-[#E7F8EF] text-[#15915B]" : "bg-[#FFE9E9] text-[#C94A4A]")}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {value}
        </span>
      )}
    </div>
  );
}

function Detail({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[7px] font-black uppercase tracking-[0.05em] text-[#8A99AD]">{label}</p>
      <p className={(compact ? "mt-0.5 text-[8.5px]" : "mt-1 text-[9px]") + " break-words font-semibold text-[#40536F]"}>{value}</p>
    </div>
  );
}
