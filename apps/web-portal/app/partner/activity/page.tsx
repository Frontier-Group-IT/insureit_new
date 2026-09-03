import Link from "next/link";
import { ArrowRight, BellRing, BriefcaseBusiness, ClipboardList, FileInput, GraduationCap, ShieldCheck } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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
          eyebrow="Activity"
          title="What changed"
          description="Recent policy, claim and service activity."
        />

        {data.attention.length ? (
          <section>
            <div className="flex items-center gap-2 px-1">
              <BellRing className="h-4 w-4 text-[#A86809]" />
              <h3 className="text-[15px] font-extrabold text-[#6F4B12]">Needs attention</h3>
            </div>
            <div className="mt-3 grid border-y border-[#E8D8BC] lg:grid-cols-3">
              {data.attention.slice(0, 3).map((item, index) => (
                <Link key={item.kind + "-" + item.title + "-" + index} href={attentionHref(item.route, item.kind)} className="group flex min-h-[74px] items-center gap-3 border-b border-[#F0D7AE] px-1 py-3 transition hover:bg-[#FFF9EF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A86809]/20 lg:border-b-0 lg:border-r lg:px-4 lg:last:border-r-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF1D9] text-[#A86809]"><BellRing className="h-4 w-4" /></span>
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

        <section>
          <PartnerSectionHeading title="Recent timeline" description={data.items.length + " recorded events"} />

          {data.items.length ? (
            <div className="mt-3 border-y border-[#DCE4ED] py-5">
              {data.items.map((item, index) => {
                const Icon = iconFor(item.kind);
                const href = activityHref(item);
                const row = (
                  <>
                    <div className="flex flex-col items-center">
                      <span className="grid h-7 w-7 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-3.5 w-3.5" /></span>
                      {index < data.items.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#DDE4ED]" /> : null}
                    </div>
                    <div className="pb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#3156B8]">{labelFor(item.kind)}</p>
                        <p className="text-[8.5px] font-medium text-[#8A98AB]">{dateLabel(item.event_at)}</p>
                      </div>
                      <p className="mt-1.5 break-words text-[11px] font-extrabold leading-4 text-[#1B2F4E]">{item.title}</p>
                      <p className="mt-1 break-words text-[9.5px] font-medium leading-4 text-[#74839A]">{item.subtitle}</p>
                      {item.meta ? <p className="mt-1 text-[8.5px] text-[#8997AA]">{item.meta}</p> : null}
                    </div>
                    {href ? <ArrowRight className="mt-2 h-4 w-4 text-[#A0ADBE] transition group-hover:translate-x-0.5" /> : <span />}
                  </>
                );
                return href ? (
                  <Link key={item.kind + "-" + item.entity_id + "-" + item.event_at} href={href} className="group grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 rounded-lg transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
                    {row}
                  </Link>
                ) : (
                  <div key={item.kind + "-" + item.entity_id + "-" + item.event_at} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3">
                    {row}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-y border-[#DCE4ED] py-14 text-center">
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
