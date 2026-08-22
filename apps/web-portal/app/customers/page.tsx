import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { BackofficeCustomerRegister } from "@/components/backoffice-customer-register";
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
  policies: { count: number }[];
  claims: { count: number }[];
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
        {profile.role === "backoffice_executive" ? <div className="mx-auto max-w-[1480px]"><BackofficeCustomerRegister rows={[]} /></div> : <><DealershipEntryActivator /><div className="mx-auto max-w-[1480px]"><CustomerWorkspace rows={[]} /></div></>}
      </AppShell>
    );
  }

  let request = admin
    .from("customers")
    .select("id, customer_code, partner_type, company_name, contact_name, phone, city, fleet_size_band, onboarding_status, vehicles(count), policies(count), claims(count)")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) request = request.in("id", accessibleIds);
  const customersResult = await request.returns<CustomerRow[]>();
  const rows: CustomerRow[] = customersResult.data ?? [];

  return (
    <AppShell title="Customers">
      {profile.role !== "backoffice_executive" ? <DealershipEntryActivator /> : null}
      <div className="mx-auto max-w-[1480px]">
        {profile.role === "it_super_user" && !customersResult.error ? (
          <ItSuperUserDeletePanel
            entity="customer"
            title="Delete customer master record"
            records={rows.map((customer) => ({
              id: customer.id,
              label: customer.contact_name,
              detail: `${customer.customer_code} • ${customer.phone}`
            }))}
          />
        ) : null}
        {customersResult.error ? (
          <DataError message="The customer register could not be loaded." />
        ) : profile.role === "backoffice_executive" ? (
          <BackofficeCustomerRegister rows={rows} />
        ) : (
          <CustomerWorkspace rows={rows} />
        )}
      </div>
    </AppShell>
  );
}
