import { AppShell, Card, PageHeader } from "@/components/shell";

export default function ReportsPage() {
  return <AppShell><PageHeader title="Reports" description="Operational and settlement reporting for claim volumes, pending work, and insurer turnaround time." /><div className="grid gap-4 md:grid-cols-3"><Card><p className="text-sm text-slate-500">Average settlement TAT</p><p className="mt-3 text-3xl font-bold text-navy-900">18 days</p></Card><Card><p className="text-sm text-slate-500">Claims by status</p><p className="mt-3 text-3xl font-bold text-navy-900">16 stages</p></Card><Card><p className="text-sm text-slate-500">Document rejection rate</p><p className="mt-3 text-3xl font-bold text-navy-900">6.4%</p></Card></div></AppShell>;
}
