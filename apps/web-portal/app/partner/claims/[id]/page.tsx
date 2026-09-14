import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CircleCheck,
  ClipboardList,
  FileText,
  Headphones,
  Landmark,
  MapPin,
  ReceiptIndianRupee,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";
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
      <div className="space-y-3 pb-4">
        <Link href="/partner/claims" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D5DFEA] bg-white px-3 text-[10px] font-bold text-[#24405F] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
          <ArrowLeft className="h-3.5 w-3.5" /> Claim Register
        </Link>

        <section className="overflow-hidden rounded-xl bg-gradient-to-r from-[#06285D] via-[#0A458A] to-[#0C57B3] text-white shadow-[0_8px_24px_rgba(13,64,128,0.18)]">
          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/12 text-white shadow-sm"><ShieldAlert className="h-7 w-7" /></span>
                <h1 className="break-words text-[22px] font-black tracking-[-0.03em] sm:text-[24px]">{data.customer.name}</h1>
              </div>
              <span className="inline-flex w-fit rounded-full bg-white/10 px-3.5 py-1.5 text-[9px] font-bold text-white ring-1 ring-inset ring-white/15">{humanize(data.claim.claim_service_mode || "Service mode not recorded")}</span>
            </div>

            <div className="mt-4 grid border-t border-white/20 sm:grid-cols-2 xl:grid-cols-7">
              <HeroItem icon={ShieldCheck} label="Current Status" value={humanize(data.claim.current_status || "Status not recorded")} />
              <HeroItem icon={FileText} label="Control Number" value={data.claim.claim_no || "Not recorded"} />
              <HeroItem icon={Car} label="External Policy" value={data.vehicle.vehicle_no || "Not recorded"} />
              <HeroItem icon={Landmark} label="Insurer" value={data.insurer.name || "Not recorded"} />
              <HeroItem icon={ClipboardList} label="Insurer Claim No." value={data.claim.insurer_claim_no || "Not recorded"} />
              <HeroItem icon={ShieldCheck} label="Policy" value={data.policy.policy_no || "External policy"} />
              <HeroItem icon={CalendarDays} label="Last Updated" value={dateTime(data.claim.updated_at)} />
            </div>
          </div>
        </section>

        {needsAttention(data.claim.assistance_status) ? (
          <section className="flex items-start gap-3 rounded-xl border border-[#F3D8A8] bg-[#FFF9EF] px-4 py-3.5 sm:px-5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF0CF] text-[#E78A00]"><ShieldAlert className="h-4 w-4" /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#C77700]">Needs Attention</p>
              <p className="mt-1 break-words text-[10.5px] font-semibold leading-4 text-[#6E4B10]">Assistance is {humanize(data.claim.assistance_status)}. Check the latest update or contact Support.</p>
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
            <CardHeading icon={ShieldAlert} title="Claim Overview" description="Key details about this claim" iconClassName="bg-[#EEF4FF] text-[#176AF0]" />
            <div className="grid gap-x-5 gap-y-4 px-4 pb-4 sm:grid-cols-2">
              <Detail icon={CalendarDays} label="Accident Date" value={dateTime(data.claim.accident_at)} />
              <Detail icon={MapPin} label="Location" value={data.claim.accident_location || "Not recorded"} />
              <Detail icon={Headphones} label="Assistance" value={humanize(data.claim.assistance_status || "Not requested")} />
              <Detail icon={FileText} label="Created" value={dateTime(data.claim.created_at)} />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
            <CardHeading icon={ReceiptIndianRupee} title="Financial Snapshot" description="Claim financials at a glance" iconClassName="bg-[#EAFBF5] text-[#1BAA78]" />
            <div className="mx-4 mb-4 grid overflow-hidden rounded-xl border border-[#DDE6F0] bg-[#F8FBFF] sm:grid-cols-3">
              <Amount icon={ReceiptIndianRupee} label="Estimated Loss" value={currency(data.claim.estimated_loss)} iconClassName="bg-[#F3E8FF] text-[#8B5CF6]" />
              <Amount icon={CircleCheck} label="Approved" value={currency(data.claim.approved_amount)} iconClassName="bg-[#E4F8EE] text-[#18A66E]" />
              <Amount icon={ClipboardList} label="Settlement" value={currency(data.claim.settlement_amount)} iconClassName="bg-[#EAF3FF] text-[#176AF0]" />
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
          <CardHeading icon={UserRound} title="Customer & Risk" description="Customer and vehicle information" iconClassName="bg-[#F2E9FF] text-[#8A4DF0]" />
          <div className="grid gap-0 px-4 pb-4 lg:grid-cols-2">
            <Link href={"/partner/customers/" + encodeURIComponent(data.customer.id)} className="flex items-center gap-3 py-3.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 lg:border-r lg:border-[#E0E7EF] lg:pr-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><UserRound className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block break-words text-[11px] font-extrabold leading-4 text-[#1B2F4E]">{data.customer.name}</span><span className="mt-0.5 block break-words text-[9.5px] leading-4 text-[#74839A]">{data.customer.customer_code || "Customer"}</span></span>
            </Link>
            <div className="flex items-center gap-3 py-3.5 lg:pl-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><Car className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block break-words text-[11px] font-extrabold leading-4 text-[#1B2F4E]">{data.vehicle.vehicle_no || "Vehicle not linked"}</span><span className="mt-0.5 block break-words text-[9.5px] leading-4 text-[#74839A]">{data.policy.policy_no || "External policy"}</span></span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)]">
          <div className="px-4 py-3">
            <PartnerSectionHeading title="Claim Journey" description={events.length + (events.length === 1 ? " event" : " events")} />
          </div>
          {events.length ? (
            <div className="space-y-0 border-t border-[#E7EDF4] px-4 py-4">
              {events.map((event, index) => (
                <div key={event.key} className="grid grid-cols-[22px_minmax(0,1fr)] gap-3">
                  <div className="flex flex-col items-center">
                    <span className={"mt-1 h-3 w-3 rounded-full border-2 border-white shadow " + (index === events.length - 1 ? "bg-[#3156B8]" : "bg-[#BFC8D4]")} />
                    {index < events.length - 1 ? <span className="min-h-12 w-px flex-1 bg-[#DDE4ED]" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#3156B8]">{event.kind}</p>
                    <p className="mt-1 break-words text-[11px] font-extrabold leading-4 text-[#1B2F4E]">{event.title}</p>
                    <p className="mt-1 text-[9.5px] font-medium text-[#7A899F]">{dateTime(event.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="border-t border-[#E7EDF4] px-5 py-8 text-center text-[10.5px] font-medium text-[#7A899F]">Claim updates will appear here.</div>}
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function HeroItem({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-white/15 py-3 sm:border-r sm:px-3 xl:border-b-0 xl:first:pl-0 xl:last:border-r-0 xl:last:pr-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0"><p className="text-[7.5px] font-medium text-white/65">{label}</p><p className="mt-1 break-words text-[9.5px] font-bold leading-4 text-white">{value}</p></div>
    </div>
  );
}

function CardHeading({ icon: Icon, title, description, iconClassName }: { icon: typeof ShieldAlert; title: string; description: string; iconClassName: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconClassName}`}><Icon className="h-4 w-4" /></span>
      <div><h2 className="text-[13px] font-black text-[#142B50]">{title}</h2><p className="mt-0.5 text-[9px] font-medium text-[#7489A5]">{description}</p></div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#176AF0]"><Icon className="h-4 w-4" /></span>
      <div><p className="text-[8px] font-black uppercase tracking-[0.06em] text-[#7589A5]">{label}</p><p className="mt-1 break-words text-[10px] font-semibold leading-4 text-[#203653]">{value}</p></div>
    </div>
  );
}

function Amount({ icon: Icon, label, value, iconClassName }: { icon: typeof ReceiptIndianRupee; label: string; value: string; iconClassName: string }) {
  return (
    <div className="border-b border-[#E0E7EF] px-3 py-4 text-center sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full ${iconClassName}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-2 text-[8px] font-black uppercase tracking-[0.08em] text-[#75849A]">{label}</p>
      <p className="mt-1 break-words text-[12px] font-extrabold leading-4 text-[#162746]">{value}</p>
    </div>
  );
}
