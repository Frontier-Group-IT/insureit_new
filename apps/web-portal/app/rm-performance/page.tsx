import Link from "next/link";
import { Mail, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { loadRmPerformance, type RmPerformanceQuery } from "@/lib/rm-performance";
import { RmPerformanceTrendChart } from "@/app/rm-performance/rm-performance-trend-chart";
import { RmSummaryCard } from "@/app/rm-performance/rm-summary-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RmPerformancePage({
  searchParams,
}: {
  searchParams: Promise<RmPerformanceQuery>;
}) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;

  const query = await searchParams;
  const data = await loadRmPerformance(profile, query);
  const isRm = profile.role === "relationship_manager";

  return (
    <AppShell title={isRm ? "My Performance" : "RM Performance"}>
      <div className="mx-auto max-w-[1580px] pb-10">
        <header className="flex flex-col gap-4 border-b border-[#DCE4EE] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.16em] text-[#8793A4]">
              <span>Daily Business Summary</span>
              <span className="h-1 w-1 rounded-full bg-[#1C8A78]" />
              <span>{formatDate(data.generatedAt)}</span>
            </div>
            <h1 className="portal-display mt-1.5 text-[29px] font-semibold tracking-[-.03em] text-[#10213D]">
              {isRm ? "My Performance" : "RM Performance"}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-[#7D8999]">
              Fast daily and month-to-date business reference.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRm ? (
              <form action="/rm-performance" method="get" className="flex items-center gap-2">
                <select
                  name="rm"
                  defaultValue={data.selectedRmId ?? ""}
                  className="h-9 min-w-[220px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-[9.5px] font-semibold text-[#22314A] outline-none"
                >
                  <option value="">All RMs</option>
                  {data.filters.rms.map((rm) => (
                    <option key={rm.id} value={rm.id}>{rm.name}</option>
                  ))}
                </select>
                <button type="submit" className="h-9 rounded-xl bg-[#17365D] px-3.5 text-[9px] font-bold text-white">
                  Apply
                </button>
              </form>
            ) : null}

            <button
              type="button"
              disabled
              title="Email Report will be enabled after transactional no-reply email is connected."
              className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl border border-[#D7DFEA] bg-[#F7F9FC] px-3 text-[9px] font-bold text-[#9AA5B5]"
            >
              <Mail className="h-3.5 w-3.5" />
              Email Report
            </button>
          </div>
        </header>

        {data.selectedRmName ? (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#D9E4F2] bg-[#F7FAFE] px-4 py-2.5 text-[9.5px] text-[#51647F]">
            <span>Showing <strong className="text-[#24364F]">{data.selectedRmName}</strong></span>
            <Link href="/rm-performance" className="font-black text-[#315B9A]">View all RMs</Link>
          </div>
        ) : null}

        <section className="mt-3 overflow-hidden rounded-[18px] border border-[#DCE4EE] bg-white shadow-[0_10px_28px_rgba(30,49,80,.04)]">
          <div className="grid xl:grid-cols-[1fr_1fr_1.05fr]">
            <PerformancePanel
              eyebrow="TODAY"
              title={money(data.today.net_premium)}
              policies={data.today.policy_count}
              motor={data.today.motor_net_premium}
              nonMotor={data.today.non_motor_net_premium}
            />
            <PerformancePanel
              eyebrow="MONTH TO DATE"
              title={money(data.mtd.net_premium)}
              policies={data.mtd.policy_count}
              motor={data.mtd.motor_net_premium}
              nonMotor={data.mtd.non_motor_net_premium}
              bordered
            />
            <MtdContextPanel rows={data.ytdTrend} />
          </div>
        </section>

        <section className="mt-3 overflow-hidden rounded-[18px] border border-[#DCE4EE] bg-white shadow-[0_10px_28px_rgba(30,49,80,.04)]">
          <div className="flex items-center justify-between border-b border-[#E9EDF3] px-5 py-3.5">
            <div>
              <h2 className="text-[12px] font-bold text-[#172744]">RM Daily Summary</h2>
              <p className="mt-0.5 text-[8.5px] text-[#8A96A6]">Primary figures first, source detail immediately below</p>
            </div>
            <span className="text-[8.5px] font-semibold text-[#7E8A99]">
              {data.rows.length} RM{data.rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-2 bg-[#F7F9FC] p-2">
            {data.rows.length ? data.rows.map((row) => (
              <RmSummaryCard key={row.employeeId ?? row.name} row={row} />
            )) : (
              <div className="rounded-xl border border-[#E4E9F1] bg-white">
                <Empty label="No RM production is available for the current scope." />
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PerformancePanel({
  eyebrow,
  title,
  policies,
  motor,
  nonMotor,
  bordered = false,
}: {
  eyebrow: string;
  title: string;
  policies: number;
  motor: number;
  nonMotor: number;
  bordered?: boolean;
}) {
  return (
    <div className={"px-5 py-4 " + (bordered ? "border-t border-[#E9EDF3] xl:border-l xl:border-t-0" : "")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[7.5px] font-black tracking-[.14em] text-[#7B8798]">{eyebrow}</p>
          <p className="mt-1.5 truncate text-[24px] font-semibold tracking-[-.035em] text-[#13233E]">{title}</p>
          <p className="mt-0.5 text-[8px] text-[#8A96A6]">Net Premium</p>
        </div>
        <div className="pt-1 text-right">
          <p className="text-[14px] font-black text-[#24364F]">{number(policies)}</p>
          <p className="text-[7px] text-[#8A96A6]">Policies</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#EEF1F5] pt-2.5 text-[8px]">
        <span className="text-[#8A96A6]">Motor <strong className="ml-1 text-[#34445B]">{money(motor)}</strong></span>
        <span className="text-[#8A96A6]">Non-Motor <strong className="ml-1 text-[#34445B]">{money(nonMotor)}</strong></span>
      </div>
    </div>
  );
}

function MtdContextPanel({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"];
}) {
  const previous = rows.at(-2);
  const latest = rows.at(-1);
  const movement = latest && previous && previous.net_premium > 0
    ? ((latest.net_premium - previous.net_premium) / previous.net_premium) * 100
    : null;

  return (
    <div className="border-t border-[#E9EDF3] px-5 py-4 xl:border-l xl:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF4FF] text-[#315B9A]">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[8px] font-black tracking-[.15em] text-[#7B8798]">MTD CONTEXT</p>
            <p className="mt-0.5 text-[7.5px] text-[#8A96A6]">Recent monthly production</p>
          </div>
        </div>
        {movement !== null ? (
          <span className={"rounded-full px-2 py-1 text-[7px] font-black " + (movement >= 0 ? "bg-[#EAF7F2] text-[#14745D]" : "bg-[#FDEEEE] text-[#B54747]")}>
            {movement >= 0 ? "+" : ""}{movement.toFixed(1)}%
          </span>
        ) : null}
      </div>

      <div className="mt-2 min-w-0">
        <RmPerformanceTrendChart rows={rows} />
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-[9px] font-semibold text-[#8A96A7]">{label}</div>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
