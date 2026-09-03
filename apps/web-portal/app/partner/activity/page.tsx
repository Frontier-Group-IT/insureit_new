import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, ClipboardList, FileInput, GraduationCap, ShieldCheck } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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
  return "/partner/learn";
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
      <div className="space-y-4">
        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Activity</p>
          <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">What changed</h2>
          <p className="mt-1 text-[11px] font-medium text-[#74839A]">Recent Partner-scoped policy, claim and Operations activity in one timeline.</p>
        </section>

        {data.attention.length ? (
          <section className="rounded-[26px] border border-[#E8D8BC] bg-[#FFF9EF] p-5 shadow-[0_16px_45px_rgba(34,56,89,.05)] sm:p-6">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#A86809]" />
              <h3 className="text-[15px] font-extrabold text-[#6F4B12]">Needs attention</h3>
            </div>
            <div className="mt-4 grid gap-2 lg:grid-cols-3">
              {data.attention.slice(0, 3).map((item, index) => (
                <Link key={item.kind + "-" + item.title + "-" + index} href={attentionHref(item.route, item.kind)} className="group flex min-h-[84px] items-center gap-3 rounded-2xl border border-[#F0D7AE] bg-white px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#FFF1D9] text-[#A86809]"><BellRing className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-extrabold text-[#6F4B12]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-[9px] font-medium leading-4 text-[#806B52]">{item.subtitle}</p>
                  </div>
                  <span className="rounded-lg bg-[#FFF6E8] px-2 py-1 text-[9px] font-extrabold text-[#98610D]">{item.count}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#A98E68] transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="flex items-center justify-between border-b border-[#E6ECF3] px-5 py-4 sm:px-6">
            <div><p className="text-[12px] font-extrabold text-[#172846]">Recent timeline</p><p className="mt-0.5 text-[9.5px] font-medium text-[#7A899F]">{data.items.length} recorded events</p></div>
          </div>

          {data.items.length ? (
            <div className="px-5 py-5 sm:px-6">
              {data.items.map((item, index) => {
                const Icon = iconFor(item.kind);
                return (
                  <Link key={item.kind + "-" + item.entity_id + "-" + item.event_at} href={activityHref(item)} className="group grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-3.5 w-3.5" /></span>
                      {index < data.items.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#DDE4ED]" /> : null}
                    </div>
                    <div className="pb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#3156B8]">{labelFor(item.kind)}</p>
                        <p className="text-[8.5px] font-medium text-[#8A98AB]">{dateLabel(item.event_at)}</p>
                      </div>
                      <p className="mt-1.5 text-[11px] font-extrabold text-[#1B2F4E]">{item.title}</p>
                      <p className="mt-1 text-[9.5px] font-medium text-[#74839A]">{item.subtitle}</p>
                      {item.meta ? <p className="mt-1 text-[8.5px] text-[#8997AA]">{item.meta}</p> : null}
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 text-[#A0ADBE] transition group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <BriefcaseBusiness className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No recent activity</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">New scoped policy, claim and Operations activity will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
