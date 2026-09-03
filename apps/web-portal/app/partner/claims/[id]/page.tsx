import Link from "next/link";
import { ArrowLeft, MapPin, ShieldAlert, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebClaimDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  if (value == null) return "—";
  const amount = Number(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}
function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function needsAttention(value: string | null) {
  const normalized = (value || "").toLowerCase().replaceAll("_", " ").trim();
  return normalized.includes("requested") || normalized.includes("pending") || normalized.includes("open");
}

export default async function PartnerClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPartnerWebClaimDetail(id);
  const events = [
    { key: "created", title: "Claim recorded", kind: "Claim created", date: data.claim.created_at },
    ...data.status_history.map((item) => ({ key: "status-" + item.id, title: humanize(item.to_status || "Status updated"), kind: "Status update", date: item.created_at })),
    ...data.stages.map((item) => ({ key: "stage-" + item.id, title: humanize(item.stage), kind: "Claim stage", date: item.created_at })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <PartnerPortalShell title="Claim Detail">
      <div className="space-y-7">
        <Link href="/partner/claims" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]">
          <ArrowLeft className="h-3.5 w-3.5" /> Claim Register
        </Link>

        <section className="overflow-hidden border-y border-[#DCE4ED] bg-white/45">
          <div className="flex flex-col gap-4 border-b border-[#E6ECF3] px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFF6E7] text-[#B56A00]"><ShieldAlert className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6F8098]">Current Status</p>
                <h2 className="mt-1 truncate text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">{humanize(data.claim.current_status || "Status not recorded")}</h2>
                <p className="mt-1 text-[10.5px] font-medium text-[#74839A]">{[data.claim.claim_no, data.customer.name, data.vehicle.vehicle_no].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-xl bg-[#EEF3F8] px-3 py-1.5 text-[9.5px] font-bold text-[#425672]">{humanize(data.claim.claim_service_mode || "Service mode not recorded")}</span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric label="Insurer" value={data.insurer.name || "Not recorded"} />
            <HeroMetric label="Insurer Claim No." value={data.claim.insurer_claim_no || "Not recorded"} />
            <HeroMetric label="Policy" value={data.policy.policy_no || "External policy"} />
            <HeroMetric label="Last Updated" value={dateTime(data.claim.updated_at)} />
          </div>
        </section>

        {needsAttention(data.claim.assistance_status) ? (
          <section className="rounded-[22px] border border-[#F3D8A8] bg-[#FFF9EF] px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#A86600]">Partner Attention</p>
            <p className="mt-1 text-[11px] font-semibold text-[#6E4B10]">Assistance is {humanize(data.claim.assistance_status)}. Review the latest journey update or contact Support if clarification is needed.</p>
          </section>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="py-1">
            <PartnerSectionHeading title="Claim Overview" />
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <Info label="Accident Date" value={dateTime(data.claim.accident_at)} />
              <Info label="Location" value={data.claim.accident_location || "Not recorded"} />
              <Info label="Assistance" value={humanize(data.claim.assistance_status || "Not requested")} />
              <Info label="Created" value={dateTime(data.claim.created_at)} />
            </div>
          </section>

          <section className="py-1">
            <PartnerSectionHeading title="Financial Snapshot" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Amount label="Estimated Loss" value={currency(data.claim.estimated_loss)} />
              <Amount label="Approved" value={currency(data.claim.approved_amount)} />
              <Amount label="Settlement" value={currency(data.claim.settlement_amount)} />
            </div>
          </section>
        </div>

        <section className="py-1">
          <PartnerSectionHeading title="Customer & Risk" />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Link href={"/partner/customers/" + encodeURIComponent(data.customer.id)} className="flex items-center gap-3 border-b border-[#E0E7EF] py-3.5 last:border-b-0">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#3156B8]"><UserRound className="h-4 w-4" /></span>
              <span><span className="block text-[11px] font-extrabold text-[#1B2F4E]">{data.customer.name}</span><span className="mt-0.5 block text-[9.5px] text-[#74839A]">{data.customer.customer_code || "Customer"}</span></span>
            </Link>
            <div className="flex items-center gap-3 border-b border-[#E0E7EF] py-3.5 last:border-b-0">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#3156B8]"><MapPin className="h-4 w-4" /></span>
              <span><span className="block text-[11px] font-extrabold text-[#1B2F4E]">{data.vehicle.vehicle_no || "Vehicle not linked"}</span><span className="mt-0.5 block text-[9.5px] text-[#74839A]">{data.policy.policy_no || "External policy"}</span></span>
            </div>
          </div>
        </section>

        <section className="py-1">
          <PartnerSectionHeading title="Claim Journey" description={events.length + " recorded events"} />
          {events.length ? (
            <div className="mt-5 space-y-0">
              {events.map((event, index) => (
                <div key={event.key} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
                  <div className="flex flex-col items-center">
                    <span className={"mt-1 h-3 w-3 rounded-full border-2 border-white shadow " + (index === events.length - 1 ? "bg-[#3156B8]" : "bg-[#BFC8D4]")} />
                    {index < events.length - 1 ? <span className="min-h-12 w-px flex-1 bg-[#DDE4ED]" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#3156B8]">{event.kind}</p>
                    <p className="mt-1 text-[11px] font-extrabold text-[#1B2F4E]">{event.title}</p>
                    <p className="mt-1 text-[9.5px] font-medium text-[#7A899F]">{dateTime(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="mt-4 border-y border-[#E0E7EF] py-8 text-center text-[10.5px] font-medium text-[#7A899F]">Recorded claim stages and status updates will appear here.</div>}
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#E6ECF3] px-5 py-4 sm:border-r sm:px-6 xl:border-b-0 xl:last:border-r-0"><p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#7A899F]">{label}</p><p className="mt-1.5 truncate text-[10.5px] font-extrabold text-[#203653]">{value}</p></div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[8.5px] font-black uppercase tracking-[0.1em] text-[#8390A3]">{label}</p><p className="mt-1 text-[10.5px] font-semibold text-[#203653]">{value}</p></div>; }
function Amount({ label, value }: { label: string; value: string }) { return <div className="border-r border-[#E0E7EF] py-3 text-center last:border-r-0"><p className="text-[13px] font-extrabold text-[#162746]">{value}</p><p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#75849A]">{label}</p></div>; }
