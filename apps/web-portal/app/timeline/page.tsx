import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { claimPath } from "@/lib/portal-routes";

type HistoryRow = {
  id: string;
  to_status: string;
  from_status: string | null;
  notes: string | null;
  created_at: string;
  claims: { id: string; claim_no: string } | null;
  actor: { full_name: string } | null;
};

type SearchParams = { q?: string; status?: string };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_status_history")
    .select("id, from_status, to_status, notes, created_at, claims(id, claim_no), actor:profiles!claim_status_history_changed_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<HistoryRow[]>();

  const query = (params.q ?? "").trim().toLowerCase();
  const selectedStatus = params.status && params.status !== "all" ? params.status : null;
  const rows = (data ?? []).filter((item) => {
    const haystack = [item.claims?.claim_no, item.from_status, item.to_status, item.actor?.full_name, item.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (!selectedStatus || item.to_status === selectedStatus) && (!query || haystack.includes(query));
  });
  const filterOptions = Array.from(new Set((data ?? []).map((item) => item.to_status)))
    .sort()
    .map((status) => ({ value: status, label: status }));

  return (
    <AppShell title="Claim status timeline">
      <PageHeader title="Claim status timeline" />
      <SearchFilterBar
        searchPlaceholder="Search by claim no., status, actor, or notes"
        filterLabel="Result status"
        filterOptions={filterOptions}
        defaultSearch={params.q ?? ""}
        defaultFilter={selectedStatus ?? "all"}
      />
      {error ? (
        <DataError message="The claim timeline could not be loaded. Please retry." />
      ) : (
        <DataTable
          rows={rows}
          emptyTitle="No matching status updates"
          emptyDescription="No timeline entries match the selected search and status."
          columns={[
            { header: "Claim", cell: (item) => item.claims ? <Link className="font-semibold text-navy-700" href={claimPath(item.claims.id)}>{item.claims.claim_no}</Link> : "-" },
            { header: "From", cell: (item) => item.from_status ? <StatusBadge status={item.from_status} /> : "-" },
            { header: "To", cell: (item) => <StatusBadge status={item.to_status} /> },
            { header: "Actor", cell: (item) => item.actor?.full_name ?? "-" },
            { header: "Recorded", cell: (item) => formatPortalDateTime(item.created_at) },
            { header: "Notes", cell: (item) => item.notes ?? "-" }
          ]}
        />
      )}
    </AppShell>
  );
}

function formatPortalDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(value));
}
