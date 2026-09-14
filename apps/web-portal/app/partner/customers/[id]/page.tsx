import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
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
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function statusLabel(value: string | null) {
  return (value || "active").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function policyLifecycle(endDate: string | null) {
  if (!endDate) return "Active";
  const parsed = new Date(endDate.length === 10 ? endDate + "T23:59:59" : endDate);
  if (Number.isNaN(parsed.getTime())) return "Active";
  return parsed.getTime() < Date.now() ? "Expired" : "Active";
}

function display(...values: Array<string | number | null | undefined>) {
  return values.map((value) => (value == null ? "" : String(value).trim())).filter(Boolean).join(" · ");
}

function vehicleKey(value: string | null | undefined) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default async function PartnerCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebCustomerDetail(id);
  const customer = data.customer;

  return (
    <PartnerPortalShell title="Customer Detail">
      <div className="space-y-3 pb-4">
        <Link
          href="/partner/customers"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[10px] font-bold text-[#24405F] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Register
        </Link>

        <section className="overflow-hidden rounded-xl bg-gradient-to-r from-[#06285D] via-[#0A458A] to-[#0C57B3] text-white shadow-[0_8px_24px_rgba(13,64,128,0.16)]">
          <div className="px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex min-w-0 items-center gap-3 xl:min-w-[270px]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#176AF0] shadow-sm">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="break-words text-[18px] font-black tracking-[-0.03em] sm:text-[20px]">{customer.customer_name}</h1>
                    <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-[#24C684] text-[9px] font-black text-white">✓</span>
                  </div>
                  <span className="mt-1 inline-flex rounded-full bg-[#16A86A] px-2 py-0.5 text-[8px] font-bold text-white">Active</span>
                </div>
              </div>

              <div className="grid flex-1 border-t border-white/20 sm:grid-cols-2 xl:grid-cols-5 xl:border-l xl:border-t-0">
                <Contact icon={FileText} label="Customer Code" value={customer.customer_code || "Not recorded"} />
                <Contact icon={Phone} label="Phone" value={customer.phone || "Not recorded"} />
                <Contact icon={Mail} label="Email" value={customer.email || "Not recorded"} />
                <Contact icon={MapPin} label="Location" value={[customer.city, customer.state].filter(Boolean).join(", ") || "Not recorded"} />
                <Contact icon={Building2} label="Relationship" value={display(customer.intermediary_type, customer.intermediary_code) || "Not recorded"} />
              </div>
            </div>
          </div>
        </section>

        <nav className="flex flex-wrap gap-6 border-b border-[#DCE5EF] px-1 text-[10px] font-bold text-[#334B69]">
          <span className="border-b-2 border-[#1670F4] px-2 py-2.5 text-[#1670F4]">Vehicles ({data.summary.vehicles})</span>
          <span className="px-2 py-2.5">Policies ({data.summary.policies})</span>
          <span className="px-2 py-2.5">Claims ({data.summary.claims})</span>
          <span className="px-2 py-2.5">Renewals ({data.summary.renewals_30_days})</span>
        </nav>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E7EDF4] px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EEF4FF] text-[#176AF0]"><Car className="h-4 w-4" /></span>
              <div>
                <h2 className="text-[13px] font-black text-[#142B50]">Vehicles ({data.vehicles.length})</h2>
                <p className="text-[8.5px] font-medium text-[#7A8BA2]">Vehicle details with linked policy and claim records</p>
              </div>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1670F4] px-3 text-[9px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Add Vehicle</span>
          </div>

          {data.vehicles.length ? (
            <div className="space-y-3 bg-[#F7F9FC] p-3">
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
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#176AF0]"><Car className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words text-[11px] font-black text-[#15345C]">{vehicle.vehicle_no || "Vehicle"}</p>
                            {vehicle.vehicle_type ? <span className="rounded-full border border-[#D7E0EC] bg-[#F5F8FC] px-2 py-0.5 text-[7.5px] font-bold text-[#60748F]">{vehicle.vehicle_type}</span> : null}
                          </div>
                          <p className="mt-0.5 truncate text-[8.5px] font-medium text-[#7A8DA7]">{display(vehicle.make, vehicle.model, vehicle.year) || "Vehicle details"}</p>
                        </div>
                      </div>
                      <CompactField label="Make" value={vehicle.make || "—"} />
                      <CompactField label="Model" value={vehicle.model || "—"} />
                      <CompactField label="Year" value={vehicle.year || "—"} />
                      <CompactField label="Policy Status" value={lifecycle || "No linked policy"} tone={lifecycle === "Active" ? "green" : lifecycle === "Expired" ? "red" : "neutral"} />
                      {currentPolicy ? (
                        <Link href={"/partner/policies/" + encodeURIComponent(currentPolicy.policy_id)} prefetch={false} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#123D82] px-3 text-[8.5px] font-bold text-white transition hover:bg-[#0D326D]">
                          <FileText className="h-3.5 w-3.5" /> View Policy
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
                              <Link key={policy.policy_id} href={"/partner/policies/" + encodeURIComponent(policy.policy_id)} prefetch={false} className="group grid gap-2 rounded-lg border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white sm:grid-cols-[minmax(190px,1.3fr)_repeat(4,minmax(100px,.65fr))_auto] sm:items-center">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EAF8F1] text-[#1B9A63]"><ShieldCheck className="h-4 w-4" /></span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="truncate text-[9.5px] font-extrabold text-[#173A69]">{policy.policy_no || policy.policy_code || "Policy"}</p>
                                      {index === 0 ? <span className="rounded-full border border-[#BDEBD3] bg-[#ECFAF3] px-1.5 py-0.5 text-[7px] font-bold text-[#15915B]">Latest</span> : null}
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
                            <Link key={claim.claim_id} href={"/partner/claims/" + encodeURIComponent(claim.claim_id)} prefetch={false} className="group flex items-center gap-3 rounded-lg border border-[#E3EAF2] bg-[#FBFCFE] px-3 py-2.5 transition hover:border-[#C9D9ED] hover:bg-white">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFF1E8] text-[#DE6B22]"><ClipboardList className="h-4 w-4" /></span>
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
            <div className="px-5 py-12 text-center"><Car className="mx-auto h-7 w-7 text-[#9AABC0]" /><p className="mt-3 text-[11px] font-bold text-[#23395D]">No vehicles recorded.</p></div>
          )}
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Contact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-white/15 py-2.5 sm:border-r sm:px-3 xl:border-b-0 xl:first:pl-3 xl:last:border-r-0 xl:last:pr-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0"><p className="text-[7px] font-black uppercase tracking-[0.08em] text-white/65">{label}</p><p className="mt-0.5 break-words text-[9px] font-bold text-white">{value}</p></div>
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
        <span className={"mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7.5px] font-bold " + (tone === "green" ? "bg-[#E7F8EF] text-[#15915B]" : "bg-[#FFE9E9] text-[#C94A4A]")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{value}</span>
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
