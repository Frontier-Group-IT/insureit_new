import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type ClaimRow = {
  id: string;
  claim_no: string;
  current_status: string;
  estimated_loss: number | null;
  settlement_amount: number | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  assignee: { full_name: string } | null;
};

function currency(value: number | null) {
  return value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default async function ClaimsPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, current_status, estimated_loss, settlement_amount, customers(company_name, contact_name), vehicles(vehicle_no), assignee:profiles!claims_assigned_to_fkey(full_name)")
    .order("created_at", { ascending: false })
    .returns<ClaimRow[]>();

  return (
    <AppShell title="Claims">
      <PageHeader title="Claims" />
      <SearchFilterBar searchPlaceholder="Search claims by number, customer, vehicle, insurer, or assignee" filterLabel="Claim status" />
      {error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No claim cases found" columns={[
        { header: "Claim", cell: (claim) => <Link href={`/claims/${claim.id}`} className="font-semibold text-navy-700">{claim.claim_no}</Link> },
        { header: "Customer", cell: (claim) => claim.customers?.company_name ?? claim.customers?.contact_name ?? "—" },
        { header: "Vehicle", cell: (claim) => <span className="font-mono text-xs">{claim.vehicles?.vehicle_no ?? "—"}</span> },
        { header: "Status", cell: (claim) => <StatusBadge status={claim.current_status} /> },
        { header: "Assignee", cell: (claim) => claim.assignee?.full_name ?? "Unassigned" },
        { header: "Estimated loss", cell: (claim) => currency(claim.estimated_loss) },
        { header: "Settlement", cell: (claim) => currency(claim.settlement_amount) }
      ]} />}
    </AppShell>
  );
}
