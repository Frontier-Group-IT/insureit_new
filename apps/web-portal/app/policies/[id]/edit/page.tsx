import { notFound } from "next/navigation";
import { updatePolicy } from "@/app/actions";
import { PolicyForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customers: { company_name: string | null; contact_name: string } | null };
type InsurerOption = { id: string; name: string };
type PolicyValues = {
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  insured_declared_value: number | null;
  start_date: string;
  end_date: string;
};

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [policyResult, customersResult, vehiclesResult, insurersResult] = await Promise.all([
    supabase
      .from("policies")
      .select("customer_id, vehicle_id, insurance_company_id, policy_no, policy_type, insured_declared_value, start_date, end_date")
      .eq("id", id)
      .maybeSingle<PolicyValues>(),
    supabase.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    supabase.from("vehicles").select("id, vehicle_no, customers(company_name, contact_name)").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    supabase.from("insurance_companies").select("id, name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  if (policyResult.error || !policyResult.data) {
    notFound();
  }

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.company_name ?? customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: `${vehicle.vehicle_no} — ${vehicle.customers?.company_name ?? vehicle.customers?.contact_name ?? "Unassigned customer"}` }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));

  return <AppShell title="Edit policy"><PageHeader title="Edit policy" /><PolicyForm action={updatePolicy.bind(null, id)} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} values={policyResult.data} submitLabel="Save changes" /></AppShell>;
}
