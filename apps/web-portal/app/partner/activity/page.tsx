import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, ClipboardList, Clock3, FileInput, GraduationCap, ShieldCheck } from "lucide-react";
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

        <section className="rounded-2xl border border-[#DDE7F1] bg-[#F8FBFF] p-3 shadow-[0_5px_18px_rgba(31,53,89,0.05)]">
          <div className="flex items-start gap-2 px-1 py-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAF3FF] text-[#2374E1]"><Clock3 className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[15px] font-extrabold text-[#172B4D]">Recent timeline</h3>
              <p className="mt-0.5 text-[10.5px] font-medium text-[#74839A]">{data.items.length + " recorded events"}</p>
            </div>
          </div>

          {data.items.length ? (
            <div className="mt-2 space-y-2">
              {data.items.map((item) => {
                const Icon = iconFor(item.kind);
                const href = activityHref(item);
                const row = (
                  <>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2374E1]"><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#2374E1]">{labelFor(item.kind)}</p>
                        <p className="text-[8.5px] font-medium text-[#8A98AB]">{dateLabel(item.event_at)}</p>
                      </div>
                      <p className="mt-1 break-words text-[11px] font-extrabold leading-4 text-[#172B4D]">{item.title}</p>
                      <p className="mt-0.5 break-words text-[9.5px] font-medium leading-4 text-[#74839A]">{item.subtitle}</p>
                      {item.meta ? <p className="mt-0.5 text-[8.5px] text-[#8997AA]">{item.meta}</p> : null}
                    </div>
                    {href ? <ArrowRight className="h-4 w-4 shrink-0 text-[#6E8FB7] transition group-hover:translate-x-0.5" /> : <span />}
                  </>
                );
                return href ? (
                  <Link key={item.kind + "-" + item.entity_id + "-" + item.event_at} href={href} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-[#DDE6EF] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(31,53,89,0.03)] transition hover:border-[#C8D7E8] hover:bg-[#FBFDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2374E1]/20">
                    {row}
                  </Link>
                ) : (
                  <div key={item.kind + "-" + item.entity_id + "-" + item.event_at} className="flex min-h-[76px] items-center gap-3 rounded-xl border border-[#DDE6EF] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(31,53,89,0.03)]">
                    {row}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-[#DDE6EF] bg-white py-14 text-center">
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
