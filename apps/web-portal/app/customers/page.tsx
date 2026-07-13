import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CustomerWorkspace } from "./customer-workspace";
import { DealershipEntryActivator } from "./dealership-entry-activator";

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

type DealershipProfileRow = {
  customer_id: string;
  dealership_type: "posp" | "misp";
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomersPage() {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();

  const [customersResult, dealershipProfilesResult] = await Promise.all([
    admin
      .from("customers")
      .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count)")
      .order("created_at", { ascending: false })
      .returns<CustomerRow[]>(),
    admin
      .from("dealership_profiles")
      .select("customer_id, dealership_type")
      .returns<DealershipProfileRow[]>()
  ]);

  const rows = customersResult.data ?? [];
  const dealershipTypes = Object.fromEntries(
    (dealershipProfilesResult.data ?? []).map((profile) => [profile.customer_id, profile.dealership_type])
  ) as Record<string, "posp" | "misp">;

  const error = customersResult.error ?? dealershipProfilesResult.error;

  return (
    <AppShell title="Customers">
      <DealershipEntryActivator dealershipTypes={dealershipTypes} />
      <div className="pb-3">
        {error ? <DataError message={error.message} /> : <CustomerWorkspace rows={rows} />}
      </div>
    </AppShell>
  );
}
