import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, ClipboardList, FileInput, GraduationCap, Search, ShieldCheck } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebActivity, type PartnerActivityData } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dateLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

function activityHref(item: PartnerActivityData["items"][number]) {
  if (item.kind === "policy") return "/partner/policies/" + encodeURIComponent(item.entity_id);
  if (item.kind === "claim") return "/partner/claims/" + encodeURIComponent(item.entity_id);
  if (item.kind === "intake") return "/partner/policy-intakes/" + encodeURIComponent(item.entity_id);
  return null;
}

function attentionHref(route: string, kind: string) {
  const normalized = route.toLowerCase();
  if (normalized.includes("renewal") || kind.toLowerCase().includes("renewal")) return "/partner/renewals";
  if (normalized.includes("claim") || kind.toLowerCase().includes("claim")) return "/partner/claims";
  if (normalized.includes("intake") || kind.toLowerCase().includes("intake")) return "/partner/policy-intakes";
  return "/partner";
}

function iconFor(kind: PartnerActivityData["items"][number]["kind"]) {
  if (kind === "policy") return ShieldCheck;
  if (kind === "claim") return ClipboardList;
  if (kind === "intake") return FileInput;
  return GraduationCap;
}

function labelFor(kind: PartnerActivityData["items"][number]["kind"]) {
  if (kind === "policy") return "POLICY";
  if (kind === "claim") return "CLAIM";
  if (kind === "intake") return "OPERATIONS";
  return "LEARN";
}

export default async function PartnerActivityPage() {
  const data = await getPartnerWebActivity(40);

  return (
    <PartnerPortalShell title="Activity">
      <div className="space-y-7">
        <PartnerPageHeader
          title="What changed"
        />

        {data.attention.length ? (
          <section className="rounded-2xl border border-[#DDE7F1] bg-[#F8FBFF] p-3 shadow-[0_5px_18px_rgba(31,53,89,0.05)]">
            <div className="flex items-center gap-2 px-1 py-1">
              <BellRing className="h-7 w-7 rounded-full bg-[#EAF3FF] p-1.5 text-[#2374E1]" />
              <h3 className="text-[15px] font-extrabold text-[#172B4D]">Needs attention</h3>
            </div>
            <div className="mt-2 grid overflow-hidden rounded-xl border border-[#DDE6EF] bg-white shadow-[0_2px_8px_rgba(31,53,89,0.04)]">
              {data.attention.slice(0, 3).map((item, index) => (
                <Link key={item.kind + "-" + item.title + "-" + index} href={attentionHref(item.route, item.kind)} className="group flex min-h-[66px] items-center gap-3 border-b border-[#E7EDF4] px-3 py-3 transition hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2374E1]/20 last:border-b-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><BellRing className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-extrabold text-[#172B4D]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[9px] font-medium leading-4 text-[#74839A]">{item.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-[#FFE7F0] px-2.5 py-1 text-[9px] font-extrabold text-[#D62E6E]">{item.count}</span>
                  <ArrowRight className="h-4 w-4 text-[#2374E1] transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_5px_18px_rgba(31,53,89,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#E3EAF2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EEF4FF] text-[#2374E1]"><ShieldCheck className="h-4 w-4" /></span>
                <h2 className="whitespace-nowrap text-[16px] font-extrabold text-[#172B4D]">Recent timeline</h2>
              </div>
              <div className="flex h-10 min-w-[280px] items-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-3 text-[#8593A8]">
                <Search className="h-4 w-4 shrink-0" />
                <span className="truncate text-[10px] font-medium">Search policy, customer, insurer, vehicle, etc.</span>
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] font-bold text-[#42526E]">{data.items.length} records</span>
          </div>

          {data.items.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E3EAF2] bg-[#F7FAFD] px-4 py-2 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#6F7F95]">
                  <span>Type</span>
                  <span>Date &amp; time</span>
                  <span>Policy / reference</span>
                  <span>Customer</span>
                  <span>Insurer / details</span>
                  <span className="text-center">Action</span>
                </div>
                {data.items.map((item) => {
                  const Icon = iconFor(item.kind);
                  const href = activityHref(item);
                  const row = (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
                        <span className="text-[10px] font-semibold text-[#213654]">{labelFor(item.kind)}</span>
                      </div>
                      <span className="self-center text-[10px] font-medium text-[#72829A]">{dateLabel(item.event_at)}</span>
                      <span className="self-center break-words text-[10.5px] font-extrabold text-[#172B4D]">{item.title}</span>
                      <span className="self-center break-words text-[10px] font-medium text-[#40536F]">{item.subtitle}</span>
                      <span className="self-center break-words text-[9px] font-medium text-[#7E8CA1]">{item.meta || "—"}</span>
                      <span className="flex items-center justify-center">
                        {href ? <ArrowRight className="h-4 w-4 text-[#2374E1] transition group-hover:translate-x-0.5" /> : null}
                      </span>
                    </>
                  );
                  return href ? (
                    <Link key={item.kind + "-" + item.entity_id + "-" + item.event_at} href={href} className="group grid min-h-[58px] grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E7EDF4] px-4 py-2.5 transition last:border-b-0 hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                      {row}
                    </Link>
                  ) : (
                    <div key={item.kind + "-" + item.entity_id + "-" + item.event_at} className="grid min-h-[58px] grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E7EDF4] px-4 py-2.5 last:border-b-0">
                      {row}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-14 text-center">
              <BriefcaseBusiness className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No recent activity</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">New policy, claim and service activity will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
