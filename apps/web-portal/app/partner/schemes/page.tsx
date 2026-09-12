import Link from "next/link";
import { ArrowLeft, BadgePercent, CalendarClock, CheckCircle2, Gift, Target } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { listPartnerWebSchemes, type PartnerScheme, type PartnerSchemeStatus } from "@/lib/partner-schemes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SchemeSearchParams = { status?: string };
type SchemeTab = "active" | "upcoming" | "completed";

const tabs: { value: SchemeTab; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

function resolveTab(value?: string): SchemeTab {
  if (value === "upcoming" || value === "completed") return value;
  return "active";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date),
    time: new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(date),
  };
}

function formatTarget(scheme: PartnerScheme) {
  if (scheme.target_value === null || scheme.target_value === undefined) return scheme.target_label?.trim() || "Not specified";
  const value = Number(scheme.target_value);
  if (!Number.isFinite(value)) return String(scheme.target_value);
  if (scheme.target_type === "premium") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (scheme.target_type === "policies") return `${new Intl.NumberFormat("en-IN").format(value)} policies`;
  return scheme.target_label?.trim() || new Intl.NumberFormat("en-IN").format(value);
}

function statusTone(status: PartnerSchemeStatus) {
  if (status === "active") return "border-[#BDEBD6] bg-[#ECFBF4] text-[#087A4E]";
  if (status === "upcoming") return "border-[#CFE0FF] bg-[#F0F5FF] text-[#285EBC]";
  return "border-[#E0E5EC] bg-[#F6F8FB] text-[#66758C]";
}

export default async function PartnerSchemesPage({ searchParams }: { searchParams: Promise<SchemeSearchParams> }) {
  const query = await searchParams;
  const selectedTab = resolveTab(query.status);
  const schemes = await listPartnerWebSchemes();
  const visibleSchemes = schemes.filter((scheme) => scheme.status === selectedTab);
  const counts = Object.fromEntries(tabs.map((tab) => [tab.value, schemes.filter((scheme) => scheme.status === tab.value).length])) as Record<SchemeTab, number>;

  return (
    <PartnerPortalShell title="Schemes">
      <div className="space-y-3 pb-4">
        <section className="flex items-center gap-3 border-b border-[#D7DEE8] px-1 pb-3 pt-1 sm:px-0">
          <Link
            href="/partner"
            prefetch={false}
            aria-label="Back to Partner Home"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#DCE5F1] bg-white text-[#415A7D] transition hover:border-[#C8D7EA] hover:text-[#1F5EC7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EDF4FF] text-[#2667D8]">
            <BadgePercent className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-[-0.035em] text-[#142746] sm:text-[24px]">Schemes</h1>
            <p className="mt-0.5 text-[10px] font-medium text-[#74849C]">Your assigned business schemes, validity and benefits.</p>
          </div>
        </section>

        <nav aria-label="Scheme status" className="inline-flex items-center gap-1 rounded-xl border border-[#DCE5F1] bg-white p-1 shadow-[0_3px_10px_rgba(25,50,90,0.04)]">
          {tabs.map((tab) => {
            const active = selectedTab === tab.value;
            return (
              <Link
                key={tab.value}
                href={`/partner/schemes?status=${tab.value}`}
                prefetch={false}
                className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 ${
                  active ? "bg-[#163968] text-white" : "text-[#526783] hover:bg-[#F3F6FA]"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[8px] ${active ? "bg-white/15 text-white" : "bg-[#EEF2F7] text-[#61718A]"}`}>
                  {counts[tab.value]}
                </span>
              </Link>
            );
          })}
        </nav>

        {visibleSchemes.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {visibleSchemes.map((scheme) => (
              <SchemeCard key={scheme.id} scheme={scheme} />
            ))}
          </div>
        ) : (
          <section className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-[#D8E1ED] bg-[#FAFBFD] px-6 text-center">
            <div>
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#EEF4FC] text-[#5477A8]">
                <BadgePercent className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-3 text-[14px] font-extrabold text-[#183057]">No {selectedTab} schemes</h2>
              <p className="mt-1 max-w-sm text-[10px] font-medium leading-5 text-[#7A899E]">When a scheme is assigned to your Partner account or Partner group, it will appear here automatically.</p>
            </div>
          </section>
        )}
      </div>
    </PartnerPortalShell>
  );
}

function SchemeCard({ scheme }: { scheme: PartnerScheme }) {
  const start = formatDateTime(scheme.starts_at);
  const end = formatDateTime(scheme.ends_at);

  return (
    <article className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
      <div className="flex items-start gap-3 border-b border-[#E8EDF4] px-4 py-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#2868D7]">
          <BadgePercent className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">{scheme.name}</h2>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[7.5px] font-black uppercase tracking-[0.08em] ${statusTone(scheme.status)}`}>{scheme.status}</span>
          </div>
          {scheme.description ? <p className="mt-1 text-[10px] font-medium leading-4 text-[#74849C]">{scheme.description}</p> : null}
        </div>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <InfoBlock icon={<CalendarClock className="h-4 w-4" />} label="Validity" value={`${start.date} · ${start.time} → ${end.date} · ${end.time}`} />
        <InfoBlock icon={<Target className="h-4 w-4" />} label="Target" value={formatTarget(scheme)} />
        <InfoBlock icon={<Gift className="h-4 w-4" />} label="Reward / Benefit" value={scheme.reward_text?.trim() || "Not specified"} />
        <InfoBlock icon={<CheckCircle2 className="h-4 w-4" />} label="Conditions" value={scheme.conditions_text?.trim() || "No additional conditions specified."} />
      </div>
    </article>
  );
}

function InfoBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5EBF3] bg-[#FAFBFD] px-3 py-3">
      <div className="flex items-center gap-2 text-[#4E72A6]">
        {icon}
        <span className="text-[7.5px] font-black uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 text-[10px] font-bold leading-4 text-[#203A61]">{value}</p>
    </div>
  );
}
