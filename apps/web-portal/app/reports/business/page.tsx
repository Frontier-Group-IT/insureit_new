import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import { ReportQueryShortcuts } from "@/components/reports/report-query-shortcuts";
import { ReportCompactFilters } from "@/components/reports/report-compact-filters";
import { ReportEmptyState, ReportExportLink, ReportPageShell } from "@/components/reports/report-page-shell";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { requireCapability } from "@/lib/master-data-server";
import { emptyFinanceReport, loadFinanceReport, type FinanceQuery, type FinanceReport } from "@/lib/reports/finance";
import { loadPolicyBusinessNetReport, type PolicyBusinessFilters, type PolicyBusinessQuery, type PolicyBusinessNetReport } from "@/lib/reports/policy-business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = [
  { value: "90d", label: "Last 90 days" },
  { value: "mtd", label: "Month to date" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
] as const;

type BusinessPageQuery = PolicyBusinessQuery & { mix?: string };
type Props = { searchParams: Promise<BusinessPageQuery> };
type CommercialRow = {
  key: string;
  name: string;
  type?: string;
  rm?: string;
  policies: number;
  netPremium: number;
  payin: number;
  payout: number;
  retention: number;
};

export default async function ReportsPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;

  const query = await searchParams;
  const businessQuery: PolicyBusinessQuery = { ...query, page: "1", pageSize: "5000" };
  const financeQuery: FinanceQuery = { ...query, period: query.period ?? "mtd", page: "1", pageSize: "5000" };

  const [businessResult, financeResult] = await Promise.all([
    loadPolicyBusinessNetReport(profile, businessQuery)
      .then((data) => ({ data, error: null as unknown }))
      .catch((error) => ({ data: null, error })),
    loadFinanceReport(profile, financeQuery)
      .then((data) => ({ data, error: null as unknown }))
      .catch((error) => ({ data: null, error })),
  ]);

  if (businessResult.error) {
    console.error("[reports] business report failed", businessResult.error instanceof Error ? businessResult.error.message : "unknown error");
  }
  if (financeResult.error) {
    console.error("[reports] business commercials failed", financeResult.error instanceof Error ? financeResult.error.message : "unknown error");
  }

  const report = businessResult.data?.report ?? emptyBusinessReport();
  const filters = businessResult.data?.filters ?? fallbackFilters();
  const finance = financeResult.data?.report ?? emptyFinanceReport();
  const loadError = Boolean(businessResult.error || financeResult.error);
  const mixMode = query.mix === "insurer" || query.mix === "rm" ? query.mix : "business-type";
  const exportHref = reportHref("/reports/export/policy-business", filters);

  const insurerRows = buildInsurerRows(finance);
  const rmRows = buildRmRows(finance);
  const intermediaryRows = buildIntermediaryRows(finance, report);
  const businessTypeRows = buildBusinessTypeRows(report);
  const mixRows = mixMode === "insurer"
    ? insurerRows.map((row) => ({ key: row.key, name: row.name, policies: row.policies, value: row.netPremium }))
    : mixMode === "rm"
      ? rmRows.map((row) => ({ key: row.key, name: row.name, policies: row.policies, value: row.netPremium }))
      : businessTypeRows;
  const mixTitle = mixMode === "insurer" ? "Insurer" : mixMode === "rm" ? "RM" : "Business Type";

  return (
    <AppShell title="Reports">
      <ReportPageShell
        title="Business"
        loadError={loadError}
        actions={<ReportExportLink href={exportHref} />}
        controls={
          <ReportQueryShortcuts
            label="Period"
            param="period"
            activeValue={filters.period}
            options={PERIODS}
            showActiveFilterCount={false}
            trailing={
              <>
                {filters.period === "custom" ? <CustomDateRange filters={filters} /> : null}
                <ReportCompactFilters
                  path="/reports/business"
                  businessLine={filters.businessLine}
                  category={filters.category}
                  categories={report.filters.categories}
                  period={filters.period}
                  fromDate={filters.fromDate}
                  toDate={filters.toDate}
                  compactDrawer
                  clearAppliedFilters
                  fields={[
                    { name: "insurer", label: "Insurance company", value: filters.insurerId ?? "", options: report.filters.insurers.map((item) => ({ value: item.id, label: item.name })) },
                    { name: "rm", label: "Relationship manager", value: filters.rmEmployeeId ?? "", options: report.filters.rms.map((item) => ({ value: item.id, label: item.name })) },
                    { name: "intermediary", label: "Partner / intermediary", value: filters.intermediaryCode ?? "", options: report.filters.intermediaries.map((item) => ({ value: item.code, label: item.name !== item.code ? item.name + " · " + item.code : item.name })) },
                  ]}
                />
              </>
            }
          />
        }
      >
        <CommercialFlow finance={finance} policyCount={report.summary.policy_count} />

        <section className="grid gap-3 xl:grid-cols-2">
          <article className="portal-card overflow-hidden">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] px-4 py-2.5">
              <HeaderTitle title="Business Mix" />
              <div className="inline-flex overflow-hidden rounded-lg border border-[#dbe3ee] bg-white text-[9px] font-bold">
                <MixTab href={reportHref("/reports/business", filters, "business-type")} active={mixMode === "business-type"}>Business Type</MixTab>
                <MixTab href={reportHref("/reports/business", filters, "insurer")} active={mixMode === "insurer"}>Insurer</MixTab>
                <MixTab href={reportHref("/reports/business", filters, "rm")} active={mixMode === "rm"}>RM</MixTab>
              </div>
            </div>
            <BusinessMix rows={mixRows} label={mixTitle} />
          </article>

          <article className="portal-card overflow-hidden">
            <Header title="Insurer" />
            <InsurerTable rows={insurerRows} />
          </article>
        </section>

        <section className="portal-card overflow-hidden">
          <Header title="RM Performance" />
          <RmTable rows={rmRows} />
        </section>

        <section className="portal-card overflow-hidden">
          <Header title="Intermediaries Business" />
          <IntermediaryTable rows={intermediaryRows} />
        </section>
      </ReportPageShell>
    </AppShell>
  );
}

function CommercialFlow({ finance, policyCount }: { finance: FinanceReport; policyCount: number }) {
  const retentionRate = ratio(finance.summary.retention_amount, finance.summary.projected_payin);
  return (
    <section className="portal-card overflow-hidden">
      <div className="border-b border-[#e6ebf2] px-4 py-3">
        <HeaderTitle title="Commercial Flow" />
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        <FlowMetric label="Net Premium" value={currency(finance.summary.net_premium)} note={integer(policyCount) + " policies"} />
        <FlowMetric label="Expected Pay-in" value={currency(finance.summary.projected_payin)} note={percent(ratio(finance.summary.projected_payin, finance.summary.net_premium)) + " of net premium"} />
        <FlowMetric label="Partner Payout" value={currency(finance.summary.gross_payout)} note={percent(ratio(finance.summary.gross_payout, finance.summary.projected_payin)) + " of pay-in"} />
        <FlowMetric label="Retention" value={currency(finance.summary.retention_amount)} note={percent(retentionRate) + " of pay-in"} last />
      </div>
    </section>
  );
}

function FlowMetric({ label, value, note, last = false }: { label: string; value: string; note: string; last?: boolean }) {
  return (
    <div className={"min-h-[92px] px-5 py-4 " + (last ? "" : "border-b border-[#e8edf3] xl:border-b-0 xl:border-r")}>
      <p className="text-[9px] font-bold text-[#52647b]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold tracking-[-.035em] text-[#122342]">{value}</p>
      <p className="mt-1 text-[9px] font-semibold text-[#8290a4]">{note}</p>
    </div>
  );
}

function MixTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={"px-3 py-2 transition " + (active ? "bg-[#155fba] text-white" : "text-[#66758a] hover:bg-[#f6f9fc]")}>{children}</Link>;
}

function BusinessMix({ rows, label }: { rows: Array<{ key: string; name: string; policies: number; value: number }>; label: string }) {
  if (!rows.length) return <Empty />;
  const total = Math.max(rows.reduce((sum, row) => sum + row.value, 0), 1);
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="max-h-[330px] overflow-y-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[28px_minmax(120px,1fr)_minmax(180px,1.5fr)_58px] gap-2 bg-[#f8fafc] px-4 py-2 text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]">
        <span>#</span><span>{label}</span><span>Net Premium</span><span className="text-right">Share</span>
      </div>
      <div className="divide-y divide-[#edf1f5]">
        {rows.map((row, index) => (
          <div key={row.key} className="grid min-h-10 grid-cols-[28px_minmax(120px,1fr)_minmax(180px,1.5fr)_58px] items-center gap-2 px-4 text-[9.5px] text-[#3f526d]">
            <span>{index + 1}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{row.name}</p>
              <p className="text-[8px] text-[#8a96a7]">{integer(row.policies)} policies</p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_62px] items-center gap-2">
              <div className="h-2 overflow-hidden rounded-sm bg-[#e9eef5]">
                <div className="h-full rounded-sm bg-[#347ed0]" style={{ width: Math.max((row.value / max) * 100, 2) + "%" }} />
              </div>
              <span className="text-right font-bold tabular-nums">{compactCurrency(row.value)}</span>
            </div>
            <span className="text-right font-semibold tabular-nums">{percent((row.value / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsurerTable({ rows }: { rows: CommercialRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="max-h-[330px] overflow-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]">
          <tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]">
            <th className="px-4 py-2.5 text-left">Insurer Name</th>
            <th className="px-3 py-2.5 text-right">Policies</th>
            <th className="px-3 py-2.5 text-right">Net Premium</th>
            <th className="px-3 py-2.5 text-right">Pay-in</th>
            <th className="px-4 py-2.5 text-right">Retention</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf1f5]">
          {rows.map((row) => {
            const logo = getInsurerLogo(row.name);
            return (
              <tr key={row.key} className="text-[9.5px] text-[#40536d]">
                <td className="px-4 py-2.5 font-semibold">
                  <div className="flex min-w-0 items-center gap-2">
                    {logo ? <Image src={logo} alt={row.name + " logo"} width={24} height={20} className="max-h-5 max-w-7 shrink-0 object-contain" /> : null}
                    <span className="truncate">{row.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{integer(row.policies)}</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{currency(row.netPremium)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.payin)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{retentionDisplay(row.retention, row.payin)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RmTable({ rows }: { rows: CommercialRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full min-w-[1020px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]">
          <tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]">
            <th className="px-5 py-2.5 text-left">RM Name</th>
            <th className="px-3 py-2.5 text-right">Policies</th>
            <th className="px-3 py-2.5 text-right">Net Premium</th>
            <th className="px-3 py-2.5 text-right">Pay-in</th>
            <th className="px-3 py-2.5 text-right">Payout</th>
            <th className="px-5 py-2.5 text-right">Retention</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf1f5]">
          {rows.map((row) => (
            <tr key={row.key} className="text-[9.8px] text-[#40536d]">
              <td className="px-5 py-2.5 font-semibold">{row.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{integer(row.policies)}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{currency(row.netPremium)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.payin)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.payout)}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{retentionDisplay(row.retention, row.payin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntermediaryTable({ rows }: { rows: CommercialRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="max-h-[390px] overflow-auto">
      <table className="w-full min-w-[1280px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]">
          <tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]">
            <th className="px-5 py-2.5 text-left">Name / Intermediary</th>
            <th className="px-3 py-2.5 text-left">Type</th>
            <th className="px-3 py-2.5 text-left">RM</th>
            <th className="px-3 py-2.5 text-right">Policies</th>
            <th className="px-3 py-2.5 text-right">Net Premium</th>
            <th className="px-3 py-2.5 text-right">Pay-in</th>
            <th className="px-3 py-2.5 text-right">Payout</th>
            <th className="px-5 py-2.5 text-right">Retention</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf1f5]">
          {rows.map((row) => (
            <tr key={row.key} className="text-[9.8px] text-[#40536d]">
              <td className="px-5 py-2.5 font-semibold">{row.name}</td>
              <td className="px-3 py-2.5 font-semibold uppercase">{row.type || "—"}</td>
              <td className="px-3 py-2.5">{row.rm || "Unassigned"}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{integer(row.policies)}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{currency(row.netPremium)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.payin)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{currency(row.payout)}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{retentionDisplay(row.retention, row.payin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildInsurerRows(finance: FinanceReport): CommercialRow[] {
  const totals = new Map<string, CommercialRow>();
  for (const row of finance.register.rows) {
    const name = row.insurer_name.trim() || "Unassigned";
    const key = (row.insurance_company_id || name).toLowerCase();
    const current = totals.get(key) ?? baseCommercialRow(key, name);
    addCommercialRow(current, row.net_premium, row.projected_payin, row.gross_payout, row.retention_amount);
    totals.set(key, current);
  }
  return sortCommercialRows(totals);
}

function buildRmRows(finance: FinanceReport): CommercialRow[] {
  const totals = new Map<string, CommercialRow>();
  for (const row of finance.register.rows) {
    const name = row.rm_name?.trim() || "Unassigned";
    const key = name.toLowerCase();
    const current = totals.get(key) ?? baseCommercialRow(key, name);
    addCommercialRow(current, row.net_premium, row.projected_payin, row.gross_payout, row.retention_amount);
    totals.set(key, current);
  }
  return sortCommercialRows(totals);
}

function buildIntermediaryRows(finance: FinanceReport, report: PolicyBusinessNetReport): CommercialRow[] {
  const metadata = new Map(report.filters.intermediaries.map((item) => [item.code, item]));
  const totals = new Map<string, CommercialRow & { rmNames: Set<string> }>();
  for (const row of finance.register.rows) {
    const code = row.intermediary_code?.trim() || "unassigned";
    const meta = metadata.get(code);
    const name = code === "unassigned" ? "Unassigned" : meta?.name || code;
    const current = totals.get(code) ?? { ...baseCommercialRow(code, name), type: meta?.type || "—", rmNames: new Set<string>() };
    if (row.rm_name?.trim()) current.rmNames.add(row.rm_name.trim());
    addCommercialRow(current, row.net_premium, row.projected_payin, row.gross_payout, row.retention_amount);
    totals.set(code, current);
  }
  return Array.from(totals.values())
    .map((row) => ({ ...row, rm: row.rmNames.size === 0 ? "Unassigned" : row.rmNames.size === 1 ? Array.from(row.rmNames)[0] : "Multiple RMs" }))
    .sort((a, b) => b.netPremium - a.netPremium || b.policies - a.policies || a.name.localeCompare(b.name));
}

function buildBusinessTypeRows(report: PolicyBusinessNetReport) {
  const totals = new Map<string, { key: string; name: string; policies: number; value: number }>();
  for (const row of report.register.rows) {
    const name = row.business_type?.trim() || row.business_line?.trim() || row.category?.trim() || "Unclassified";
    const key = name.toLowerCase();
    const current = totals.get(key) ?? { key, name, policies: 0, value: 0 };
    current.policies += 1;
    current.value += row.net_premium || 0;
    totals.set(key, current);
  }
  return Array.from(totals.values()).sort((a, b) => b.value - a.value || b.policies - a.policies || a.name.localeCompare(b.name));
}

function baseCommercialRow(key: string, name: string): CommercialRow {
  return { key, name, policies: 0, netPremium: 0, payin: 0, payout: 0, retention: 0 };
}

function addCommercialRow(target: CommercialRow, netPremium: number, payin: number, payout: number, retention: number) {
  target.policies += 1;
  target.netPremium += netPremium || 0;
  target.payin += payin || 0;
  target.payout += payout || 0;
  target.retention += retention || 0;
}

function sortCommercialRows(totals: Map<string, CommercialRow>) {
  return Array.from(totals.values()).sort((a, b) => b.netPremium - a.netPremium || b.policies - a.policies || a.name.localeCompare(b.name));
}

function CustomDateRange({ filters }: { filters: PolicyBusinessFilters }) {
  return (
    <form action="/reports/business" method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-2">
      <input type="hidden" name="period" value="custom" />
      {filters.insurerId ? <input type="hidden" name="insurer" value={filters.insurerId} /> : null}
      {filters.rmEmployeeId ? <input type="hidden" name="rm" value={filters.rmEmployeeId} /> : null}
      {filters.intermediaryCode ? <input type="hidden" name="intermediary" value={filters.intermediaryCode} /> : null}
      {filters.businessLine ? <input type="hidden" name="business" value={filters.businessLine} /> : null}
      {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
      <label className="grid gap-1 text-[8px] font-black uppercase tracking-[.08em] text-[#7b8799]">
        From
        <input name="from" type="date" required defaultValue={filters.fromDate ?? ""} className="h-8 min-w-[132px] rounded-lg border border-[#d7dfeb] bg-white px-2.5 text-[10px] font-semibold text-[#263750] outline-none focus:border-[#5871aa]" />
      </label>
      <label className="grid gap-1 text-[8px] font-black uppercase tracking-[.08em] text-[#7b8799]">
        To
        <input name="to" type="date" required defaultValue={filters.toDate ?? ""} className="h-8 min-w-[132px] rounded-lg border border-[#d7dfeb] bg-white px-2.5 text-[10px] font-semibold text-[#263750] outline-none focus:border-[#5871aa]" />
      </label>
      <button type="submit" className="h-8 rounded-lg bg-[#223a78] px-3 text-[9.5px] font-bold text-white transition hover:bg-[#1c3167]">Apply</button>
    </form>
  );
}

function HeaderTitle({ title }: { title: string }) {
  return <h2 className="text-[13px] font-bold text-[#1b2943]">{title}</h2>;
}

function Header({ title }: { title: string }) {
  return <div className="border-b border-[#e6ebf2] px-4 py-3"><HeaderTitle title={title} /></div>;
}

function Empty() {
  return <ReportEmptyState />;
}

function retentionDisplay(amount: number, payin: number) {
  return currency(amount) + " · " + percent(ratio(amount, payin));
}

function ratio(value: number, base: number) {
  return base > 0 ? (value / base) * 100 : 0;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function compactCurrency(value: number) {
  const number = Math.abs(value || 0);
  const format = (amount: number, suffix: string) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(amount) + " " + suffix;
  if (number >= 1e7) return format(number / 1e7, "Cr");
  if (number >= 1e5) return format(number / 1e5, "L");
  if (number >= 1e3) return format(number / 1e3, "K");
  return "₹" + integer(number);
}

function integer(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function percent(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value || 0) + "%";
}

function reportHref(path: string, filters: PolicyBusinessFilters, mix?: string) {
  const search = new URLSearchParams();
  search.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.fromDate) search.set("from", filters.fromDate);
    if (filters.toDate) search.set("to", filters.toDate);
  }
  if (filters.insurerId) search.set("insurer", filters.insurerId);
  if (filters.rmEmployeeId) search.set("rm", filters.rmEmployeeId);
  if (filters.intermediaryCode) search.set("intermediary", filters.intermediaryCode);
  if (filters.businessLine) search.set("business", filters.businessLine);
  if (filters.category) search.set("category", filters.category);
  if (mix && path === "/reports/business") search.set("mix", mix);
  return path + "?" + search.toString();
}

function fallbackFilters(): PolicyBusinessFilters {
  return { period: "mtd", fromDate: null, toDate: null, insurerId: null, rmEmployeeId: null, intermediaryCode: null, businessLine: null, category: null, page: 1 };
}

function emptyBusinessReport(): PolicyBusinessNetReport {
  return {
    summary: { policy_count: 0, active_policy_count: 0, gross_premium: 0, net_premium: 0, od_premium: 0, tp_premium: 0, cpa_amount: 0, average_net_premium: 0, insurer_count: 0, intermediary_count: 0, motor_policy_count: 0, non_motor_policy_count: 0, motor_net_premium: 0, non_motor_net_premium: 0 },
    trend: [],
    category_mix: [],
    insurers: [],
    rms: [],
    filters: { insurers: [], rms: [], intermediaries: [], categories: [] },
    register: { rows: [], total_count: 0, page: 1, page_size: 25 },
  };
}
