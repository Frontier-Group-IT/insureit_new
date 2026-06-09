import { claimStatuses } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { StatusBadge } from "@/components/ui";

export default function TimelinePage() {
  return <AppShell><PageHeader title="Claim status timeline" description="A chronological view of process milestones for auditability, insurer coordination, and customer communication." /><Card><ol className="relative border-l border-slate-200 pl-6">{claimStatuses.slice(0, 10).map((status, index) => <li className="mb-6" key={status}><span className="absolute -left-2 mt-1 h-4 w-4 rounded-full bg-green-600 ring-4 ring-green-50" /><div className="flex flex-wrap items-center gap-2"><StatusBadge status={status} /><span className="text-xs text-slate-500">Step {index + 1}</span></div><p className="mt-2 text-sm text-slate-500">Recorded by operations team with notes, actor, and timestamp in claim status history.</p></li>)}</ol></Card></AppShell>;
}
