import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type TaskRow = { id: string; title: string; due_date: string | null; status: string; claims: { claim_no: string } | null; assignee: { full_name: string } | null };

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_tasks")
    .select("id, title, due_date, status, claims(claim_no), assignee:profiles!claim_tasks_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  return <AppShell title="Follow-up tasks"><PageHeader title="Follow-up tasks" /><SearchFilterBar searchPlaceholder="Search tasks by claim no, assignee, customer, or due date" filterLabel="Task status" />{error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No pending follow-up tasks" emptyDescription="No pending follow-up tasks." columns={[{ header: "Task", cell: (task) => <><p className="font-semibold text-navy-900">{task.title}</p><p className="text-xs text-slate-500">{task.claims?.claim_no ?? "No claim"}</p></> }, { header: "Assignee", cell: (task) => task.assignee?.full_name ?? "Unassigned" }, { header: "Due date", cell: (task) => task.due_date ?? "—" }, { header: "Status", cell: (task) => <StatusBadge status={task.status} /> }]} />}</AppShell>;
}
