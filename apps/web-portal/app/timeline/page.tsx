import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { TimelineWorkspace, type HistoryRow } from "./timeline-workspace";

type SearchParams = { q?: string; status?: string };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_status_history")
    .select("id, from_status, to_status, notes, created_at, claims(id, claim_no), actor:profiles!claim_status_history_changed_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  return (
    <AppShell title="Claim status timeline">
      <PageHeader title="Claim status timeline" />
      <TimelineWorkspace rows={data ?? []} initialSearch={params.q ?? ""} initialStatus={params.status && params.status !== "all" ? params.status : ""} loadError={error ? "The claim timeline could not be loaded. Please retry." : null} />
    </AppShell>
  );
}
