import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession, type CustomerWebAccount } from "@/lib/customer-web";

export type CustomerVehicleRow = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassis_no: string | null;
  engine_no: string | null;
  registration_status: string | null;
  registration_date: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  road_tax_expiry_date: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
};

export type CustomerPolicyRow = {
  id: string;
  source: "sibl" | "external";
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  business_line: string | null;
  policy_product: string | null;
  start_date: string;
  end_date: string;
  premium_amount: number | null;
  insured_declared_value: number | null;
  status?: string | null;
  superseded_by_policy_id?: string | null;
  vehicle_no: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  insurer_name: string | null;
};

type InternalPolicyRecord = Omit<CustomerPolicyRow, "source" | "vehicle_no" | "vehicle_make" | "vehicle_model" | "insurer_name"> & {
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  insurance_companies: { name: string } | null;
};

type ExternalPolicyRecord = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_amount?: number | null;
  insured_declared_value?: number | null;
};

export type CustomerWebScope = {
  account: CustomerWebAccount;
  accounts: CustomerWebAccount[];
};

export async function resolveCustomerWebScope(accountId?: string | null): Promise<CustomerWebScope> {
  const session = await getCustomerWebSession();
  const requested = accountId?.trim();
  const account = requested
    ? session.accounts.find((item) => item.id === requested)
    : session.accounts.find((item) => item.id === session.primary_customer_id) ?? session.accounts[0];

  if (!account) notFound();
  return { account, accounts: session.accounts };
}

export const loadCustomerWebVehicles = cache(async (customerId: string): Promise<CustomerVehicleRow[]> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,customer_id,vehicle_no,vehicle_type,make,model,year,chassis_no,engine_no,registration_status,registration_date,fitness_expiry_date,puc_expiry_date,road_tax_expiry_date,national_permit_expiry_date,local_permit_expiry_date")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Customer vehicles are temporarily unavailable.");
  return (data ?? []) as CustomerVehicleRow[];
});

export const loadCustomerWebPolicies = cache(async (customerId: string): Promise<CustomerPolicyRow[]> => {
  const supabase = await createServerSupabaseClient();
  const [internalResult, externalResult, vehicleResult, companyResult] = await Promise.all([
    supabase
      .from("policies")
      .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,business_line,policy_product,start_date,end_date,premium_amount,insured_declared_value,status,superseded_by_policy_id,vehicles(vehicle_no,make,model),insurance_companies(name)")
      .eq("customer_id", customerId)
      .order("end_date", { ascending: true }),
    supabase
      .from("external_policies")
      .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,premium_amount,insured_declared_value")
      .eq("customer_id", customerId)
      .order("end_date", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id,vehicle_no,make,model")
      .eq("customer_id", customerId),
    supabase
      .from("insurance_companies")
      .select("id,name"),
  ]);

  if (internalResult.error) throw new Error("Customer policies are temporarily unavailable.");

  const vehicleById = new Map(
    (vehicleResult.data ?? []).map((row) => [row.id, row] as const),
  );
  const companyById = new Map(
    (companyResult.data ?? []).map((row) => [row.id, row.name] as const),
  );

  const internal = ((internalResult.data ?? []) as unknown as InternalPolicyRecord[]).map((row) => ({
    id: row.id,
    source: "sibl" as const,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    insurance_company_id: row.insurance_company_id,
    policy_no: row.policy_no,
    policy_type: row.policy_type,
    business_line: row.business_line,
    policy_product: row.policy_product,
    start_date: row.start_date,
    end_date: row.end_date,
    premium_amount: row.premium_amount,
    insured_declared_value: row.insured_declared_value,
    status: row.status ?? null,
    superseded_by_policy_id: row.superseded_by_policy_id ?? null,
    vehicle_no: row.vehicles?.vehicle_no ?? null,
    vehicle_make: row.vehicles?.make ?? null,
    vehicle_model: row.vehicles?.model ?? null,
    insurer_name: row.insurance_companies?.name ?? null,
  }));

  const external = externalResult.error
    ? []
    : ((externalResult.data ?? []) as unknown as ExternalPolicyRecord[]).map((row) => {
        const vehicle = row.vehicle_id ? vehicleById.get(row.vehicle_id) : null;
        return {
          id: row.id,
          source: "external" as const,
          customer_id: row.customer_id,
          vehicle_id: row.vehicle_id,
          insurance_company_id: row.insurance_company_id,
          policy_no: row.policy_no,
          policy_type: row.policy_type,
          business_line: null,
          policy_product: null,
          start_date: row.start_date,
          end_date: row.end_date,
          premium_amount: row.premium_amount ?? null,
          insured_declared_value: row.insured_declared_value ?? null,
          status: null,
          superseded_by_policy_id: null,
          vehicle_no: vehicle?.vehicle_no ?? null,
          vehicle_make: vehicle?.make ?? null,
          vehicle_model: vehicle?.model ?? null,
          insurer_name: row.insurance_company_id ? companyById.get(row.insurance_company_id) ?? null : null,
        };
      });

  return currentCustomerPolicies([...internal, ...external]);
});

function currentCustomerPolicies(policies: CustomerPolicyRow[]) {
  const candidates = policies.filter((policy) => {
    if (policy.superseded_by_policy_id) return false;
    return !["superseded", "cancelled", "canceled", "rejected", "void"].includes((policy.status ?? "").trim().toLowerCase());
  });

  const latestByVehicle = new Map<string, CustomerPolicyRow>();
  for (const policy of candidates) {
    const key = policy.vehicle_id ? `vehicle:${policy.vehicle_id}` : `policy:${policy.source}:${policy.id}`;
    const current = latestByVehicle.get(key);
    if (!current || compareCustomerPolicyRecency(policy, current) > 0) latestByVehicle.set(key, policy);
  }
  return Array.from(latestByVehicle.values()).sort(
    (left, right) => new Date(left.end_date).getTime() - new Date(right.end_date).getTime(),
  );
}

function compareCustomerPolicyRecency(left: CustomerPolicyRow, right: CustomerPolicyRow) {
  const startDifference = new Date(left.start_date).getTime() - new Date(right.start_date).getTime();
  if (startDifference !== 0) return startDifference;
  const endDifference = new Date(left.end_date).getTime() - new Date(right.end_date).getTime();
  if (endDifference !== 0) return endDifference;
  if (left.source !== right.source) return left.source === "sibl" ? 1 : -1;
  return left.id.localeCompare(right.id);
}

export async function loadCustomerVehicleDetail(customerId: string, vehicleId: string) {
  const vehicles = await loadCustomerWebVehicles(customerId);
  const vehicle = vehicles.find((row) => row.id === vehicleId);
  if (!vehicle) notFound();
  const policies = (await loadCustomerWebPolicies(customerId)).filter((policy) => policy.vehicle_id === vehicleId);
  return { vehicle, policies };
}

export async function loadCustomerPolicyDetail(customerId: string, policyId: string, source?: string | null) {
  const policies = await loadCustomerWebPolicies(customerId);
  const policy = policies.find((row) => row.id === policyId && (!source || row.source === source));
  if (!policy) notFound();
  return policy;
}

export function customerPolicyTone(endDate: string) {
  const today = new Date();
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.ceil((end.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  return { days, tone: days < 0 ? "expired" as const : days <= 30 ? "due" as const : "active" as const };
}

export function customerDisplayVehicleNo(vehicle: Pick<CustomerVehicleRow, "vehicle_no" | "chassis_no">) {
  const value = vehicle.vehicle_no?.trim();
  if (!value || /registration pending/i.test(value)) return vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "New vehicle";
  return value;
}

export function formatCustomerDate(value?: string | null) {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCustomerMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}