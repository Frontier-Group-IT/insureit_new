import Link from "next/link";
import { sampleClaims } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, PriorityBadge, SearchFilterBar, StatusBadge } from "@/components/ui";

export default function ClaimsPage() {
  return (
    <AppShell>
      <PageHeader title="Claims" description="Search, filter, and monitor every accident assistance case from first report through settlement or closure." />
      <SearchFilterBar searchPlaceholder="Search by claim no, customer, vehicle no, or processor" filterLabel="Claim status" />
      <Card>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Claim no</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 text-right">Estimate</th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sampleClaims.map((claim, index) => <tr className="hover:bg-slate-50" key={claim.claimNo}><td className="px-4 py-4"><Link href={`/claims/${index + 1}`} className="font-semibold text-navy-700">{claim.claimNo}</Link><p className="text-xs text-slate-500">Open for {claim.age}</p></td><td className="px-4 py-4">{claim.customer}</td><td className="px-4 py-4 font-mono text-xs">{claim.vehicle}</td><td className="px-4 py-4"><StatusBadge status={claim.status} /></td><td className="px-4 py-4"><PriorityBadge priority={claim.priority} /></td><td className="px-4 py-4">{claim.owner}</td><td className="px-4 py-4 text-right font-semibold">{claim.amount}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4"><EmptyState className="hidden" title="No claims match this filter" description="Adjust the search text, status, or priority filters to find other claim files." /></div>
      </Card>
    </AppShell>
  );
}
