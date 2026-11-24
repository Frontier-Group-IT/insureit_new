import Link from "next/link";
import type { DashboardBusinessData } from "@/app/dashboard-v2/dashboard-business";
import type { LifeHealthCaseSummary } from "@/lib/life-health-case-summary";

export function LifeTeamPortfolioSummary({ operations, summary, business }: { operations: boolean; summary: LifeHealthCaseSummary | null; business: DashboardBusinessData }) {
  const cards = [
    { label: "All Life / Health cases", count: summary?.all, status: "all" },
    { label: "Awaiting policy", count: summary?.pending, status: "pending" },
    { label: "Issued cases", count: summary?.issued, status: "issued" },
    { label: "Rejected cases", count: summary?.rejected, status: "rejected" },
  ];
  const production = business.lifeTeamProduction;
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value);
  const ordered = operations ? [cards[1], cards[0], cards[2], cards[3]] : cards;
  return <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold text-slate-900">{operations ? "Life & Health operations" : "Team business portfolio"}</h2>
    <p className="mt-1 text-xs text-slate-600">Team hierarchy across insurance categories; independent Sankalp Direct Business included for Life and Health only. Case counts below are all-time Life and Health.</p>
    {!summary && <p role="alert" className="mt-2 text-xs text-red-700">Case totals could not be refreshed.</p>}
    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ordered.map(card => <Link key={card.status} prefetch={false} href={`/policies/life-health-cases?status=${card.status}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
        <p className="text-xs text-slate-600">{card.label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{card.count?.toLocaleString("en-IN") ?? "—"}</p>
      </Link>)}
    </div>
    {production && <div className="mt-4 border-t border-slate-200 pt-3">
      <h3 className="text-xs font-semibold text-slate-900">Booked policy production · {business.periodLabel}</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-600">Team-generated business</p><p className="mt-1 text-base font-semibold">{money(production.teamGross)}</p><p className="text-xs text-slate-600">{production.teamPolicies.toLocaleString("en-IN")} policies</p></div>
        <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-600">Sankalp Direct Business · Life &amp; Health</p><p className="mt-1 text-base font-semibold">{money(production.directGross)}</p><p className="text-xs text-slate-600">{production.directPolicies.toLocaleString("en-IN")} policies · independently attributed</p></div>
      </div>
      <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-slate-700">Team RM contribution</summary>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b"><th className="py-2">RM</th><th className="py-2 text-right">Policies</th><th className="py-2 text-right">Gross premium</th></tr></thead><tbody>{production.rms.map(row=><tr key={row.key} className="border-b border-slate-100"><td className="py-2">{row.label}</td><td className="py-2 text-right">{row.policies}</td><td className="py-2 text-right">{production.teamGross === null ? "—" : money(row.grossPremium)}</td></tr>)}</tbody></table></div>
      </details>
      <p className="mt-2 text-xs text-slate-500">Gross booked premium for the selected dashboard period; not annualized premium or commission.</p>
    </div>}
  </section>;
}
