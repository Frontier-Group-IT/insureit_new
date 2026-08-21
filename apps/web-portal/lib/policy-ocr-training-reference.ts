import "server-only";

import type { TrainingDatabaseReference } from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PolicyReferenceRow = {
  policy_no: string | null;
  policy_type: string | null;
  start_date: string | null;
  end_date: string | null;
  insured_declared_value: number | null;
  vehicle_id: string | null;
  insurance_companies: { name: string } | null;
};

type SnapshotReferenceRow = {
  registration_number: string | null;
  vehicle_class: string | null;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
  manufacturing_year: number | null;
  capacity_value: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  rto_name: string | null;
  rto_state: string | null;
};

type VehicleReferenceRow = {
  vehicle_no: string | null;
  registration_status: string | null;
  vehicle_type: string | null;
  vehicle_class_code: string | null;
  vehicle_class_description: string | null;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
  year: number | null;
  engine_capacity_cc: number | null;
  seating_capacity: number | null;
  gvw_kg: number | null;
  chassis_no: string | null;
  engine_no: string | null;
  rto_name: string | null;
  rto_state: string | null;
};

type PremiumReferenceRow = {
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_amount: number | null;
  net_premium: number | null;
  gst_amount: number | null;
  gross_premium: number | null;
};

export async function loadPolicyOcrTrainingReference(policyId: string): Promise<TrainingDatabaseReference | null> {
  const admin = createSupabaseAdminClient();
  const { data: policy, error: policyError } = await admin
    .from("policies")
    .select("policy_no,policy_type,start_date,end_date,insured_declared_value,vehicle_id,insurance_companies(name)")
    .eq("id", policyId)
    .maybeSingle<PolicyReferenceRow>();
  if (policyError) throw new Error("training_policy_reference_lookup_failed");
  if (!policy) return null;

  const [snapshotResult, vehicleResult, premiumResult] = await Promise.all([
    admin
      .from("policy_party_snapshots")
      .select("registration_number,vehicle_class,make,model,fuel_type,manufacturing_year,capacity_value,chassis_no,engine_no,rto_name,rto_state")
      .eq("policy_id", policyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SnapshotReferenceRow>(),
    policy.vehicle_id
      ? admin
        .from("vehicles")
        .select("vehicle_no,registration_status,vehicle_type,vehicle_class_code,vehicle_class_description,make,model,fuel_type,year,engine_capacity_cc,seating_capacity,gvw_kg,chassis_no,engine_no,rto_name,rto_state")
        .eq("id", policy.vehicle_id)
        .maybeSingle<VehicleReferenceRow>()
      : Promise.resolve({ data: null as VehicleReferenceRow | null, error: null }),
    admin
      .from("policy_premium_details")
      .select("od_premium,tp_premium,cpa_opted,cpa_amount,net_premium,gst_amount,gross_premium")
      .eq("policy_id", policyId)
      .maybeSingle<PremiumReferenceRow>(),
  ]);
  if (snapshotResult.error || vehicleResult.error || premiumResult.error) throw new Error("training_reference_lookup_failed");

  const snapshot = snapshotResult.data;
  const vehicle = vehicleResult.data;
  const registrationPending = isRegistrationPending(snapshot?.registration_number, vehicle?.registration_status, vehicle?.vehicle_no);
  const vehicleClass = vehicle?.vehicle_class_code || snapshot?.vehicle_class || vehicle?.vehicle_class_description || vehicle?.vehicle_type || null;

  return {
    vehicle_registration_status: registrationPending ? "registration_pending" : "registered",
    vehicle_registration_number: registrationPending ? null : usableRegistration(snapshot?.registration_number) || usableRegistration(vehicle?.vehicle_no),
    vehicle_class: vehicleClass,
    vehicle_make: snapshot?.make || vehicle?.make || null,
    vehicle_model: snapshot?.model || vehicle?.model || null,
    vehicle_fuel_type: snapshot?.fuel_type || vehicle?.fuel_type || null,
    vehicle_manufacturing_year: snapshot?.manufacturing_year ?? vehicle?.year ?? null,
    vehicle_capacity: snapshot?.capacity_value || capacityForClass(vehicle, vehicleClass),
    vehicle_chassis_number: snapshot?.chassis_no || vehicle?.chassis_no || null,
    vehicle_engine_number: snapshot?.engine_no || vehicle?.engine_no || null,
    vehicle_rto_name: snapshot?.rto_name || vehicle?.rto_name || null,
    vehicle_rto_state: snapshot?.rto_state || vehicle?.rto_state || null,
    insurer_name: policy.insurance_companies?.name ?? null,
    policy_product: policy.policy_type,
    policy_number: policy.policy_no,
    valid_from: policy.start_date,
    valid_upto: policy.end_date,
    idv: policy.insured_declared_value,
    od_premium: premiumResult.data?.od_premium ?? null,
    tp_premium: premiumResult.data?.tp_premium ?? null,
    cpa_opted: premiumResult.data?.cpa_opted ?? null,
    cpa_premium: premiumResult.data?.cpa_amount ?? null,
    printed_net_premium: premiumResult.data?.net_premium ?? null,
    printed_gst: premiumResult.data?.gst_amount ?? null,
    printed_gross_premium: premiumResult.data?.gross_premium ?? null,
  };
}

function isRegistrationPending(snapshotRegistration?: string | null, status?: string | null, vehicleNo?: string | null) {
  return /pending|unregistered/i.test(snapshotRegistration ?? "")
    || /pending|unregistered/i.test(status ?? "")
    || /^(?:NEW|PENDING)-/i.test(vehicleNo ?? "");
}

function usableRegistration(value?: string | null) {
  const clean = value?.trim() ?? "";
  return clean && !/pending|unregistered/i.test(clean) && !/^(?:NEW|PENDING)-/i.test(clean) ? clean : null;
}

function capacityForClass(vehicle: VehicleReferenceRow | null, vehicleClass: string | null) {
  if (!vehicle) return null;
  const normalizedClass = (vehicleClass ?? "").toUpperCase();
  if (["PCP", "TWP"].includes(normalizedClass)) return vehicle.engine_capacity_cc;
  if (normalizedClass === "PCV") return vehicle.seating_capacity;
  if (["GCV", "CPM"].includes(normalizedClass)) return vehicle.gvw_kg;
  return vehicle.engine_capacity_cc ?? vehicle.gvw_kg ?? vehicle.seating_capacity;
}
