import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type HistoryRow = { id: string; to_status: string; from_status: string | null; notes: string | null; created_at: string; claims: { id: string; claim_no: string } | null; actor: { full_name: string } | null };

export default async function TimelinePage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_status_history")
    .select("id, from_status, to_status, notes, created_at, claims(id, claim_no), actor:profiles!claim_status_history_changed_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  return <AppShell title="Claim status timeline"><PageHeader title="Claim status timeline" /><SearchFilterBar searchPlaceholder="Search timeline by claim no, status, actor, or notes" filterLabel="Timeline status" />{error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No claim status updates available yet" emptyDescription="No claim status updates available yet." columns={[{ header: "Claim", cell: (item) => item.claims ? <Link className="font-semibold text-navy-700" href={`/claims/${item.claims.id}`}>{item.claims.claim_no}</Link> : "—" }, { header: "From", cell: (item) => item.from_status ? <StatusBadge status={item.from_status} /> : "—" }, { header: "To", cell: (item) => <StatusBadge status={item.to_status} /> }, { header: "Actor", cell: (item) => item.actor?.full_name ?? "—" }, { header: "Recorded", cell: (item) => new Date(item.created_at).toLocaleString() }, { header: "Notes", cell: (item) => item.notes ?? "—" }]} />}</AppShell>;
}
