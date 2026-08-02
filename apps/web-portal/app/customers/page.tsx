import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomersPage() {
  const profile = await requireCapability("view_customers");
  if (!profile?.id) redirect("/access-denied");

  const accessibleIds = await getAccessibleCustomerIds(profile.id, profile.role);
  const admin = createSupabaseAdminClient();

  if (accessibleIds !== null && !accessibleIds.length) {
    return (
      <AppShell title="Customers">
        <DealershipEntryActivator />
        <div className="mx-auto max-w-[1480px]"><CustomerWorkspace rows={[]} /></div>
      </AppShell>
    );
  }

  let request = admin
    .from("customers")
    .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count)")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) request = request.in("id", accessibleIds);
  const customersResult = await request.returns<CustomerRow[]>();
  const rows: CustomerRow[] = customersResult.data ?? [];

  return (
    <AppShell title="Customers">
      <DealershipEntryActivator />
      <div className="mx-auto max-w-[1480px]">
        {customersResult.error ? (
          <DataError message="The customer register could not be loaded." />
        ) : (
          <CustomerWorkspace rows={rows} />
        )}
      </div>
    </AppShell>
  );
}
