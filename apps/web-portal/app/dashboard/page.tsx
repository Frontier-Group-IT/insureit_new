import { AppShell, Card, PageHeader } from "@/components/shell";
import { sampleClaims } from "@/components/data";

const stats = [
  ["Open claims", "128", "+14 this week"],
  ["Documents pending", "37", "Needs follow-up"],
  ["Settled value", "₹42.8L", "Current quarter"],
  ["Overdue tasks", "9", "Action required"]
];

export default function DashboardPage() {
  return (
    <AppShell>
      <PageHeader title="Operations dashboard" description="A real-time workspace for commercial vehicle accident assistance, claim tracking, and settlements." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, hint]) => (
          <Card key={label}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold text-navy-900">{value}</p>
            <p className="mt-2 text-sm text-green-700">{hint}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-navy-900">Priority claims</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500"><tr><th className="py-2">Claim</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Estimate</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {sampleClaims.map((claim) => (
                  <tr key={claim.claimNo}><td className="py-3 font-semibold text-navy-700">{claim.claimNo}</td><td>{claim.customer}</td><td>{claim.vehicle}</td><td><span className="rounded-full bg-navy-50 px-2 py-1 text-xs text-navy-700">{claim.status}</span></td><td>{claim.amount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-navy-900">Today&apos;s focus</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>• Verify 12 uploaded documents</li>
            <li>• Assign surveyors to 4 new claims</li>
            <li>• Follow up with garages for final bills</li>
            <li>• Review rejected claim escalations</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
