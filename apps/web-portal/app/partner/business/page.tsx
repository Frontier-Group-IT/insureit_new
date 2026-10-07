import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  BriefcaseBusiness,
  Download,
  SlidersHorizontal,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import {
  getPartnerWebBusinessPerformance,
  getPartnerWebPayoutSummary,
  listPartnerWebPolicies,
  type PartnerPolicyRow,
} from "@/lib/partner-web";
import { getInsurerLogo } from "@/lib/insurer-logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BusinessSearchParams = {
  period?: string;
  from?: string;
  to?: string;
  business?: string;
  insurer?: string;
  rm?: string;
  intermediary?: string;
  mix?: string;
};

type MixMode = "business-type" | "insurer" | "rm";
type CommercialRow = {
  key: string;
  name: string;
  policies: number;
  premium: number;
  type?: string;
  rm?: string;
};

const BUSINESS_OPTIONS = ["all", "motor", "non motor", "life", "health"] as const;
const PERIOD_OPTIONS = ["mtd", "last-month", "last-6-months", "custom"] as const;

function numeric(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function currency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numeric(value));
}

function compactCurrency(value: number) {
  const amount = Math.abs(value);
  if (amount >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} Cr`;
  if (amount >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  if (amount >= 1_000) return `₹${(value / 1_000).toFixed(1)} K`;
  return currency(value);
}

function integer(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function validIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function policyDate(policy: PartnerPolicyRow) {
  return (policy.issuance_date || policy.start_date || "").slice(0, 10);
}

function normalizedBusinessType(policy: PartnerPolicyRow) {
  const source = String(policy.business_type || policy.business_line || policy.policy_type || "").trim().toLowerCase();
  if (source.includes("non") && source.includes("motor")) return "non motor";
  if (source.includes("motor")) return "motor";
  if (source.includes("life")) return "life";
  if (source.includes("health")) return "health";
  return source || "unclassified";
}

function monthBounds(reference: string, mode: string) {
  const base = new Date(`${reference}T00:00:00Z`);
  if (mode === "last-month") {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0));
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (mode === "last-6-months") {
    const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 5, 1));
    return { from: start.toISOString().slice(0, 10), to: reference };
  }
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  return { from: start.toISOString().slice(0, 10), to: reference };
}

async function loadPartnerPolicies() {
  const rows: PartnerPolicyRow[] = [];
  const pageSize = 200;
  for (let offset = 0; offset < 5000; offset += pageSize) {
    const batch = await listPartnerWebPolicies({ limit: pageSize, offset, lifecycle: "all" });
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function buildBusinessRows(rows: PartnerPolicyRow[]) {
  const standard = ["motor", "non motor", "life", "health"];
  const labels = new Map([
    ["motor", "Motor"],
    ["non motor", "Non Motor"],
    ["life", "Life"],
    ["health", "Health"],
  ]);
  const totals = new Map<string, CommercialRow>();
  for (const key of standard) totals.set(key, { key, name: labels.get(key) || key, policies: 0, premium: 0 });

  for (const policy of rows) {
    const key = normalizedBusinessType(policy);
    const current = totals.get(key) ?? { key, name: key === "unclassified" ? "Unclassified" : key.replace(/\b\w/g, (m) => m.toUpperCase()), policies: 0, premium: 0 };
    current.policies += 1;
    current.premium += numeric(policy.premium_amount);
    totals.set(key, current);
  }

  const standardRows = standard.map((key) => totals.get(key)!);
  const extras = [...totals.values()].filter((row) => !standard.includes(row.key)).sort((a, b) => b.premium - a.premium || b.policies - a.policies);
  return [...standardRows, ...extras];
}

function aggregate(rows: PartnerPolicyRow[], getKey: (row: PartnerPolicyRow) => string, getName: (row: PartnerPolicyRow) => string) {
  const totals = new Map<string, CommercialRow>();
  for (const policy of rows) {
    const key = getKey(policy) || "unassigned";
    const name = getName(policy) || "Unassigned";
    const current = totals.get(key) ?? { key, name, policies: 0, premium: 0 };
    current.policies += 1;
    current.premium += numeric(policy.premium_amount);
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.premium - a.premium || b.policies - a.policies || a.name.localeCompare(b.name));
}

function buildIntermediaryRows(rows: PartnerPolicyRow[]) {
  const totals = new Map<string, CommercialRow & { rmNames: Set<string> }>();
  for (const policy of rows) {
    const code = policy.intermediary_code?.trim() || "unassigned";
    const name = policy.intermediary_group_name?.trim() || code;
    const current = totals.get(code) ?? {
      key: code,
      name: code === "unassigned" ? "Unassigned" : name,
      type: policy.intermediary_type || "—",
      policies: 0,
      premium: 0,
      rmNames: new Set<string>(),
    };
    if (policy.rm_name?.trim()) current.rmNames.add(policy.rm_name.trim());
    current.policies += 1;
    current.premium += numeric(policy.premium_amount);
    totals.set(code, current);
  }
  return [...totals.values()]
    .map((row) => ({
      key: row.key,
      name: row.name,
      type: row.type,
      policies: row.policies,
      premium: row.premium,
      rm: row.rmNames.size === 0 ? "Unassigned" : row.rmNames.size === 1 ? [...row.rmNames][0] : "Multiple RMs",
    }))
    .sort((a, b) => b.premium - a.premium || b.policies - a.policies || a.name.localeCompare(b.name));
}

function queryHref(query: BusinessSearchParams, overrides: Record<string, string | undefined> = {}) {
  const params = new URLSearchParams();
  const merged = { ...query, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  return `/partner/business?${params.toString()}`;
}

export default async function PartnerBusinessPage({ searchParams }: { searchParams: Promise<BusinessSearchParams> }) {
  const query = await searchParams;
  const [performance, policies, payout] = await Promise.all([
    getPartnerWebBusinessPerformance(),
    loadPartnerPolicies(),
    getPartnerWebPayoutSummary().catch(() => null),
  ]);

  const generatedDay = validIsoDate(performance.generated_at?.slice(0, 10))
    ? performance.generated_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const period = PERIOD_OPTIONS.includes(query.period as (typeof PERIOD_OPTIONS)[number]) ? String(query.period) : "mtd";
  const customRange = period === "custom" && validIsoDate(query.from) && validIsoDate(query.to) && String(query.from) <= String(query.to);
  const bounds = customRange ? { from: String(query.from), to: String(query.to) } : monthBounds(generatedDay, period);

  const business = BUSINESS_OPTIONS.includes(query.business as (typeof BUSINESS_OPTIONS)[number]) ? String(query.business) : "all";

  const insurerOptions = [...new Set(policies.map((row) => row.insurer_name?.trim()).filter(Boolean) as string[])].sort();
  const rmOptions = [...new Set(policies.map((row) => row.rm_name?.trim()).filter(Boolean) as string[])].sort();
  const intermediaryOptions = [...new Set(policies.map((row) => row.intermediary_code?.trim()).filter(Boolean) as string[])].sort();

  const filtered = policies.filter((policy) => {
    const date = policyDate(policy);
    if (!date || date < bounds.from || date > bounds.to) return false;
    if (business !== "all" && normalizedBusinessType(policy) !== business) return false;
    if (query.insurer && policy.insurer_name !== query.insurer) return false;
    if (query.rm && policy.rm_name !== query.rm) return false;
    if (query.intermediary && policy.intermediary_code !== query.intermediary) return false;
    return true;
  });

  const totalPremium = filtered.reduce((sum, row) => sum + numeric(row.premium_amount), 0);
  const uniqueCustomers = new Set(filtered.map((row) => row.customer_id).filter(Boolean)).size;
  const businessRows = buildBusinessRows(filtered);
  const insurerRows = aggregate(filtered, (row) => row.insurer_name?.toLowerCase() || "unassigned", (row) => row.insurer_name || "Unassigned");
  const rmRows = aggregate(filtered, (row) => row.rm_name?.toLowerCase() || "unassigned", (row) => row.rm_name || "Unassigned");
  const intermediaryRows = buildIntermediaryRows(filtered);

  const mixMode: MixMode = query.mix === "insurer" || query.mix === "rm" ? query.mix : "business-type";
  const mixRows = mixMode === "insurer" ? insurerRows : mixMode === "rm" ? rmRows : businessRows;
  const mixLabel = mixMode === "insurer" ? "Insurer" : mixMode === "rm" ? "RM" : "Business Type";
  const payoutValue = payout?.available ? numeric(payout.paid_amount) : null;

  const exportHref = `/partner/business/export?${new URLSearchParams(
    Object.entries({
      period,
      from: customRange ? bounds.from : "",
      to: customRange ? bounds.to : "",
      business: business === "all" ? "" : business,
      insurer: query.insurer || "",
      rm: query.rm || "",
      intermediary: query.intermediary || "",
    }).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString()}`;

  return (
    <PartnerPortalShell title="My Business">
      <div className="space-y-3 pb-4">
        <section className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dfe6ef] pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.09em] text-[#7b8ca4]">Reports</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.04em] text-[#182d50]">Business</h1>
          </div>

          <form method="get" className="flex flex-wrap items-center justify-end gap-2">
            <select name="period" defaultValue={period} className="h-10 min-w-[146px] rounded-lg border border-[#d4deeb] bg-white px-3 text-[11px] font-bold text-[#30445f]">
              <option value="mtd">MTD</option>
              <option value="last-month">Last Month</option>
              <option value="last-6-months">Last 6 Months</option>
              <option value="custom">Custom</option>
            </select>
            <select name="business" defaultValue={business} className="h-10 min-w-[170px] rounded-lg border border-[#d4deeb] bg-white px-3 text-[11px] font-bold text-[#30445f]">
              <option value="all">All Business</option>
              <option value="motor">Motor</option>
              <option value="non motor">Non Motor</option>
              <option value="life">Life</option>
              <option value="health">Health</option>
            </select>

            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-[#d4deeb] bg-white px-3 text-[11px] font-bold text-[#30445f]">
                <SlidersHorizontal size={15} /> Filters
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-[280px] space-y-2 rounded-xl border border-[#dbe3ee] bg-white p-3 shadow-xl">
                <select name="insurer" defaultValue={query.insurer || ""} className="h-9 w-full rounded-lg border border-[#dbe3ee] px-2 text-[10px]">
                  <option value="">All insurers</option>
                  {insurerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <select name="rm" defaultValue={query.rm || ""} className="h-9 w-full rounded-lg border border-[#dbe3ee] px-2 text-[10px]">
                  <option value="">All RMs</option>
                  {rmOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <select name="intermediary" defaultValue={query.intermediary || ""} className="h-9 w-full rounded-lg border border-[#dbe3ee] px-2 text-[10px]">
                  <option value="">All intermediaries</option>
                  {intermediaryOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
                {period === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input name="from" type="date" defaultValue={bounds.from} className="h-9 rounded-lg border border-[#dbe3ee] px-2 text-[9px]" />
                    <input name="to" type="date" defaultValue={bounds.to} className="h-9 rounded-lg border border-[#dbe3ee] px-2 text-[9px]" />
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 pt-1">
                  <Link href="/partner/business" className="rounded-lg border border-[#d4deeb] px-3 py-2 text-[9px] font-bold text-[#52657f]">Clear</Link>
                  <button type="submit" className="rounded-lg bg-[#1f5fae] px-3 py-2 text-[9px] font-bold text-white">Apply</button>
                </div>
              </div>
            </details>

            <button type="submit" className="h-10 rounded-lg border border-[#d4deeb] bg-white px-4 text-[11px] font-bold text-[#30445f]">Apply</button>
            <Link href={exportHref} className="flex h-10 items-center gap-2 rounded-lg bg-[#1166ad] px-4 text-[11px] font-extrabold text-white">
              <Download size={15} /> Export
            </Link>
          </form>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-[#dfe6ef] bg-white md:grid-cols-4">
          <Metric label="Business Premium" value={currency(totalPremium)} note={`${integer(filtered.length)} policies`} icon={BarChart3} />
          <Metric label="Partner Payout" value={payoutValue === null ? "Restricted" : currency(payoutValue)} note={payout?.available ? `${integer(payout.paid_count)} paid` : "Based on your authorized payout scope"} icon={WalletCards} />
          <Metric label="Policies" value={integer(filtered.length)} note={`${bounds.from} to ${bounds.to}`} icon={BriefcaseBusiness} />
          <Metric label="Customers" value={integer(uniqueCustomers)} note="Unique customers in selected period" icon={UsersRound} last />
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.05fr_1fr]">
          <article className="flex h-[278px] min-h-0 flex-col overflow-hidden rounded-xl border border-[#dfe6ef] bg-white">
            <div className="flex min-h-12 shrink-0 items-center justify-between border-b border-[#e6ebf2] px-4">
              <h2 className="text-[14px] font-extrabold text-[#1b3154]">Business Mix</h2>
              <div className="inline-flex overflow-hidden rounded-lg border border-[#dbe3ee] text-[9px] font-bold">
                <MixTab href={queryHref(query, { mix: "business-type" })} active={mixMode === "business-type"}>Business Type</MixTab>
                <MixTab href={queryHref(query, { mix: "insurer" })} active={mixMode === "insurer"}>Insurer</MixTab>
                <MixTab href={queryHref(query, { mix: "rm" })} active={mixMode === "rm"}>RM</MixTab>
              </div>
            </div>
            <BusinessMix rows={mixRows} label={mixLabel} />
          </article>

          <article className="flex h-[278px] min-h-0 flex-col overflow-hidden rounded-xl border border-[#dfe6ef] bg-white">
            <div className="min-h-12 shrink-0 border-b border-[#e6ebf2] px-4 py-3">
              <h2 className="text-[14px] font-extrabold text-[#1b3154]">Insurer</h2>
            </div>
            <InsurerTable rows={insurerRows} />
          </article>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#dfe6ef] bg-white">
          <Header title="RM Performance" />
          <SimpleCommercialTable rows={rmRows} firstLabel="RM Name" />
        </section>

        <section className="overflow-hidden rounded-xl border border-[#dfe6ef] bg-white">
          <Header title="Intermediaries Business" />
          <IntermediaryTable rows={intermediaryRows} />
        </section>

        <p className="px-1 text-[9px] text-[#8190a4]">
          Partner view is restricted to your authorized business scope. Pay-in is intentionally not shown on this page.
        </p>
      </div>
    </PartnerPortalShell>
  );
}

function Metric({ label, value, note, icon: Icon, last = false }: { label: string; value: string; note: string; icon: typeof BarChart3; last?: boolean }) {
  return (
    <div className={`flex min-h-[112px] items-center gap-3 px-5 py-4 ${last ? "" : "border-b border-[#e5ebf2] md:border-b-0 md:border-r"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#1c6ac4]"><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.07em] text-[#6f829d]">{label}</p>
        <p className="mt-1 truncate text-[21px] font-extrabold text-[#172d51]">{value}</p>
        <p className="mt-1 truncate text-[8.5px] text-[#7d8da4]">{note}</p>
      </div>
    </div>
  );
}

function MixTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={active ? "bg-[#1f62b4] px-3 py-2 text-white" : "bg-white px-3 py-2 text-[#5f7088]"}>{children}</Link>;
}

function BusinessMix({ rows, label }: { rows: CommercialRow[]; label: string }) {
  const total = rows.reduce((sum, row) => sum + row.premium, 0) || 1;
  const max = Math.max(1, ...rows.map((row) => row.premium));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 grid grid-cols-[28px_minmax(120px,1fr)_minmax(150px,1.5fr)_58px] gap-2 bg-[#f8fafc] px-4 py-2 text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]">
        <span>#</span><span>{label}</span><span>Premium</span><span className="text-right">Share</span>
      </div>
      <div className="divide-y divide-[#edf1f5]">
        {rows.map((row, index) => (
          <div key={row.key} className="grid min-h-10 grid-cols-[28px_minmax(120px,1fr)_minmax(150px,1.5fr)_58px] items-center gap-2 px-4 text-[9.5px] text-[#3f526d]">
            <span>{index + 1}</span>
            <div className="min-w-0"><p className="truncate font-semibold">{row.name}</p><p className="text-[8px] text-[#8a96a7]">{integer(row.policies)} policies</p></div>
            <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-2">
              <div className="h-2 overflow-hidden rounded-sm bg-[#e9eef5]"><div className="h-full rounded-sm bg-[#347ed0]" style={{ width: row.premium > 0 ? `${Math.max((row.premium / max) * 100, 2)}%` : "0%" }} /></div>
              <span className="text-right font-bold tabular-nums">{compactCurrency(row.premium)}</span>
            </div>
            <span className="text-right font-semibold tabular-nums">{percent((row.premium / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsurerTable({ rows }: { rows: CommercialRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[620px] border-collapse">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]"><tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]"><th className="px-4 py-2.5 text-left">Insurer Name</th><th className="px-3 py-2.5 text-right">Policies</th><th className="px-4 py-2.5 text-right">Premium</th></tr></thead>
        <tbody className="divide-y divide-[#edf1f5]">
          {rows.map((row) => {
            const logo = getInsurerLogo(row.name);
            return <tr key={row.key} className="text-[9.5px] text-[#40536d]"><td className="px-4 py-2.5 font-semibold"><div className="flex min-w-0 items-center gap-2">{logo ? <Image src={logo} alt={`${row.name} logo`} width={24} height={20} className="max-h-5 max-w-7 shrink-0 object-contain" /> : null}<span className="truncate">{row.name}</span></div></td><td className="px-3 py-2.5 text-right tabular-nums">{integer(row.policies)}</td><td className="px-4 py-2.5 text-right font-bold tabular-nums">{currency(row.premium)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function Header({ title }: { title: string }) {
  return <div className="border-b border-[#e6ebf2] px-4 py-3"><h2 className="text-[14px] font-extrabold text-[#1b3154]">{title}</h2></div>;
}

function SimpleCommercialTable({ rows, firstLabel }: { rows: CommercialRow[]; firstLabel: string }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead className="bg-[#f8fafc]"><tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]"><th className="px-5 py-2.5 text-left">{firstLabel}</th><th className="px-3 py-2.5 text-right">Policies</th><th className="px-5 py-2.5 text-right">Premium</th></tr></thead>
        <tbody className="divide-y divide-[#edf1f5]">{rows.map((row) => <tr key={row.key} className="text-[9.8px] text-[#40536d]"><td className="px-5 py-2.5 font-semibold">{row.name}</td><td className="px-3 py-2.5 text-right">{integer(row.policies)}</td><td className="px-5 py-2.5 text-right font-bold">{currency(row.premium)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function IntermediaryTable({ rows }: { rows: CommercialRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead className="bg-[#f8fafc]"><tr className="text-[8px] font-black uppercase tracking-[.06em] text-[#7a899c]"><th className="px-5 py-2.5 text-left">Name / Intermediary</th><th className="px-3 py-2.5 text-left">Type</th><th className="px-3 py-2.5 text-left">RM</th><th className="px-3 py-2.5 text-right">Policies</th><th className="px-5 py-2.5 text-right">Premium</th></tr></thead>
        <tbody className="divide-y divide-[#edf1f5]">{rows.map((row) => <tr key={row.key} className="text-[9.8px] text-[#40536d]"><td className="px-5 py-2.5 font-semibold">{row.name}</td><td className="px-3 py-2.5 font-semibold uppercase">{row.type || "—"}</td><td className="px-3 py-2.5">{row.rm || "Unassigned"}</td><td className="px-3 py-2.5 text-right">{integer(row.policies)}</td><td className="px-5 py-2.5 text-right font-bold">{currency(row.premium)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <div className="px-5 py-8 text-center text-[10px] text-[#8a97aa]">No records for the selected filters.</div>;
}
