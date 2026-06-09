import { AppShell, Card, PageHeader } from "@/components/shell";

const tasks = ["Call customer for missing RC copy", "Collect repair estimate from garage", "Confirm surveyor inspection slot", "Upload final bill to insurer portal"];

export default function TasksPage() {
  return <AppShell><PageHeader title="Follow-up tasks" description="Assign, prioritize, and close claim follow-ups across processors and field executives." /><div className="grid gap-4 md:grid-cols-2">{tasks.map((task) => <Card key={task}><p className="font-semibold text-navy-900">{task}</p><p className="mt-2 text-sm text-slate-500">Due today · Assigned to claim processor</p><button className="mt-4 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" type="button">Mark complete</button></Card>)}</div></AppShell>;
}
