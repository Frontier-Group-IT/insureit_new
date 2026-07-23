import { AppShell, Card, PageHeader } from "@/components/shell";
import { MetricCard } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();
  const [claims, customers, policies, vehicles] = await Promise.all([
    supabase.from("claims").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("policies").select("id", { count: "exact", head: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true })
  ]);

  return (
    <AppShell title="Reports">
      <PageHeader title="Portfolio overview" />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Claims" value={`${claims.count ?? 0}`} hint="Claim cases recorded" tone="navy" icon="C" />
        <MetricCard label="Customers" value={`${customers.count ?? 0}`} hint="Customer profiles recorded" tone="green" icon="U" />
        <MetricCard label="Policies" value={`${policies.count ?? 0}`} hint="Policy records maintained" tone="amber" icon="P" />
        <MetricCard label="Vehicles" value={`${vehicles.count ?? 0}`} hint="Vehicle records maintained" tone="red" icon="V" />
      </div>
      <Card className="mt-6">
        <h3 className="text-lg font-semibold text-navy-900">Governed report catalogue</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Operational exports will be introduced after their definitions, date ranges, and access permissions are approved. The totals above are live portfolio counts, not placeholder analytics.
        </p>
      </Card>
    </AppShell>
  );
}
