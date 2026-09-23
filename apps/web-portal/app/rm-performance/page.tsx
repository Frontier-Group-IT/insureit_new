import Link from "next/link";
import { ArrowRight, CalendarDays, Mail, TrendingUp, Users } from "lucide-react";

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
        <header className="flex flex-col gap-4 border-b border-[#D9E2EE] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.14em] text-[#7B8799]">
              <span>Business Performance</span>
              <span className="h-1 w-1 rounded-full bg-[#18BFC2]" />
              <span>{formatDate(data.generatedAt)}</span>
            </div>
            <h1 className="portal-display mt-1.5 text-[30px] font-semibold tracking-[-.025em] text-[#10213D]">
              {isRm ? "My Performance" : "RM Performance"}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-[#7B8799]">
              Today and month-to-date production from the same canonical policy reporting data.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRm ? (
              <form action="/rm-performance" method="get" className="flex items-center gap-2">
                <select
                  name="rm"
                  defaultValue={data.selectedRmId ?? ""}
                  className="h-9 min-w-[210px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-[9.5px] font-semibold text-[#22314A] outline-none"
                >
                  <option value="">All RMs</option>
                  {data.filters.rms.map((rm) => (
                    <option key={rm.id} value={rm.id}>{rm.name}</option>
                  ))}
                </select>
                <button type="submit" className="h-9 rounded-xl bg-[#203A63] px-3 text-[9px] font-bold text-white">
                  Apply
                </button>
              </form>
            ) : null}

            <button
              type="button"
              disabled
              title="Email delivery will be enabled after transactional no-reply mail is connected."
              className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl border border-[#D7DFEA] bg-[#F7F9FC] px-3 text-[9px] font-bold text-[#94A0B2]"
            >
              <Mail className="h-3.5 w-3.5" />
              Email Report
            </button>
          </div>
        </header>

        {data.selectedRmName ? (
          <div className="mt-4 rounded-xl border border-[#D7E3F2] bg-[#F7FAFF] px-4 py-3 text-[10px] font-semibold text-[#35507A]">
            Showing performance for <strong>{data.selectedRmName}</strong>.{" "}
            <Link href="/rm-performance" className="font-black text-[#214F9A]">Clear filter</Link>
          </div>
        ) : null}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Today Net Premium" value={money(data.today.net_premium)} icon="trend" />
          <Metric label="Today Policies" value={number(data.today.policy_count)} icon="users" />
          <Metric label="Today Avg / Policy" value={money(data.today.average_net_premium)} />
          <Metric label="MTD Net Premium" value={money(data.mtd.net_premium)} />
          <Metric label="MTD Policies" value={number(data.mtd.policy_count)} />
          <Metric label="MTD Avg / Policy" value={money(data.mtd.average_net_premium)} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
          <article className="portal-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E7ECF3] px-5 py-4">
              <div>
                <h2 className="text-[13px] font-bold text-[#172744]">RM production</h2>
                <p className="mt-0.5 text-[9px] text-[#8793A4]">Today and month-to-date performance</p>
              </div>
              <span className="text-[8.5px] font-semibold text-[#7B8799]">{data.rows.length} RM{data.rows.length === 1 ? "" : "s"}</span>
            </div>
            <RmTable rows={data.rows} />
          </article>

          <article className="portal-card p-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#315B9A]" />
              <div>
                <h2 className="text-[13px] font-bold text-[#172744]">Production trend</h2>
                <p className="text-[9px] text-[#8793A4]">Last 6 available YTD months</p>
              </div>
            </div>
            <Trend rows={data.ytdTrend} />
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <article className="portal-card p-5">
            <h2 className="text-[13px] font-bold text-[#172744]">Business mix</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="Motor" value={money(data.mtd.motor_net_premium)} meta={number(data.mtd.motor_policy_count) + " policies"} />
              <MiniMetric label="Non-Motor" value={money(data.mtd.non_motor_net_premium)} meta={number(data.mtd.non_motor_policy_count) + " policies"} />
            </div>
          </article>

          <article className="portal-card p-5">
            <h2 className="text-[13px] font-bold text-[#172744]">Retail / Fleet</h2>
            <div className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFBFD] p-4">
              <p className="text-[10px] font-bold text-[#41516A]">Unclassified</p>
              <p className="mt-1 text-[9px] leading-4 text-[#7E8A9B]">{data.segment.note}</p>
            </div>
          </article>

          <article className="portal-card p-5">
            <h2 className="text-[13px] font-bold text-[#172744]">Top insurers — MTD</h2>
            <div className="mt-3 space-y-2.5">
              {data.insurerMix.length ? data.insurerMix.map((row) => (
                <div key={row.id || row.name} className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[9.5px] font-semibold text-[#30405A]">{row.name || "Unassigned"}</p>
                    <p className="text-[8px] text-[#8A96A7]">{number(row.policy_count)} policies · {row.share_percent.toFixed(1)}%</p>
                  </div>
                  <p className="shrink-0 text-[10px] font-bold text-[#1E2E49]">{money(row.net_premium)}</p>
                </div>
              )) : <Empty label="No insurer production available." />}
            </div>
          </article>
        </section>

        <section className="portal-card mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E7ECF3] px-5 py-4">
            <div>
              <h2 className="text-[13px] font-bold text-[#172744]">Recent policy production</h2>
              <p className="mt-0.5 text-[9px] text-[#8793A4]">Month-to-date policies included in this performance view</p>
            </div>
            <Link href="/reports/business" className="inline-flex items-center gap-1 text-[9px] font-bold text-[#315B9A]">
              Open Business Report <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RecentPolicies rows={data.recentPolicies} />
        </section>

        <section className="mt-4 rounded-xl border border-[#DCE4EE] bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-[#315B9A]" />
            <div>
              <p className="text-[10px] font-bold text-[#273952]">Email automation readiness</p>
              <p className="mt-1 max-w-[1000px] text-[9px] leading-4 text-[#7D8999]">
                Password-reset mail currently uses Supabase Auth. A general transactional sender for no-reply@insureit.in is still required before this page can send RM performance emails directly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: "trend" | "users" }) {
  const Icon = icon === "trend" ? TrendingUp : icon === "users" ? Users : null;
  return (
    <article className="portal-card px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#7D899B]">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#6079A8]" /> : null}
      </div>
      <p className="mt-2 text-[20px] font-semibold tracking-[-.02em] text-[#14213C]">{value}</p>
    </article>
  );
}

function MiniMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-xl border border-[#E4E9F1] bg-[#FAFBFD] p-3">
      <p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#8A96A7]">{label}</p>
      <p className="mt-1.5 text-[15px] font-bold text-[#1E2E49]">{value}</p>
      <p className="mt-0.5 text-[8.5px] text-[#8793A4]">{meta}</p>
    </div>
  );
}

function RmTable({ rows }: { rows: Awaited<ReturnType<typeof loadRmPerformance>>["rows"] }) {
  if (!rows.length) return <Empty label="No RM production is available for the current scope." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px]">
        <thead>
          <tr className="bg-[#F8FAFC] text-[8px] font-black uppercase tracking-[.07em] text-[#7B8799]">
            <th className="px-5 py-3 text-left">RM</th>
            <th className="px-3 py-3 text-right">Today Policies</th>
            <th className="px-3 py-3 text-right">Today Net</th>
            <th className="px-3 py-3 text-right">MTD Policies</th>
            <th className="px-3 py-3 text-right">MTD Net</th>
            <th className="px-3 py-3 text-right">Avg Net / Policy</th>
            <th className="px-3 py-3 text-right">Contribution</th>
            <th className="px-5 py-3 text-center">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EDF0F4]">
          {rows.map((row) => (
            <tr key={row.employeeId ?? row.name} className="text-[9.5px] hover:bg-[#FBFCFE]">
              <td className="px-5 py-3.5 font-bold text-[#263750]">{row.name}</td>
              <td className="px-3 py-3.5 text-right">{number(row.todayPolicies)}</td>
              <td className="px-3 py-3.5 text-right font-semibold">{money(row.todayNetPremium)}</td>
              <td className="px-3 py-3.5 text-right">{number(row.mtdPolicies)}</td>
              <td className="px-3 py-3.5 text-right font-bold text-[#203A63]">{money(row.mtdNetPremium)}</td>
              <td className="px-3 py-3.5 text-right">{money(row.averageNetPremium)}</td>
              <td className="px-3 py-3.5 text-right">{row.contributionPercent.toFixed(1)}%</td>
              <td className="px-5 py-3.5 text-center">
                {row.employeeId ? (
                  <Link href={"/rm-performance?rm=" + row.employeeId} className="inline-flex h-7 items-center rounded-lg border border-[#D8E1EC] px-2.5 text-[8.5px] font-bold text-[#315B9A]">
                    View
                  </Link>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Trend({ rows }: { rows: Awaited<ReturnType<typeof loadRmPerformance>>["ytdTrend"] }) {
  if (!rows.length) return <Empty label="No trend data available." />;
  const max = Math.max(...rows.map((row) => row.net_premium), 1);
  return (
    <div className="mt-5 space-y-3">
      {rows.map((row) => (
        <div key={row.month} className="grid grid-cols-[58px_minmax(0,1fr)_88px] items-center gap-3">
          <div>
            <p className="text-[9px] font-bold text-[#40516C]">{month(row.month)}</p>
            <p className="text-[8px] text-[#8B96A6]">{number(row.policy_count)}</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#EDF1F6]">
            <div className="h-full rounded-full bg-[#3559A8]" style={{ width: String(Math.max(3, (row.net_premium / max) * 100)) + "%" }} />
          </div>
          <p className="text-right text-[9px] font-bold text-[#23334F]">{compactMoney(row.net_premium)}</p>
        </div>
      ))}
    </div>
  );
}

function RecentPolicies({ rows }: { rows: Awaited<ReturnType<typeof loadRmPerformance>>["recentPolicies"] }) {
  if (!rows.length) return <Empty label="No month-to-date policies are available." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px]">
        <thead>
          <tr className="bg-[#F8FAFC] text-[8px] font-black uppercase tracking-[.07em] text-[#7B8799]">
            <th className="px-5 py-3 text-left">Date</th>
            <th className="px-3 py-3 text-left">RM</th>
            <th className="px-3 py-3 text-left">Customer / Risk</th>
            <th className="px-3 py-3 text-left">Policy</th>
            <th className="px-3 py-3 text-left">Insurer</th>
            <th className="px-3 py-3 text-left">Business</th>
            <th className="px-3 py-3 text-right">Net Premium</th>
            <th className="px-5 py-3 text-center">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EDF0F4]">
          {rows.map((row) => (
            <tr key={row.id} className="text-[9px] hover:bg-[#FBFCFE]">
              <td className="px-5 py-3.5 font-semibold">{displayDate(row.business_date)}</td>
              <td className="px-3 py-3.5">{row.rm_name ?? "Unassigned"}</td>
              <td className="px-3 py-3.5">
                <p className="font-semibold text-[#2D3C55]">{row.customer_name || "—"}</p>
                <p className="mt-0.5 text-[8px] text-[#8A96A7]">{row.risk_reference || row.vehicle_no || "—"}</p>
              </td>
              <td className="px-3 py-3.5 font-semibold">{row.policy_no || "—"}</td>
              <td className="px-3 py-3.5">{row.insurer_name || "—"}</td>
              <td className="px-3 py-3.5">{row.business_line || "—"}</td>
              <td className="px-3 py-3.5 text-right font-bold">{money(row.net_premium)}</td>
              <td className="px-5 py-3.5 text-center">
                <Link href={"/policies/" + row.id} className="inline-flex h-7 items-center rounded-lg border border-[#D8E1EC] px-2 text-[8.5px] font-bold text-[#315B9A]">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-[9.5px] font-semibold text-[#8A96A7]">{label}</div>;
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
function displayDate(value: string) {
  if (!value) return "—";
  const date = new Date(value + "T00:00:00+05:30");
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(date);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
