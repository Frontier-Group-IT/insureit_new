import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireCustomerManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { FleetSummaryClient } from "./fleet-summary-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CustomerRow = {
  id: string;
  contact_name: string;
  company_name: string | null;
  customer_code: string;
};

type VehicleRow = {
  id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  registration_date: string | null;
  vehicle_class_description: string | null;
  vehicle_category: string | null;
  body_type: string | null;
  fuel_type: string | null;
  gvw_kg: number | null;
  seating_capacity: number | null;
  registration_status: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  permit_type: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
  financed: boolean | null;
  financer_name: string | null;
};

type PolicyRow = {
  id: string;
  vehicle_id: string | null;
  policy_no: string;
  policy_type: string;
  business_type: string | null;
  start_date: string;
  end_date: string;
  premium_amount: number | null;
  insured_declared_value: number | null;
  status: string | null;
  insurance_companies: { name: string } | null;
};

export default async function CustomerFleetSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCustomerManager(id);

  const admin = createSupabaseAdminClient();
  const [{ data: customer, error: customerError }, { data: vehicles, error: vehicleError }] = await Promise.all([
    admin
      .from("customers")
      .select("id, contact_name, company_name, customer_code")
      .eq("id", id)
      .maybeSingle<CustomerRow>(),
    admin
      .from("vehicles")
      .select("id, vehicle_no, vehicle_type, make, model, year, registration_date, vehicle_class_description, vehicle_category, body_type, fuel_type, gvw_kg, seating_capacity, registration_status, fitness_expiry_date, puc_expiry_date, permit_type, national_permit_expiry_date, local_permit_expiry_date, financed, financer_name")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .returns<VehicleRow[]>(),
  ]);

  if (customerError || !customer) notFound();

  const safeVehicles = vehicleError ? [] : (vehicles ?? []);
  const vehicleIds = safeVehicles.map((vehicle) => vehicle.id);
  let policies: PolicyRow[] = [];

  if (vehicleIds.length) {
    const { data } = await admin
      .from("policies")
      .select("id, vehicle_id, policy_no, policy_type, business_type, start_date, end_date, premium_amount, insured_declared_value, status, insurance_companies(name)")
      .eq("customer_id", id)
      .in("vehicle_id", vehicleIds)
      .order("end_date", { ascending: false })
      .returns<PolicyRow[]>();
    policies = data ?? [];
  }

  return (
    <AppShell title="Fleet Summary">
      <FleetSummaryClient customer={customer} vehicles={safeVehicles} policies={policies} />
    </AppShell>
  );
}
