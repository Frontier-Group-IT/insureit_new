import { claimStatuses } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";

export default function TimelinePage() {
  return <AppShell><PageHeader title="Claim status timeline" description="A chronological view of process milestones for auditability and customer communication." /><Card><ol className="relative border-l border-slate-200 pl-6">{claimStatuses.slice(0, 8).map((status, index) => <li className="mb-6" key={status}><span className="absolute -left-2 mt-1 h-4 w-4 rounded-full bg-green-600 ring-4 ring-green-50" /><p className="font-semibold text-navy-900">{status}</p><p className="text-sm text-slate-500">Step {index + 1} recorded by operations team.</p></li>)}</ol></Card></AppShell>;
}
