import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  claims: { claim_no: string } | null;
  assignee: { full_name: string } | null;
};

type SearchParams = { q?: string; status?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_tasks")
    .select("id, title, due_date, status, claims(claim_no), assignee:profiles!claim_tasks_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  const query = (params.q ?? "").trim().toLowerCase();
  const selectedStatus = params.status && params.status !== "all" ? params.status : null;
  const rows = (data ?? []).filter((task) => {
    const haystack = [task.title, task.claims?.claim_no, task.assignee?.full_name, task.due_date, task.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!selectedStatus || task.status === selectedStatus) && (!query || haystack.includes(query));
  });
  const filterOptions = Array.from(new Set((data ?? []).map((task) => task.status)))
    .sort()
    .map((status) => ({ value: status, label: status.replaceAll("_", " ") }));

  return (
    <AppShell title="Follow-up tasks">
      <PageHeader title="Follow-up tasks" />
      <SearchFilterBar
        searchPlaceholder="Search by task, claim no., assignee, or due date"
        filterLabel="Task status"
        filterOptions={filterOptions}
        defaultSearch={params.q ?? ""}
        defaultFilter={selectedStatus ?? "all"}
      />
      {error ? (
        <DataError message="Tasks could not be loaded. Please retry." />
      ) : (
        <DataTable
          rows={rows}
          emptyTitle="No matching tasks"
          emptyDescription="No tasks match the selected search and status."
          columns={[
            { header: "Task", cell: (task) => <><p className="font-semibold text-navy-900">{task.title}</p><p className="text-xs text-slate-500">{task.claims?.claim_no ?? "No claim"}</p></> },
            { header: "Assignee", cell: (task) => task.assignee?.full_name ?? "Unassigned" },
            { header: "Due date", cell: (task) => task.due_date ?? "-" },
            { header: "Status", cell: (task) => <StatusBadge status={task.status} /> }
          ]}
        />
      )}
    </AppShell>
  );
}
