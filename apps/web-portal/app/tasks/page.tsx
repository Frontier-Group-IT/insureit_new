import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { TasksWorkspace, type TaskRow } from "./tasks-workspace";

type SearchParams = { q?: string; status?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_tasks")
    .select("id, title, due_date, status, claims(claim_no), assignee:profiles!claim_tasks_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<TaskRow[]>();

  return (
    <AppShell title="Follow-up tasks">
      <PageHeader title="Follow-up tasks" />
      <TasksWorkspace rows={data ?? []} initialSearch={params.q ?? ""} initialStatus={params.status && params.status !== "all" ? params.status : ""} loadError={error ? "Tasks could not be loaded. Please retry." : null} />
    </AppShell>
  );
}
