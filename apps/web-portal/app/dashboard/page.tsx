import { sampleClaims } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { ErrorState, LoadingState, MetricCard, PriorityBadge, StatusBadge } from "@/components/ui";

const pipeline = [
  ["Accident reported", "24"],
  ["Documents pending", "37"],
  ["Surveyor appointed", "18"],
  ["Settlement stage", "11"]
];

export default function DashboardPage() {
  return (
    <AppShell>
      <PageHeader title="Operations dashboard" description="A professional command center for commercial vehicle accident assistance, insurer coordination, document verification, repairs, and settlements." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open claims" value="128" hint="+14 new accident reports this week" tone="navy" icon="◆" />
        <MetricCard label="Pending documents" value="37" hint="RC, DL, FIR, estimate follow-ups" tone="amber" icon="◧" />
        <MetricCard label="Settled value" value="₹42.8L" hint="Current quarter settlement support" tone="green" icon="₹" />
        <MetricCard label="Overdue tasks" value="9" hint="Needs manager attention today" tone="red" icon="!" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">Priority claim queue</h3>
              <p className="text-sm text-slate-500">High-touch claims that need processor or field action.</p>
            </div>
            <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" type="button">Export queue</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3 text-right">Estimate</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sampleClaims.map((claim) => (
                    <tr className="hover:bg-slate-50" key={claim.claimNo}><td className="px-4 py-4 font-semibold text-navy-700">{claim.claimNo}<p className="text-xs font-normal text-slate-500">Age: {claim.age}</p></td><td className="px-4 py-4">{claim.customer}</td><td className="px-4 py-4 font-mono text-xs">{claim.vehicle}</td><td className="px-4 py-4"><StatusBadge status={claim.status} /></td><td className="px-4 py-4"><PriorityBadge priority={claim.priority} /></td><td className="px-4 py-4">{claim.owner}</td><td className="px-4 py-4 text-right font-semibold">{claim.amount}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Claim pipeline</h3>
            <div className="mt-4 space-y-4">
              {pipeline.map(([label, value]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold text-navy-900">{value}</span></div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-600" style={{ width: `${Math.min(Number(value) * 3, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Today&apos;s focus</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Verify high-priority private document uploads</li>
              <li>• Confirm surveyor slots for new accidents</li>
              <li>• Follow up with garages for final bills</li>
              <li>• Review overdue insurer approvals</li>
            </ul>
          </Card>
          <LoadingState className="hidden" label="Loading live SLA indicators from Supabase..." />
          <ErrorState className="hidden" title="Example error state" description="Shown when reports, claims, or storage data cannot be loaded." />
        </div>
      </div>
    </AppShell>
  );
}
