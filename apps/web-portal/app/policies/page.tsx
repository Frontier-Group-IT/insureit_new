import { AppShell } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { PolicyWorkspace } from "./policy-workspace";

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
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">{error.message}</div> : <PolicyWorkspace rows={data ?? []} />}
    </AppShell>
  );
}
