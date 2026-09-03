import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Car, ClipboardList, Mail, MapPin, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebCustomerDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function statusLabel(value: string | null) {
  return (value || "active").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      <div className="space-y-7">
        <Link href="/partner/customers" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]">
          <ArrowLeft className="h-3.5 w-3.5" /> Customer Register
        </Link>

        <section className="overflow-hidden border-y border-[#DCE4ED] bg-white/45">
          <div className="flex flex-col gap-4 border-b border-[#E6ECF3] px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6F8098]">{customer.customer_code || "Customer"}</p>
                <h2 className="mt-1 truncate text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">{customer.customer_name}</h2>
                <p className="mt-1 text-[10.5px] font-medium text-[#74839A]">{customer.company_name || customer.contact_name || customer.customer_type || "Customer record"}</p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-xl bg-[#EEF3F8] px-3 py-1.5 text-[9.5px] font-bold text-[#425672]">{statusLabel(customer.status)}</span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <Contact icon={Phone} label="Phone" value={customer.phone || "Not recorded"} />
            <Contact icon={Mail} label="Email" value={customer.email || "Not recorded"} />
            <Contact icon={MapPin} label="Location" value={[customer.city, customer.state].filter(Boolean).join(", ") || "Not recorded"} />
            <Contact icon={Building2} label="Relationship" value={display(customer.intermediary_type, customer.intermediary_code) || "Partner scope"} />
          </div>
        </section>

        <section className="grid border-y border-[#DCE4ED] sm:grid-cols-2 xl:grid-cols-4">
          <Summary icon={ShieldCheck} label="Policies" value={data.summary.policies} />
          <Summary icon={Car} label="Vehicles" value={data.summary.vehicles} />
          <Summary icon={ClipboardList} label="Claims" value={data.summary.claims} />
          <Summary icon={RefreshCw} label="Renewals 30d" value={data.summary.renewals_30_days} />
        </section>

        <section className="py-1">
          <SectionTitle title="Policies" meta={String(data.policies.length) + " visible"} />
          {data.policies.length ? (
            <div className="mt-3 divide-y divide-[#E8EDF4]">
              {data.policies.map((policy) => (
                <Link key={policy.policy_id} href={"/partner/policies/" + encodeURIComponent(policy.policy_id)} prefetch={false} className="group grid gap-2 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(160px,.8fr)_minmax(130px,.6fr)_auto] lg:items-center">
                  <div>
                    <p className="text-[11.5px] font-extrabold text-[#1B2F4E]">{policy.policy_no || policy.policy_code || "Policy"}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-[#74839A]">{display(policy.policy_type, policy.policy_product, policy.vehicle_no) || "Policy details"}</p>
                  </div>
                  <p className="text-[10px] font-semibold text-[#536680]">{policy.insurer_name || "Insurer not recorded"}</p>
                  <div>
                    <p className="text-[10px] font-bold text-[#203653]">{currency(policy.premium_amount)}</p>
                    <p className="mt-0.5 text-[9px] text-[#8190A5]">Ends {dateLabel(policy.end_date)}</p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 lg:block" />
                </Link>
              ))}
            </div>
          ) : <Empty text="No scoped policies recorded." />}
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="py-1">
            <SectionTitle title="Vehicles" meta={String(data.vehicles.length) + " visible"} />
            {data.vehicles.length ? (
              <div className="mt-3 divide-y divide-[#E8EDF4]">
                {data.vehicles.map((vehicle) => (
                  <div key={vehicle.vehicle_id} className="py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F3F6FA] text-[#3156B8]"><Car className="h-4 w-4" /></span>
                      <div>
                        <p className="text-[11px] font-extrabold text-[#1B2F4E]">{vehicle.vehicle_no || "Vehicle"}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-[#74839A]">{display(vehicle.make, vehicle.model, vehicle.year, vehicle.vehicle_type) || "Vehicle details"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Expiry label="PUC" value={vehicle.puc_expiry_date} />
                          <Expiry label="Fitness" value={vehicle.fitness_expiry_date} />
                          <Expiry label="Road Tax" value={vehicle.road_tax_expiry_date} />
                          <Expiry label="National Permit" value={vehicle.national_permit_expiry_date} />
                          <Expiry label="Local Permit" value={vehicle.local_permit_expiry_date} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty text="No vehicles recorded." />}
          </section>

          <section className="py-1">
            <SectionTitle title="Claims" meta={String(data.claims.length) + " visible"} />
            {data.claims.length ? (
              <div className="mt-3 divide-y divide-[#E8EDF4]">
                {data.claims.map((claim) => (
                  <Link key={claim.claim_id} href={"/partner/claims/" + encodeURIComponent(claim.claim_id)} prefetch={false} className="group flex items-center gap-3 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFF6E7] text-[#B56A00]"><ClipboardList className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-extrabold text-[#1B2F4E]">{claim.claim_no || "Claim"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#74839A]">{display(claim.vehicle_no, claim.insurer_name) || "Claim details"}</p>
                      <span className="mt-1.5 inline-flex rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{statusLabel(claim.current_status)}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
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
    <div className="flex items-center gap-3 border-b border-[#E6ECF3] px-5 py-4 last:border-b-0 sm:border-r sm:px-6 xl:border-b-0 xl:last:border-r-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3F6FA] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#7A899F]">{label}</p>
        <p className="mt-1 truncate text-[10.5px] font-bold text-[#203653]">{value}</p>
      </div>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#E0E7EF] px-1 py-4 sm:border-r sm:px-4 xl:border-b-0 xl:last:border-r-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-[20px] font-extrabold text-[#162746]">{value}</p>
        <p className="text-[9px] font-bold uppercase tracking-[0.09em] text-[#75849A]">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
  return <PartnerSectionHeading title={title} description={meta} />;
}

function Empty({ text }: { text: string }) {
  return <div className="mt-3 border-y border-[#E0E7EF] py-8 text-center text-[10.5px] font-medium text-[#7A899F]">{text}</div>;
}

function Expiry({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <span className="rounded-lg bg-[#F3F6FA] px-2 py-1 text-[8.5px] font-semibold text-[#5E718D]">{label}: {dateLabel(value)}</span>;
}
