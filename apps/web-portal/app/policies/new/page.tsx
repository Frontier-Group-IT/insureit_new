import { createPolicy } from "@/app/actions";
import { PolicyForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customers: { company_name: string | null; contact_name: string } | null };
type InsurerOption = { id: string; name: string };

export default async function NewPolicyPage() {
  const supabase = await createServerSupabaseClient();
  const [customersResult, vehiclesResult, insurersResult] = await Promise.all([
    supabase.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    supabase.from("vehicles").select("id, vehicle_no, customers(company_name, contact_name)").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    supabase.from("insurance_companies").select("id, name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.company_name ?? customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: `${vehicle.vehicle_no} — ${vehicle.customers?.company_name ?? vehicle.customers?.contact_name ?? "Unassigned customer"}` }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));

  return <AppShell><PageHeader title="Add policy" description="Attach an insurance policy to a customer and commercial vehicle." /><PolicyForm action={createPolicy} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} submitLabel="Add record" /></AppShell>;
}
