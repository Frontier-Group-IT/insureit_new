import Link from "next/link";
import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
};

export default async function PoliciesPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("policies")
    .select("id, policy_no, policy_type, start_date, end_date, customers(company_name, contact_name), vehicles(vehicle_no), insurance_companies(name)")
    .order("created_at", { ascending: false })
    .returns<PolicyRow[]>();

  return (
    <AppShell title="Policies">
      <PageHeader title="Policies" action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/policies/new">Add policy</Link>} />
      <SearchFilterBar searchPlaceholder="Search policies by number, insurer, vehicle, or customer" filterLabel="Policy status" />
      {error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No insurance policies added yet" emptyDescription="No insurance policies added yet. Add policy details to keep claim records complete and accurate." columns={[
        { header: "Policy", cell: (policy) => <><p className="font-semibold text-navy-900">{policy.policy_no}</p><p className="text-xs text-slate-500">{policy.policy_type}</p></> },
        { header: "Insurer", cell: (policy) => policy.insurance_companies?.name ?? "—" },
        { header: "Customer", cell: (policy) => policy.customers?.company_name ?? policy.customers?.contact_name ?? "—" },
        { header: "Vehicle", cell: (policy) => policy.vehicles?.vehicle_no ?? "—" },
        { header: "Validity", cell: (policy) => `${policy.start_date} to ${policy.end_date}` },
        { header: "", cell: (policy) => <Link className="font-semibold text-navy-700" href={`/policies/${policy.id}/edit`}>Edit</Link> }
      ]} />}
    </AppShell>
  );
}
