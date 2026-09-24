import Link from "next/link";
import { Mail, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { loadRmPerformance, type RmPerformanceQuery } from "@/lib/rm-performance";

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
      <div className="mx-auto max-w-[1540px] pb-10">
        <header className="flex flex-col gap-4 border-b border-[#DDE4EE] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.14em] text-[#8792A2]">
              <span>Daily Business Summary</span>
              <span className="h-1 w-1 rounded-full bg-[#1F8B7D]" />
              <span>{formatDate(data.generatedAt)}</span>
            </div>
            <h1 className="portal-display mt-1.5 text-[29px] font-semibold tracking-[-.025em] text-[#10213D]">
              {isRm ? "My Performance" : "RM Performance"}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-[#7D8999]">
              Quick reference for today and month-to-date business.
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
                <button type="submit" className="h-9 rounded-xl bg-[#18395F] px-3.5 text-[9px] font-bold text-white">
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

        <section className="mt-4 overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_10px_28px_rgba(30,49,80,.05)]">
          <div className="grid xl:grid-cols-3">
            <SummaryBlock
              eyebrow="TODAY"
              title={money(data.today.net_premium)}
              policies={data.today.policy_count}
              average={data.today.average_net_premium}
              motor={data.today.motor_net_premium}
              nonMotor={data.today.non_motor_net_premium}
            />
            <SummaryBlock
              eyebrow="MONTH TO DATE"
              title={money(data.mtd.net_premium)}
              policies={data.mtd.policy_count}
              average={data.mtd.average_net_premium}
              motor={data.mtd.motor_net_premium}
              nonMotor={data.mtd.non_motor_net_premium}
              bordered
            />
            <MtdContext
              rows={data.ytdTrend}
              motor={data.mtd.motor_net_premium}
              nonMotor={data.mtd.non_motor_net_premium}
            />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_10px_28px_rgba(30,49,80,.04)]">
          <div className="flex items-center justify-between border-b border-[#E9EDF3] px-5 py-3.5">
            <div>
              <h2 className="text-[12px] font-bold text-[#172744]">RM Daily Summary</h2>
              <p className="mt-0.5 text-[8.5px] text-[#8A96A6]">Today, MTD and source-wise business in one view</p>
            </div>
            <span className="text-[8.5px] font-semibold text-[#7E8A99]">
              {data.rows.length} RM{data.rows.length === 1 ? "" : "s"}
            </span>
          </div>

          {!data.sourceCoverageComplete ? (
            <div className="border-b border-[#F0E2B7] bg-[#FFF9E9] px-5 py-2 text-[8.5px] font-semibold text-[#8A671D]">
              Source breakdown is limited to the first 5,000 policies in the selected period.
            </div>
          ) : null}

          <div className="space-y-3 bg-[#F7F9FC] p-3">
            {data.rows.length ? data.rows.map((row, index) => (
              <RmSummaryRow key={row.employeeId ?? row.name} row={row} tone={index % 5} />
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

function SummaryBlock({
  eyebrow,
  title,
  policies,
  average,
  motor,
  nonMotor,
  bordered = false,
}: {
  eyebrow: string;
  title: string;
  policies: number;
  average: number;
  motor: number;
  nonMotor: number;
  bordered?: boolean;
}) {
  return (
    <div className={"px-5 py-5 " + (bordered ? "border-t border-[#E9EDF3] xl:border-l xl:border-t-0" : "")}>
      <p className="text-[8px] font-black tracking-[.14em] text-[#7D8999]">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[27px] font-semibold tracking-[-.035em] text-[#13233E]">{title}</p>
          <p className="mt-0.5 text-[8.5px] text-[#8A96A6]">Net Premium</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
          <div>
            <p className="text-[13px] font-bold text-[#24364F]">{number(policies)}</p>
            <p className="text-[8px] text-[#8A96A6]">Policies</p>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#24364F]">{money(average)}</p>
            <p className="text-[8px] text-[#8A96A6]">Avg / Policy</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#EEF1F5] pt-3 text-[8.5px]">
        <span className="text-[#7D8999]">Motor <strong className="ml-1 text-[#34445B]">{money(motor)}</strong></span>
        <span className="text-[#7D8999]">Non-Motor <strong className="ml-1 text-[#34445B]">{money(nonMotor)}</strong></span>
      </div>
    </div>
  );
}

function MtdContext({
  rows,
  motor,
  nonMotor,
}: {
  rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"];
  motor: number;
  nonMotor: number;
}) {
  return (
    <div className="border-t border-[#E9EDF3] px-5 py-5 xl:border-l xl:border-t-0">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF4FF] text-[#315B9A]">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[8px] font-black tracking-[.14em] text-[#7D8999]">MTD CONTEXT</p>
          <p className="mt-0.5 text-[8px] text-[#8A96A6]">Recent monthly production</p>
        </div>
      </div>
      <Trend rows={rows} compact />
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#EEF1F5] pt-3">
        <div>
          <p className="text-[7.5px] uppercase tracking-[.06em] text-[#9AA4B2]">Motor MTD</p>
          <p className="mt-1 text-[10px] font-bold text-[#34445B]">{money(motor)}</p>
        </div>
        <div>
          <p className="text-[7.5px] uppercase tracking-[.06em] text-[#9AA4B2]">Non-Motor MTD</p>
          <p className="mt-1 text-[10px] font-bold text-[#34445B]">{money(nonMotor)}</p>
        </div>
      </div>
    </div>
  );
}

function RmSummaryRow({
  row,
  tone,
}: {
  row: Awaited<ReturnType<typeof loadRmPerformance>>["rows"][number];
  tone: number;
}) {
  const toneClass = [
    "border-[#DCE8F5] bg-[#FBFDFF]",
    "border-[#DCECE7] bg-[#FAFDFB]",
    "border-[#EFE5D4] bg-[#FFFCF7]",
    "border-[#E6DFF2] bg-[#FCFAFF]",
    "border-[#E2E7EC] bg-[#FCFDFE]",
  ][tone];

  return (
    <article className={"rounded-xl border px-4 py-4 shadow-[0_5px_16px_rgba(30,49,80,.025)] " + toneClass}>
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,1.2fr)_repeat(4,minmax(105px,.7fr))_76px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[10.5px] font-bold text-[#20324D]">{row.name}</p>
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-[7.5px] font-black text-[#315B9A] ring-1 ring-[#DDE6F2]">
              {row.contributionPercent.toFixed(1)}%
            </span>
          </div>
          <p className="mt-0.5 text-[8px] text-[#8A96A6]">MTD contribution</p>
        </div>

        <NumberCell label="Today Policies" value={number(row.todayPolicies)} />
        <NumberCell label="Today Net" value={money(row.todayNetPremium)} strong />
        <NumberCell label="MTD Policies" value={number(row.mtdPolicies)} />
        <NumberCell label="MTD Net" value={money(row.mtdNetPremium)} strong />

        <div className="xl:text-right">
          {row.employeeId ? (
            <Link
              href={"/rm-performance?rm=" + row.employeeId}
              className="inline-flex h-7 items-center rounded-lg border border-[#D2DDEA] bg-white px-2.5 text-[8px] font-bold text-[#315B9A] transition hover:border-[#AEBFD3] hover:bg-[#F8FAFC]"
            >
              View
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-black/[.055] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[7.5px] font-black uppercase tracking-[.1em] text-[#7F8C9D]">Source Breakdown</span>
          <span className="text-[7.5px] text-[#A0A9B5]">{row.sources.length} source{row.sources.length === 1 ? "" : "s"}</span>
        </div>

        {row.sources.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {row.sources.map((source) => (
              <SourceCard key={source.key} source={source} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D9E0E8] bg-white/65 px-3 py-3 text-[8.5px] text-[#98A2B3]">
            No source business recorded.
          </div>
        )}
      </div>
    </article>
  );
}

function SourceCard({
  source,
}: {
  source: Awaited<ReturnType<typeof loadRmPerformance>>["rows"][number]["sources"][number];
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/85 px-3 py-2.5 shadow-[0_2px_8px_rgba(31,51,81,.035)] ring-1 ring-black/[.025]">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[8.5px] font-bold text-[#354760]" title={source.label}>{source.label}</p>
        {source.type ? (
          <span className="shrink-0 rounded-md bg-[#F1F4F8] px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-[.04em] text-[#7D8999]">
            {source.type}
          </span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[6.5px] font-black uppercase tracking-[.06em] text-[#9AA4B2]">Today</p>
          <p className="mt-0.5 text-[8.5px] font-bold text-[#34445B]">{money(source.todayNetPremium)}</p>
          <p className="mt-0.5 text-[7px] text-[#8E99A8]">{number(source.todayPolicies)} policies</p>
        </div>
        <div className="border-l border-[#EDF0F4] pl-2">
          <p className="text-[6.5px] font-black uppercase tracking-[.06em] text-[#9AA4B2]">MTD</p>
          <p className="mt-0.5 text-[8.5px] font-bold text-[#17365D]">{money(source.mtdNetPremium)}</p>
          <p className="mt-0.5 text-[7px] text-[#8E99A8]">{number(source.mtdPolicies)} policies</p>
        </div>
      </div>
    </div>
  );
}

function NumberCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[7.5px] font-black uppercase tracking-[.06em] text-[#9AA4B2]">{label}</p>
      <p className={"mt-1 text-[10px] " + (strong ? "font-bold text-[#17365D]" : "font-semibold text-[#34445B]")}>{value}</p>
    </div>
  );
}

function Trend({
  rows,
  compact = false,
}: {
  rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"];
  compact?: boolean;
}) {
  if (!rows.length) return <Empty label="No trend data available." />;
  const max = Math.max(...rows.map((row) => row.net_premium), 1);

  return (
    <div className={compact ? "mt-3 space-y-2" : "mt-4 space-y-3"}>
      {rows.map((row) => (
        <div key={row.month} className="grid grid-cols-[38px_minmax(0,1fr)_68px] items-center gap-2">
          <div>
            <p className="text-[8px] font-bold text-[#40516C]">{month(row.month)}</p>
            <p className="text-[7px] text-[#9AA4B2]">{number(row.policy_count)}</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EDF1F6]">
            <div className="h-full rounded-full bg-[#3559A8]" style={{ width: String(Math.max(3, (row.net_premium / max) * 100)) + "%" }} />
          </div>
          <p className="text-right text-[8px] font-bold text-[#23334F]">{compactMoney(row.net_premium)}</p>
        </div>
      ))}
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
function compactMoney(value: number) {
  const n = Math.abs(value || 0);
  if (n >= 10000000) return "₹" + (value / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "₹" + (value / 100000).toFixed(1) + " L";
  if (n >= 1000) return "₹" + (value / 1000).toFixed(1) + " K";
  return money(value);
}
function month(value: string) {
  const date = value ? new Date(value.slice(0, 7) + "-01T00:00:00Z") : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date)
    : value;
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
