import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { CustomerWorkspace } from "./customer-workspace";

type CustomerRow = {
  id: string;
  customer_code: string;
  partner_type: string | null;
  company_name: string | null;
  contact_name: string;
  phone: string;
  city: string | null;
  fleet_size_band: string | null;
  onboarding_status: string;
  vehicles: { count: number }[];
};

export default async function CustomersPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count)")
    .order("created_at", { ascending: false })
    .returns<CustomerRow[]>();

  const rows = data ?? [];

  return (
    <AppShell title="Customers">
      <div className="pb-3">
        {error ? <DataError message={error.message} /> : <CustomerWorkspace rows={rows} />}
      </div>
    </AppShell>
  );
}
