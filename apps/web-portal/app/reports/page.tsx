import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/shell";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requireCapability } from "@/lib/master-data-server";
import { visibleReportFamilies } from "@/lib/reports/navigation";

type Query = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Query> };

const BUSINESS_QUERY_KEYS = ["period", "from", "to", "insurer", "rm", "intermediary", "page"];

export default async function ReportsOverviewPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const query = await searchParams;

  if (BUSINESS_QUERY_KEYS.some((key) => query[key] !== undefined)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (typeof value === "string") params.set(key, value);
    }
    redirect(`/reports/business${params.size ? `?${params.toString()}` : ""}`);
  }

  const canViewGovernance = await hasEffectiveCapability(profile, "manage_users");
  const families = visibleReportFamilies(canViewGovernance);

  return (
    <AppShell title="Reports">
      <div className="report-page-shell mx-auto max-w-[1560px] space-y-4 pb-8">
        <header className="portal-card overflow-hidden">
          <div className="px-5 py-5 sm:px-6">
            <h1 className="report-title text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">Reports</h1>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <Link href="/reports/management-pack" className="portal-card group flex items-center justify-between gap-4 p-5 transition hover:border-[#b7c5da] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#172a5c] text-white"><BarChart3 className="h-4.5 w-4.5" /></span>
              <div><p className="text-[12px] font-bold text-[#1b2943]">Management Pack</p><p className="mt-1 text-[9.5px] font-semibold text-[#778397]">Executive</p></div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#748096] transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="/reports/readiness" className="portal-card group flex items-center justify-between gap-4 p-5 transition hover:border-[#b7c5da] sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#dbe3ed] bg-[#f8fafc] text-[#31528f]"><CheckCircle2 className="h-4.5 w-4.5" /></span>
              <div><p className="text-[12px] font-bold text-[#1b2943]">Readiness</p><p className="mt-1 text-[9.5px] font-semibold text-[#778397]">Controls & Data Quality</p></div>
            </div>
            <ArrowRight className="h-4 w-4 text-[#748096] transition group-hover:translate-x-0.5" />
          </Link>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {families.map((family) => (
            <article key={family.key} className="portal-card overflow-hidden">
              <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{family.label}</h2></div>
              <div className="divide-y divide-[#edf0f4]">
                {family.destinations.map((destination) => (
                  <Link key={destination.href} href={destination.href} className="group flex items-center justify-between gap-3 px-5 py-4 text-[11px] font-semibold text-[#34445e] transition hover:bg-[#fafbfd] hover:text-[#203f79]">
                    <span>{destination.label}</span><ArrowRight className="h-3.5 w-3.5 text-[#7c899b] transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
