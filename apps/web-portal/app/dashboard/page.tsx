import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { MetricCard, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type ClaimRow = {
  id: string;
  claim_no: string;
  current_status: string;
  estimated_loss: number | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const [claimsResult, customersResult, tasksResult, documentsResult] = await Promise.all([
    supabase.from("claims").select("id, claim_no, current_status, estimated_loss, customers(company_name, contact_name), vehicles(vehicle_no)", { count: "exact" }).order("created_at", { ascending: false }).limit(5).returns<ClaimRow[]>(),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("claim_tasks").select("id", { count: "exact", head: true }).neq("status", "completed"),
    supabase.from("claim_documents").select("id", { count: "exact", head: true }).eq("verification_status", "pending")
  ]);

  return (
    <AppShell>
      <PageHeader title="InsureIt Admin Portal" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open claims" value={`${claimsResult.count ?? 0}`} hint="Active claim cases in progress" tone="navy" icon="◆" />
        <MetricCard label="Customers" value={`${customersResult.count ?? 0}`} hint="Customer profiles on record" tone="green" icon="◉" />
        <MetricCard label="Pending documents" value={`${documentsResult.count ?? 0}`} hint="Documents ready for review" tone="amber" icon="◧" />
        <MetricCard label="Open tasks" value={`${tasksResult.count ?? 0}`} hint="Tasks requiring attention" tone="red" icon="!" />
      </div>
      <div className="mt-6">
        {claimsResult.error ? <DataError message={claimsResult.error.message} /> : <DataTable rows={claimsResult.data ?? []} emptyTitle="No claim cases found" columns={[
          { header: "Claim", cell: (claim) => <Link href={`/claims/${claim.id}`} className="font-semibold text-navy-700">{claim.claim_no}</Link> },
          { header: "Customer", cell: (claim) => claim.customers?.company_name ?? claim.customers?.contact_name ?? "—" },
          { header: "Vehicle", cell: (claim) => claim.vehicles?.vehicle_no ?? "—" },
          { header: "Status", cell: (claim) => <StatusBadge status={claim.current_status} /> },
          { header: "Estimated loss", cell: (claim) => claim.estimated_loss == null ? "—" : `₹${claim.estimated_loss}` }
        ]} />}
      </div>
    </AppShell>
  );
}
