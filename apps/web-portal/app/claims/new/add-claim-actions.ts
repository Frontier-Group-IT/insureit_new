"use server";

import { revalidatePath } from "next/cache";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AddClaimLookup = {
  vehicle: {
    id: string;
    customerId: string;
    vehicleNo: string;
    make: string | null;
    model: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  policy: {
    id: string;
    policyNo: string;
    policyType: string | null;
    startDate: string;
    endDate: string;
    premiumAmount: number | null;
    insuredDeclaredValue: number | null;
  } | null;
  insurer: {
    id: string;
    name: string;
  } | null;
  policyCopy: {
    id: string;
    fileName: string;
    openUrl: string;
  } | null;
};

export type AddClaimLookupResult =
  | { ok: true; data: AddClaimLookup }
  | { ok: false; message: string };

export type CreateOperationsClaimResult =
  | { ok: true; claimId: string; claimNo: string }
  | { ok: false; message: string; existingClaim?: { id: string; claimNo: string } };

type VehicleRow = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  make: string | null;
  model: string | null;
};

type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
};

type PolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string | null;
  start_date: string;
  end_date: string;
  premium_amount: number | null;
  insured_declared_value: number | null;
};

type ExistingClaimRow = {
  id: string;
  claim_no: string;
  current_status: ClaimStatus;
  claim_service_mode: "broker_managed" | "self_managed" | null;
};

export async function lookupClaimVehicle(vehicleNumber: string): Promise<AddClaimLookupResult> {
  const profile = await requireCapability("manage_claims", "edit");
  const normalized = normalizeVehicleNumber(vehicleNumber);
  if (normalized.length < 4) return { ok: false, message: "Enter a valid vehicle number." };

  const admin = createSupabaseAdminClient();
  const vehicle = await findVehicle(admin, vehicleNumber, normalized);
  if (!vehicle) return { ok: false, message: "No vehicle record was found for this number." };

  const allowed = await canAccessCustomer(profile.id, profile.role, vehicle.customer_id, "manage_claims");
  if (!allowed) return { ok: false, message: "No vehicle record was found for this number." };

  const [{ data: customer, error: customerError }, policy] = await Promise.all([
    admin
      .from("customers")
      .select("id,company_name,contact_name,phone")
      .eq("id", vehicle.customer_id)
      .maybeSingle<CustomerRow>(),
    getActivePolicy(admin, vehicle.id, vehicle.customer_id),
  ]);

  if (customerError || !customer) {
    return { ok: false, message: "The linked customer record could not be loaded." };
  }

  const [insurer, policyCopy] = policy
    ? await Promise.all([
        admin
          .from("insurance_companies")
          .select("id,name")
          .eq("id", policy.insurance_company_id)
          .maybeSingle<{ id: string; name: string }>(),
        admin
          .from("policy_documents")
          .select("id,file_name")
          .eq("policy_id", policy.id)
          .eq("document_type", "policy_copy")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; file_name: string }>(),
      ])
    : [{ data: null }, { data: null }];

  return {
    ok: true,
    data: {
      vehicle: {
        id: vehicle.id,
        customerId: vehicle.customer_id,
        vehicleNo: vehicle.vehicle_no,
        make: vehicle.make,
        model: vehicle.model,
      },
      customer: {
        id: customer.id,
        name: customer.company_name || customer.contact_name || "",
        phone: customer.phone,
      },
      policy: policy
        ? {
            id: policy.id,
            policyNo: policy.policy_no,
            policyType: policy.policy_type,
            startDate: policy.start_date,
            endDate: policy.end_date,
            premiumAmount: policy.premium_amount,
            insuredDeclaredValue: policy.insured_declared_value,
          }
        : null,
      insurer: insurer.data ? { id: insurer.data.id, name: insurer.data.name } : null,
      policyCopy: policyCopy.data
        ? {
            id: policyCopy.data.id,
            fileName: policyCopy.data.file_name,
            openUrl: `/policies/documents/${policyCopy.data.id}/open`,
          }
        : null,
    },
  };
}

export async function createOperationsClaim(vehicleId: string, lossAtIso: string): Promise<CreateOperationsClaimResult> {
  const profile = await requireCapability("manage_claims", "edit");
  if (!vehicleId) return { ok: false, message: "Select a valid vehicle before saving the claim." };

  const lossAt = new Date(lossAtIso);
  if (!lossAtIso || Number.isNaN(lossAt.getTime())) {
    return { ok: false, message: "Enter a valid loss date and time before saving the claim." };
  }

  const admin = createSupabaseAdminClient();
  const { data: vehicle, error: vehicleError } = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,make,model")
    .eq("id", vehicleId)
    .maybeSingle<VehicleRow>();

  if (vehicleError || !vehicle) return { ok: false, message: "The selected vehicle could not be found." };

  const allowed = await canAccessCustomer(profile.id, profile.role, vehicle.customer_id, "manage_claims");
  if (!allowed) return { ok: false, message: "The selected vehicle could not be found." };

  const policy = await getActivePolicy(admin, vehicle.id, vehicle.customer_id);

  let existingRequest = admin
    .from("claims")
    .select("id,claim_no,current_status,claim_service_mode")
    .eq("vehicle_id", vehicle.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (policy) existingRequest = existingRequest.eq("policy_id", policy.id);

  const { data: existingRows, error: existingError } = await existingRequest.returns<ExistingClaimRow[]>();
  if (existingError) return { ok: false, message: "Existing claims could not be checked. Please try again." };

  const existingClaim = (existingRows ?? []).find(
    (claim) => claim.claim_service_mode !== "self_managed" && !terminalClaimStatuses.includes(claim.current_status),
  );
  if (existingClaim) {
    return {
      ok: false,
      message: "An active managed claim already exists for this vehicle and policy.",
      existingClaim: { id: existingClaim.id, claimNo: existingClaim.claim_no },
    };
  }

  let created: { id: string; claim_no: string } | null = null;
  let finalError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
    const claimNo = makeClaimNumber(Date.now() + attempt);
    const result = await admin
      .from("claims")
      .insert({
        claim_no: claimNo,
        customer_id: vehicle.customer_id,
        vehicle_id: vehicle.id,
        policy_id: policy?.id ?? null,
        insurance_company_id: policy?.insurance_company_id ?? null,
        accident_at: lossAt.toISOString(),
        current_status: "Initial Documents Pending",
        created_by: profile.id,
        claim_service_mode: "broker_managed",
        policy_service_source: policy ? "sibl" : null,
      })
      .select("id,claim_no")
      .single<{ id: string; claim_no: string }>();

    if (result.data && !result.error) {
      created = result.data;
      finalError = null;
      break;
    }

    finalError = result.error;
    if (result.error?.code !== "23505") break;
  }

  if (!created) {
    return { ok: false, message: finalError?.message || "The claim could not be created. Please try again." };
  }

  await admin.from("claim_status_history").insert({
    claim_id: created.id,
    from_status: null,
    to_status: "Initial Documents Pending",
    notes: "Claim created by Operations from All Claims.",
    changed_by: profile.id,
  });

  revalidatePath("/claims");
  revalidatePath(`/claims/${created.id}`);
  revalidatePath("/dashboard");

  return { ok: true, claimId: created.id, claimNo: created.claim_no };
}

function normalizeVehicleNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function makeClaimNumber(timestamp: number) {
  const date = new Date(timestamp);
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `CLM-${stamp}-${timestamp.toString().slice(-6)}`;
}

async function findVehicle(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  enteredValue: string,
  normalizedValue: string,
) {
  const direct = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,make,model")
    .ilike("vehicle_no", enteredValue.trim())
    .limit(5)
    .returns<VehicleRow[]>();

  const directMatch = (direct.data ?? []).find((vehicle) => normalizeVehicleNumber(vehicle.vehicle_no) === normalizedValue);
  if (directMatch) return directMatch;

  const suffix = normalizedValue.slice(-4);
  const fallback = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,make,model")
    .ilike("vehicle_no", `%${suffix}%`)
    .limit(50)
    .returns<VehicleRow[]>();

  return (fallback.data ?? []).find((vehicle) => normalizeVehicleNumber(vehicle.vehicle_no) === normalizedValue) ?? null;
}

async function getActivePolicy(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  vehicleId: string,
  customerId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("policies")
    .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,premium_amount,insured_declared_value")
    .eq("vehicle_id", vehicleId)
    .eq("customer_id", customerId)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle<PolicyRow>();
  return data ?? null;
}
