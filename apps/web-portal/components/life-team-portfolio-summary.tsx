import Link from "next/link";
import type { LifeHealthCaseSummary } from "@/lib/life-health-case-summary";

export function LifeTeamPortfolioSummary({ operations, summary }: { operations: boolean; summary: LifeHealthCaseSummary | null }) {
  const cards = [
    { label: "All Life / Health cases", count: summary?.all, status: "all" },
    { label: "Awaiting policy", count: summary?.pending, status: "pending" },
    { label: "Issued cases", count: summary?.issued, status: "issued" },
    { label: "Rejected cases", count: summary?.rejected, status: "rejected" },
  ];
  const ordered = operations ? [cards[1], cards[0], cards[2], cards[3]] : cards;
  return <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <h2 className="text-sm font-semibold text-slate-900">{operations ? "Life & Health operations" : "Team business portfolio"}</h2>
    <p className="mt-1 text-xs text-slate-600">Team hierarchy across insurance categories; independent Sankalp Direct Business included for Life and Health only. Case counts below are all-time Life and Health.</p>
    {!summary && <p role="alert" className="mt-2 text-xs text-red-700">Case totals could not be refreshed.</p>}
    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ordered.map(card => <Link key={card.status} href={`/policies/life-health-cases?status=${card.status}`} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
        <p className="text-xs text-slate-600">{card.label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{card.count?.toLocaleString("en-IN") ?? "—"}</p>
      </Link>)}
    </div>
  </section>;
}
