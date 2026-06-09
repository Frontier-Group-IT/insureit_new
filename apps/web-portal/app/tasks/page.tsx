import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

const tasks = ["Call customer for missing RC copy", "Collect repair estimate from garage", "Confirm surveyor inspection slot", "Upload final bill to insurer portal"];

export default function TasksPage() {
  return <AppShell><PageHeader title="Follow-up tasks" description="Assign, prioritize, and close claim follow-ups across processors and field executives." /><SearchFilterBar searchPlaceholder="Search tasks by claim no, assignee, customer, or due date" filterLabel="Task status" /><div className="grid gap-4 md:grid-cols-2">{tasks.map((task, index) => <Card key={task}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-navy-900">{task}</p><p className="mt-2 text-sm text-slate-500">CB-2026-000{index + 1} · Due today · Assigned to claim processor</p></div><StatusBadge status={index === 0 ? "Documents Pending" : "Approval Pending"} /></div><button className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" type="button">Mark complete</button></Card>)}</div><div className="mt-4"><EmptyState className="hidden" title="No follow-up tasks" description="Completed or filtered tasks will leave this queue clean for processors." /></div></AppShell>;
}
