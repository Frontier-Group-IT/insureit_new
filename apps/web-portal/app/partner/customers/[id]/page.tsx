import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  Car,
  CarFront,
  ChevronDown,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function customerTypeLabel(value: string | null) {
  if (!value) return "Individual / Proprietor";
  return statusLabel(value);
}

export default async function PartnerCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPartnerWebCustomerDetail(id);
  const customer = data.customer;
  const relationship = display(customer.intermediary_type, customer.intermediary_code) || "Not recorded";
  const location = [customer.city, customer.state].filter(Boolean).join(", ") || "Not recorded";

  return (
    <PartnerPortalShell title="Customer Detail">
      <div className="space-y-2 pb-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/partner/customers"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Customer Register
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserRound className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[18px] font-semibold tracking-[-0.01em] text-white">
                    {customer.customer_name}
                  </h1>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1FC77A] text-[10px] font-black text-white">
                    ✓
                  </span>
                </div>
                {customer.company_name ? (
                  <p className="mt-0.5 text-[10.5px] font-medium text-blue-100">{customer.company_name}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 xl:grid-cols-6" aria-label="Customer summary">
            <HeaderMetric icon={UserRound} label="Customer Type" value={customerTypeLabel(customer.customer_type)} />
            <HeaderMetric icon={BadgeCheck} label="Relationship" value={relationship} />
            <HeaderMetric icon={CarFront} label="Fleet Size" value={String(data.summary.vehicles)} />
            <HeaderMetric icon={Phone} label="Mobile" value={customer.phone || "Not set"} />
            <HeaderMetric icon={BadgeCheck} label="Customer Code" value={customer.customer_code || "Not set"} />
            <HeaderMetric icon={CalendarDays} label="Active Since" value={dateLabel(customer.created_at)} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Personal Information</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyField label="Customer name" value={customer.customer_name} />
              <ReadOnlyField label="Login mobile" value={customer.phone || "Not recorded"} hint="Partner customer contact" />
              <ReadOnlyField label="Email" value={customer.email || "Not recorded"} />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Address Details</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <ReadOnlyField label="Street" value="Not recorded" />
              <ReadOnlyField label="Locality" value="Not recorded" />
              <ReadOnlyField label="City" value={customer.city || "Not recorded"} />
              <ReadOnlyField label="State" value={customer.state || "Not recorded"} />
              <ReadOnlyField label="PIN code" value="Not recorded" />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[12px] font-semibold text-[#172033]">KYC and GST Details</h2>
              <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-[#64748B]">
                <span className="h-3.5 w-3.5 rounded border border-[#CBD5E1] bg-white" />
                GST Registered
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ReadOnlyField label="PAN number" value="Not available in Partner view" />
              <ReadOnlyField label="Aadhaar" value="Not available in Partner view" />
              <ReadOnlyField label="Legal trade name" value={customer.company_name || "Not recorded"} />
              <ReadOnlyField label="Location" value={location} />
            </div>
          </div>

          <div className="border-b border-[#E3E8EF] bg-[#F7F8FF] px-4 py-3">
            <h2 className="text-[12px] font-semibold text-[#172033]">Documents</h2>
            <div className="mt-3 grid gap-2.5 md:grid-cols-3">
              <DocumentPlaceholder label="PAN Copy" />
              <DocumentPlaceholder label="Aadhaar Front" />
              <DocumentPlaceholder label="Aadhaar Back" />
            </div>
          </div>
        </section>

        <details className="group overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10.5px] font-semibold text-[#334155] [&::-webkit-details-marker]:hidden">
            <span>Activity Status</span>
            <ChevronDown className="h-4 w-4 text-[#64748B] transition group-open:rotate-180" />
          </summary>
          <div className="grid border-t border-[#E6EBF1] bg-[#FBFCFE] sm:grid-cols-2 lg:grid-cols-4">
            <ActivityMetric label="Vehicles" value={data.summary.vehicles} />
            <ActivityMetric label="Policies" value={data.summary.policies} />
            <ActivityMetric label="Claims" value={data.summary.claims} />
            <ActivityMetric label="Renewals due" value={data.summary.renewals_30_days} />
          </div>
        </details>

        <details className="group overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[10.5px] font-semibold text-[#334155] [&::-webkit-details-marker]:hidden">
            <span>Fleet & Linked Records</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-[#8794A6]">{data.vehicles.length} vehicle{data.vehicles.length === 1 ? "" : "s"}</span>
              <ChevronDown className="h-4 w-4 text-[#64748B] transition group-open:rotate-180" />
            </div>
          </summary>

          <div className="border-t border-[#E6EBF1] bg-[#F7F9FC] p-3">
            {data.vehicles.length ? (
              <div className="space-y-3">
                {data.vehicles.map((vehicle) => {
                  const key = vehicleKey(vehicle.vehicle_no);
                  const policies = key ? data.policies.filter((policy) => vehicleKey(policy.vehicle_no) === key) : [];
                  const claims = key ? data.claims.filter((claim) => vehicleKey(claim.vehicle_no) === key) : [];
                  const currentPolicy = [...policies].sort((a, b) => String(b.end_date || "").localeCompare(String(a.end_date || "")))[0] ?? null;
                  const lifecycle = currentPolicy ? policyLifecycle(currentPolicy.end_date) : null;

                  return (
                    <article key={vehicle.vehicle_id} className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_3px_10px_rgba(31,55,86,0.035)]">
                      <div className="grid gap-3 border-b border-[#E8EDF4] px-3.5 py-2.5 xl:grid-cols-[minmax(190px,1.25fr)_repeat(4,minmax(120px,.8fr))_auto] xl:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#176AF0]">
                            <Car className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-[11px] font-black text-[#15345C]">{vehicle.vehicle_no || "Vehicle"}</p>
                              {vehicle.vehicle_type ? (
                                <span className="rounded-full border border-[#D7E0EC] bg-[#F5F8FC] px-2 py-0.5 text-[7.5px] font-bold text-[#60748F]">{vehicle.vehicle_type}</span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[8.5px] font-medium text-[#7A8DA7]">{display(vehicle.make, vehicle.model, vehicle.year) || "Vehicle details"}</p>
                          </div>
                        </div>
                        <CompactField label="Make" value={vehicle.make || "—"} />
                        <CompactField label="Model" value={vehicle.model || "—"} />
                        <CompactField label="Year" value={vehicle.year || "—"} />
                        <CompactField label="Policy Status" value={lifecycle || "No linked policy"} tone={lifecycle === "Active" ? "green" : lifecycle === "Expired" ? "red" : "neutral"} />
                        {currentPolicy ? (
                          <Link
                            href={"/partner/policies/" + encodeURIComponent(currentPolicy.policy_id)}
                            prefetch={false}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#123D82] px-3 text-[8.5px] font-bold text-white transition hover:bg-[#0D326D]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Policy
                          </Link>
                        ) : null}
                      </div>

                      <div className="grid gap-x-5 gap-y-2 px-3.5 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                        <Detail label="Registration No." value={vehicle.vehicle_no || "—"} />
                        <Detail label="Vehicle Class" value={vehicle.vehicle_type || "—"} />
                        <Detail label="Manufacturer" value={vehicle.make || "—"} />
                        <Detail label="Model" value={vehicle.model || "—"} />
                        <Detail label="Manufacturing Year" value={vehicle.year ? String(vehicle.year) : "—"} />
                        <Detail label="Fitness Expiry" value={dateLabel(vehicle.fitness_expiry_date)} />
                        <Detail label="PUC Expiry" value={dateLabel(vehicle.puc_expiry_date)} />
                        <Detail label="Road Tax Expiry" value={dateLabel(vehicle.road_tax_expiry_date)} />
                        <Detail label="National Permit" value={dateLabel(vehicle.national_permit_expiry_date)} />
                        <Detail label="Local Permit" value={dateLabel(vehicle.local_permit_expiry_date)} />
                      </div>

                      {policies.length ? (
                        <div className="border-t border-[#E8EDF4] px-3.5 py-2.5">
                          <p className="mb-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#6B7F9A]">Linked Policies</p>
                          <div className="space-y-2">
                            {policies.map((policy, index) => {
                              const policyState = policyLifecycle(policy.end_date);
                              return (
                                <Link
                                  key={policy.policy_id}
                                  href={"/partner/policies/" + encodeURIComponent(policy.policy_id)}
                                  prefetch={false}
                                  className="group grid gap-2 rounded-lg border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white sm:grid-cols-[minmax(190px,1.3fr)_repeat(4,minmax(100px,.65fr))_auto] sm:items-center"
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
                                  <CompactField label="Status" value={policyState} tone={policyState === "Active" ? "green" : "red"} />
                                  <span className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#CCD9EA] bg-white px-3 text-[8px] font-bold text-[#174A91]">Policy Details <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {claims.length ? (
                        <div className="border-t border-[#E8EDF4] px-3.5 py-2.5">
                          <p className="mb-2 text-[8px] font-black uppercase tracking-[0.06em] text-[#6B7F9A]">Linked Claims</p>
                          <div className="space-y-2">
                            {claims.map((claim) => (
                              <Link
                                key={claim.claim_id}
                                href={"/partner/claims/" + encodeURIComponent(claim.claim_id)}
                                prefetch={false}
                                className="group flex items-center gap-3 rounded-lg border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white"
                              >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFF1E8] text-[#DE6B22]">
                                  <ClipboardList className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-[9.5px] font-extrabold text-[#173A69]">{claim.claim_no || "Claim"}</p>
                                  <p className="mt-0.5 break-words text-[8px] font-medium text-[#7A8CA4]">{display(claim.insurer_name, dateLabel(claim.created_at)) || "Claim details"}</p>
                                </div>
                                <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[8px] font-bold text-[#425672]">{statusLabel(claim.current_status)}</span>
                                <ArrowRight className="h-3.5 w-3.5 text-[#176AF0] transition group-hover:translate-x-0.5" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Car className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[11px] font-bold text-[#23395D]">No vehicles recorded.</p>
              </div>
            )}
          </div>
        </details>

        <section className="overflow-hidden rounded-2xl border border-[#DDE4EE] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.035)]">
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6E1EE] bg-[#F4F7FB] px-2.5 text-[11px] font-semibold text-[#2563EB]">
              <CarFront className="h-4 w-4" />
              Add Vehicle
            </span>
            <div className="flex items-center justify-end gap-2">
              <Link
                href="/partner/customers"
                className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]"
              >
                Back
              </Link>
              {data.summary.policies > 0 ? (
                <Link
                  href="/partner/policies"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-[#B8C7DC] bg-[#F7F9FC] px-4 text-[10.5px] font-semibold text-[#173E7B] transition hover:border-[#8EA5C3] hover:bg-[#EEF3F9]"
                >
                  View Policies
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-white/15 px-3 py-2.5 sm:border-r xl:border-b-0 xl:last:border-r-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 text-white">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.07em] text-white/65">{label}</p>
        <p className="mt-0.5 truncate text-[9px] font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#68758A]">{label}</p>
      <div className="relative flex h-8 items-center rounded-md border border-[#D8E0EA] bg-white px-2.5 text-[11.5px] text-[#334155]">
        <span className="truncate">{value}</span>
        {hint ? <span className="ml-auto pl-2 text-[8px] text-[#9AA6B5]">{hint}</span> : null}
      </div>
    </div>
  );
}

function DocumentPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-[#E0E5EE] bg-white p-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#EEF1FF] text-[#315FEA]">↥</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-semibold text-[#172033]">{label}</p>
          <p className="truncate text-[9px] text-[#8A96A8]">Not available in Partner view</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">Unavailable</span>
      </div>
      <div className="mt-2 flex h-7 items-center justify-center rounded-md border border-dashed border-[#C8D2E0] bg-white text-[9.5px] font-semibold text-[#94A0AF]">Document access not exposed</div>
    </div>
  );
}

function ActivityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-[#E6EBF1] px-4 py-3 sm:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="text-[8px] font-bold uppercase tracking-[0.06em] text-[#8190A4]">{label}</p>
      <p className="mt-1 text-[16px] font-extrabold text-[#183A64]">{value}</p>
    </div>
  );
}

function CompactField({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "green" | "red" }) {
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
