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

        <section className="mt-4 overflow-hidden rounded-[22px] border border-[#DCE4EE] bg-white shadow-[0_18px_45px_rgba(30,49,80,.06)]">
          <div className="grid xl:grid-cols-[1fr_1fr_1.05fr]">
            <PerformancePanel
              eyebrow="TODAY"
              title={money(data.today.net_premium)}
              policies={data.today.policy_count}
              average={data.today.average_net_premium}
              motor={data.today.motor_net_premium}
              nonMotor={data.today.non_motor_net_premium}
            />
            <PerformancePanel
              eyebrow="MONTH TO DATE"
              title={money(data.mtd.net_premium)}
              policies={data.mtd.policy_count}
              average={data.mtd.average_net_premium}
              motor={data.mtd.motor_net_premium}
              nonMotor={data.mtd.non_motor_net_premium}
              bordered
            />
            <MtdContextPanel
              rows={data.ytdTrend}
              motor={data.mtd.motor_net_premium}
              nonMotor={data.mtd.non_motor_net_premium}
            />
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[22px] border border-[#DCE4EE] bg-white shadow-[0_18px_45px_rgba(30,49,80,.05)]">
          <div className="flex items-center justify-between border-b border-[#E9EDF3] px-5 py-3.5">
            <div>
              <h2 className="text-[12px] font-bold text-[#172744]">RM Daily Summary</h2>
              <p className="mt-0.5 text-[8.5px] text-[#8A96A6]">Primary figures first, source detail immediately below</p>
            </div>
            <span className="text-[8.5px] font-semibold text-[#7E8A99]">
              {data.rows.length} RM{data.rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3 bg-[#F5F7FA] p-3">
            {data.rows.length ? data.rows.map((row, index) => (
              <RmSummaryCard key={row.employeeId ?? row.name} row={row} tone={index % 4} />
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
    <div className={"min-h-[188px] px-5 py-4.5 " + (bordered ? "border-t border-[#E9EDF3] xl:border-l xl:border-t-0" : "")}>
      <p className="text-[8px] font-black tracking-[.15em] text-[#7B8798]">{eyebrow}</p>
      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="truncate text-[27px] font-semibold tracking-[-.035em] text-[#13233E]">{title}</p>
          <p className="mt-0.5 text-[8.5px] text-[#8A96A6]">Net Premium</p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 text-right">
          <div>
            <p className="text-[14px] font-bold text-[#24364F]">{number(policies)}</p>
            <p className="text-[7.5px] text-[#8A96A6]">Policies</p>
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#24364F]">{money(average)}</p>
            <p className="text-[7.5px] text-[#8A96A6]">Avg / Policy</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#EEF1F5] pt-3">
        <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
          <p className="text-[7px] font-black uppercase tracking-[.08em] text-[#9AA4B2]">Motor</p>
          <p className="mt-0.5 text-[9px] font-bold text-[#34445B]">{money(motor)}</p>
        </div>
        <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
          <p className="text-[7px] font-black uppercase tracking-[.08em] text-[#9AA4B2]">Non-Motor</p>
          <p className="mt-0.5 text-[9px] font-bold text-[#34445B]">{money(nonMotor)}</p>
        </div>
      </div>
    </div>
  );
}

function MtdContextPanel({
  rows,
  motor,
  nonMotor,
}: {
  rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"];
  motor: number;
  nonMotor: number;
}) {
  const points = sparklinePoints(rows);
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  const movement = latest && previous && previous.net_premium > 0
    ? ((latest.net_premium - previous.net_premium) / previous.net_premium) * 100
    : null;

  return (
    <div className="min-h-[188px] border-t border-[#E9EDF3] px-5 py-4.5 xl:border-l xl:border-t-0">
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

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_110px] items-end gap-4">
        <div className="min-w-0">
          {rows.length ? (
            <>
              <svg viewBox="0 0 260 70" className="h-[62px] w-full overflow-visible" role="img" aria-label="Recent monthly net premium trend">
                <defs>
                  <linearGradient id="rm-performance-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#315B9A" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#315B9A" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={points.area} fill="url(#rm-performance-area)" />
                <polyline
                  points={points.line}
                  fill="none"
                  stroke="#315B9A"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {points.dots.map((dot) => (
                  <circle key={dot.key} cx={dot.x} cy={dot.y} r="3.3" fill="#fff" stroke="#315B9A" strokeWidth="2" />
                ))}
              </svg>
              <div className="mt-0.5 grid grid-cols-6 gap-1 text-center">
                {rows.slice(-6).map((row) => (
                  <span key={row.month} className="text-[6.5px] font-bold text-[#8A96A6]">{month(row.month)}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="grid h-[76px] place-items-center rounded-lg bg-[#F8FAFC] text-[8px] text-[#98A2B3]">No trend data</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
            <p className="text-[6.5px] font-black uppercase tracking-[.07em] text-[#9AA4B2]">Latest</p>
            <p className="mt-0.5 text-[9px] font-bold text-[#24364F]">{latest ? compactMoney(latest.net_premium) : "—"}</p>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2.5 py-2">
            <p className="text-[6.5px] font-black uppercase tracking-[.07em] text-[#9AA4B2]">Policies</p>
            <p className="mt-0.5 text-[9px] font-bold text-[#24364F]">{latest ? number(latest.policy_count) : "—"}</p>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[#EEF1F5] pt-2.5">
        <div>
          <p className="text-[6.5px] uppercase tracking-[.06em] text-[#9AA4B2]">Motor MTD</p>
          <p className="mt-0.5 text-[8.5px] font-bold text-[#34445B]">{money(motor)}</p>
        </div>
        <div>
          <p className="text-[6.5px] uppercase tracking-[.06em] text-[#9AA4B2]">Non-Motor MTD</p>
          <p className="mt-0.5 text-[8.5px] font-bold text-[#34445B]">{money(nonMotor)}</p>
        </div>
      </div>
    </div>
  );
}

function RmSummaryCard({
  row,
  tone,
}: {
  row: Awaited<ReturnType<typeof loadRmPerformance>>["rows"][number];
  tone: number;
}) {
  const shell = [
    "border-[#DCE7F4] bg-[linear-gradient(135deg,#FBFDFF_0%,#F7FAFE_100%)]",
    "border-[#DDEBE7] bg-[linear-gradient(135deg,#FBFEFC_0%,#F7FBF9_100%)]",
    "border-[#E8E1D6] bg-[linear-gradient(135deg,#FFFDF9_0%,#FAF7F1_100%)]",
    "border-[#E5DFF0] bg-[linear-gradient(135deg,#FDFBFF_0%,#F9F6FC_100%)]",
  ][tone];

  const accent = ["#2E5FA7", "#1C7E70", "#9B6A27", "#6F56A5"][tone];

  return (
    <article className={"relative overflow-hidden rounded-[18px] border shadow-[0_9px_24px_rgba(29,48,78,.04)] " + shell}>
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: accent }} />

      <div className="grid gap-3 px-5 pb-3 pt-4 xl:grid-cols-[minmax(190px,1.25fr)_repeat(4,minmax(110px,.72fr))_72px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <p className="truncate text-[12px] font-black tracking-[-.01em] text-[#1A2C48]">{row.name}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[7.5px] font-black text-[#315B9A] shadow-sm ring-1 ring-[#D9E3EF]">
              {row.contributionPercent.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-[8px] font-medium text-[#8A96A6]">MTD contribution</p>
        </div>

        <PrimaryMetric label="Today Policies" value={number(row.todayPolicies)} />
        <PrimaryMetric label="Today Net" value={money(row.todayNetPremium)} emphasis />
        <PrimaryMetric label="MTD Policies" value={number(row.mtdPolicies)} />
        <PrimaryMetric label="MTD Net" value={money(row.mtdNetPremium)} emphasis />

        <div className="xl:text-right">
          {row.employeeId ? (
            <Link
              href={"/rm-performance?rm=" + row.employeeId}
              className="inline-flex h-8 items-center rounded-lg border border-[#CAD7E6] bg-white px-3 text-[8px] font-black text-[#315B9A] shadow-sm transition hover:border-[#9CB2CB] hover:bg-[#F8FAFC]"
            >
              View
            </Link>
          ) : null}
        </div>
      </div>

      <div className="border-t border-black/[.055] bg-white/55 px-5 py-3">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[7.5px] font-black uppercase tracking-[.12em] text-[#748296]">Source Breakdown</p>
          <span className="text-[7.5px] font-semibold text-[#9AA4B2]">{row.sources.length} source{row.sources.length === 1 ? "" : "s"}</span>
        </div>

        {row.sources.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {row.sources.map((source) => (
              <SourceCard key={source.key} source={source} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#D9E0E8] bg-white/70 px-3 py-3 text-[8.5px] text-[#98A2B3]">
            No source business recorded.
          </div>
        )}
      </div>
    </article>
  );
}

function PrimaryMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={"rounded-xl px-3 py-2.5 " + (emphasis ? "bg-[#17365D] text-white shadow-[0_6px_16px_rgba(23,54,93,.12)]" : "bg-white/80 text-[#24364F] ring-1 ring-black/[.025]")}>
      <p className={"text-[6.5px] font-black uppercase tracking-[.08em] " + (emphasis ? "text-white/60" : "text-[#9AA4B2]")}>{label}</p>
      <p className="mt-1 truncate text-[11px] font-black tracking-[-.01em]">{value}</p>
    </div>
  );
}

function SourceCard({
  source,
}: {
  source: Awaited<ReturnType<typeof loadRmPerformance>>["rows"][number]["sources"][number];
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E3E8EF] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(31,51,81,.035)]">
      <p className="truncate text-[8px] font-black text-[#354760]" title={source.label}>{source.label}</p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[6.2px] font-black uppercase tracking-[.07em] text-[#A0A9B5]">Today</p>
          <p className="mt-0.5 truncate text-[8.5px] font-bold text-[#44546B]">{money(source.todayNetPremium)}</p>
          <p className="mt-0.5 text-[6.8px] text-[#99A4B2]">{number(source.todayPolicies)} policies</p>
        </div>
        <div className="border-l border-[#EDF0F4] pl-2">
          <p className="text-[6.2px] font-black uppercase tracking-[.07em] text-[#A0A9B5]">MTD</p>
          <p className="mt-0.5 truncate text-[8.5px] font-black text-[#17365D]">{money(source.mtdNetPremium)}</p>
          <p className="mt-0.5 text-[6.8px] text-[#99A4B2]">{number(source.mtdPolicies)} policies</p>
        </div>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-[9px] font-semibold text-[#8A96A7]">{label}</div>;
}

function sparklinePoints(rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"]) {
  const values = rows.slice(-6);
  if (!values.length) return { line: "", area: "", dots: [] as Array<{ key: string; x: number; y: number }> };

  const width = 260;
  const height = 62;
  const padX = 6;
  const padY = 7;
  const max = Math.max(...values.map((row) => row.net_premium), 1);
  const min = Math.min(...values.map((row) => row.net_premium), 0);
  const span = Math.max(max - min, 1);

  const dots = values.map((row, index) => {
    const x = values.length === 1
      ? width / 2
      : padX + (index * (width - padX * 2)) / (values.length - 1);
    const y = padY + ((max - row.net_premium) / span) * (height - padY * 2);
    return { key: row.month, x, y };
  });

  const line = dots.map((dot) => dot.x.toFixed(1) + "," + dot.y.toFixed(1)).join(" ");
  const area = dots.length
    ? "M " + dots[0].x.toFixed(1) + " " + (height - padY) + " L "
      + dots.map((dot) => dot.x.toFixed(1) + " " + dot.y.toFixed(1)).join(" L ")
      + " L " + dots[dots.length - 1].x.toFixed(1) + " " + (height - padY) + " Z"
    : "";

  return { line, area, dots };
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
