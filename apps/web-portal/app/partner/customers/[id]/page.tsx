import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Car, ClipboardList, FileText, Mail, MapPin, MoreHorizontal, Phone, Plus, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
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
  return values.map((value) => value == null ? "" : String(value).trim()).filter(Boolean).join(" · ");
}

export default async function PartnerCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebCustomerDetail(id);
  const customer = data.customer;

  return (
    <PartnerPortalShell title="Customer Detail">
      <div className="space-y-3 pb-4">
        <Link href="/partner/customers" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[10px] font-bold text-[#24405F] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Customer Register
        </Link>

        <section className="overflow-hidden rounded-xl bg-gradient-to-r from-[#06285D] via-[#0A458A] to-[#0C57B3] text-white shadow-[0_8px_24px_rgba(13,64,128,0.18)]">
          <div className="px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-[#176AF0] shadow-sm"><UserRound className="h-7 w-7" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-[22px] font-black tracking-[-0.03em] sm:text-[24px]">{customer.customer_name}</h1>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#24C684] text-[10px] font-black text-white">✓</span>
                </div>
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#0B7D66] px-2.5 py-1 text-[9px] font-bold"><span className="h-1.5 w-1.5 rounded-full bg-[#37E5A3]" />{statusLabel(customer.status)}</span>
              </div>
            </div>

            <div className="mt-4 grid border-t border-white/20 sm:grid-cols-2 xl:grid-cols-5">
              <Contact icon={FileText} label="Customer Code" value={customer.customer_code || "Not recorded"} />
              <Contact icon={Phone} label="Phone" value={customer.phone || "Not recorded"} />
              <Contact icon={Mail} label="Email" value={customer.email || "Not recorded"} />
              <Contact icon={MapPin} label="Location" value={[customer.city, customer.state].filter(Boolean).join(", ") || "Not recorded"} />
              <Contact icon={Building2} label="Relationship" value={display(customer.intermediary_type, customer.intermediary_code) || "Not recorded"} />
            </div>
          </div>
        </section>

        <nav className="flex gap-7 border-b border-[#DCE5EF] px-1 text-[10px] font-bold text-[#334B69]">
          <span className="border-b-2 border-[#1670F4] px-2 py-3 text-[#1670F4]">Policies ({data.summary.policies})</span>
          <span className="px-2 py-3">Vehicles ({data.summary.vehicles})</span>
          <span className="px-2 py-3">Claims ({data.summary.claims})</span>
          <span className="px-2 py-3">Renewals ({data.summary.renewals_30_days})</span>
        </nav>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E7EDF4] px-4 py-3">
            <h2 className="text-[14px] font-black text-[#142B50]">Policies ({data.policies.length})</h2>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1670F4] px-3.5 text-[10px] font-bold text-white"><Plus className="h-4 w-4" /> Add Policy</span>
          </div>
          {data.policies.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1.2fr_1fr_.7fr_.7fr_.7fr_.65fr_.45fr] gap-4 bg-[#F5F8FC] px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.05em] text-[#6580A3]">
                  <span>Policy Number</span><span>Insurer</span><span>Type</span><span>Start Date</span><span>Expiry Date</span><span>Status</span><span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-[#E8EDF4]">
                  {data.policies.map((policy) => {
                    const lifecycle = policyLifecycle(policy.end_date);
                    return (
                      <Link key={policy.policy_id} href={"/partner/policies/" + encodeURIComponent(policy.policy_id)} prefetch={false} className="group grid grid-cols-[1.2fr_1fr_.7fr_.7fr_.7fr_.65fr_.45fr] items-center gap-4 px-4 py-3.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                        <span className="break-words text-[10px] font-extrabold text-[#183657]">{policy.policy_no || policy.policy_code || "Policy"}</span>
                        <span className="break-words text-[9.5px] font-medium text-[#4E6683]">{policy.insurer_name || "Insurer not recorded"}</span>
                        <span className="text-[9.5px] text-[#4E6683]">{policy.policy_type || policy.policy_product || "—"}</span>
                        <span className="text-[9.5px] text-[#4E6683]">—</span>
                        <span className="text-[9.5px] text-[#4E6683]">{dateLabel(policy.end_date)}</span>
                        <span className={"inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[8.5px] font-bold " + (lifecycle === "Expired" ? "bg-[#FFE9E9] text-[#C94A4A]" : "bg-[#E7F8EF] text-[#15915B]")}><span className="h-1.5 w-1.5 rounded-full bg-current" />{lifecycle}</span>
                        <span className="flex justify-end gap-2 text-[#176AF0]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#EEF4FF]"><ArrowRight className="h-3.5 w-3.5" /></span><span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3F6FA]"><MoreHorizontal className="h-3.5 w-3.5" /></span></span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : <Empty text="No policies recorded." />}
        </section>

        <div className="grid gap-3 xl:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
            <div className="flex items-center justify-between border-b border-[#E7EDF4] px-4 py-3">
              <h2 className="text-[14px] font-black text-[#142B50]">Vehicles ({data.vehicles.length})</h2>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1670F4] px-3.5 text-[10px] font-bold text-white"><Plus className="h-4 w-4" /> Add Vehicle</span>
            </div>
            {data.vehicles.length ? (
              <div className="divide-y divide-[#E8EDF4] px-4">
                {data.vehicles.map((vehicle) => (
                  <div key={vehicle.vehicle_id} className="py-3.5">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_.6fr_auto] sm:items-center">
                      <div><p className="text-[8px] font-black uppercase tracking-[0.05em] text-[#6E819D]">Vehicle / Chassis</p><p className="mt-1 text-[10px] font-extrabold text-[#1B3152]">{vehicle.vehicle_no || "Vehicle"}</p></div>
                      <div><p className="text-[8px] font-black uppercase tracking-[0.05em] text-[#6E819D]">Make & Model</p><p className="mt-1 text-[10px] font-semibold text-[#35506F]">{display(vehicle.make, vehicle.model) || "Vehicle details"}</p></div>
                      <div><p className="text-[8px] font-black uppercase tracking-[0.05em] text-[#6E819D]">Type</p><p className="mt-1 text-[10px] font-semibold text-[#35506F]">{vehicle.vehicle_type || "—"}</p></div>
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><Car className="h-3.5 w-3.5" /></span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Expiry label="PUC" value={vehicle.puc_expiry_date} />
                      <Expiry label="Fitness" value={vehicle.fitness_expiry_date} />
                      <Expiry label="Road Tax" value={vehicle.road_tax_expiry_date} />
                      <Expiry label="National Permit" value={vehicle.national_permit_expiry_date} />
                      <Expiry label="Local Permit" value={vehicle.local_permit_expiry_date} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty text="No vehicles recorded." />}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
            <div className="flex items-center justify-between border-b border-[#E7EDF4] px-4 py-3">
              <h2 className="text-[14px] font-black text-[#142B50]">Claims ({data.claims.length})</h2>
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1670F4] px-3.5 text-[10px] font-bold text-white"><Plus className="h-4 w-4" /> Add Claim</span>
            </div>
            {data.claims.length ? (
              <div className="divide-y divide-[#E8EDF4] px-4">
                {data.claims.map((claim) => (
                  <Link key={claim.claim_id} href={"/partner/claims/" + encodeURIComponent(claim.claim_id)} prefetch={false} className="group flex items-center gap-3 py-3.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><ClipboardList className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1"><p className="break-words text-[10px] font-extrabold text-[#1B3152]">{claim.claim_no || "Claim"}</p><p className="mt-0.5 break-words text-[9px] text-[#7489A5]">{display(claim.vehicle_no, claim.insurer_name) || "Claim details"}</p></div>
                    <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[8.5px] font-bold text-[#425672]">{statusLabel(claim.current_status)}</span>
                    <ArrowRight className="h-4 w-4 text-[#176AF0] transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            ) : <Empty text="No claims recorded." />}
          </section>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function Contact({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/15 py-3 sm:border-r sm:px-4 xl:border-b-0 xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[0.08em] text-white/65">{label}</p><p className="mt-1 break-words text-[10px] font-bold text-white">{value}</p></div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-12 text-center"><ClipboardList className="mx-auto h-7 w-7 text-[#9AABC0]" /><p className="mt-3 text-[11px] font-bold text-[#23395D]">{text}</p></div>;
}

function Expiry({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <span className="rounded-lg bg-[#F3F6FA] px-2 py-1 text-[8.5px] font-semibold text-[#5E718D]">{label}: {dateLabel(value)}</span>;
}
