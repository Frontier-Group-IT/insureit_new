import { createVehicle } from "@/app/actions";
import { VehicleForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };

export default async function NewVehiclePage() {
  const supabase = await createServerSupabaseClient();
  const { data: customers } = await supabase.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>();
  const customerOptions = (customers ?? []).map((customer) => ({ value: customer.id, label: customer.company_name ?? customer.contact_name }));

  return <AppShell><PageHeader title="Add vehicle" description="Register a commercial vehicle and attach it to a customer account." /><VehicleForm action={createVehicle} customers={customerOptions} submitLabel="Add record" /></AppShell>;
}
