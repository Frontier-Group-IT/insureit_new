import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PolicyOnboardingPayload } from "./policy-onboarding-actions";

export type PolicyBusinessConflict =
  | {
      type: "manufacturer_unknown";
      enteredMake: string;
    }
  | {
      type: "vehicle_identity_conflict";
      message: string;
      enteredRegistration: string;
      enteredChassis: string;
      enteredEngine: string;
      existingVehicleId: string;
      existingVehicleNo: string;
      existingMake: string | null;
      existingModel: string | null;
      existingPath: string;
    }
  | {
      type: "policy_duplicate";
      existingPolicyId: string;
      existingPolicyNo: string;
      existingPolicyType: string;
      validFrom: string;
      validUpto: string;
      source: "managed" | "external";
      existingPath: string;
    }
  | {
      type: "coverage_overlap";
      existingPolicyId: string;
      existingPolicyNo: string;
      existingPolicyType: string;
      validFrom: string;
      validUpto: string;
      source: "managed" | "external";
      existingPath: string;
      suggestedStartDate: string;
    }
  | {
      type: "coverage_gap";
      existingPolicyId: string;
      existingPolicyNo: string;
      existingPolicyType: string;
      validFrom: string;
      validUpto: string;
      source: "managed" | "external";
      existingPath: string;
      suggestedStartDate: string;
      gapDays: number;
    };

type VehicleIdentityRow = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  vehicle_no_normalized: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  make: string | null;
  model: string | null;
};

type ManagedPolicyRow = {
  id: string;
  policy_no: string;
  policy_no_normalized: string | null;
  policy_type: string;
  start_date: string;
  end_date: string;
  status: string;
  vehicle_id: string;
  insurance_company_id: string;
};

type ExternalPolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  vehicle_id: string;
  insurance_company_id: string;
};

function normalizeIdentity(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function coverageComponents(policyType: unknown) {
  const text = String(policyType ?? "").trim().toLowerCase();
  if (!text) return new Set(["OD", "TP"]);
  if (text === "saod" || text.includes("standalone own") || text.includes("own damage")) return new Set(["OD"]);
  if (
    text === "third party" ||
    text === "long term third party" ||
    text.includes("third-party") ||
    text.includes("third party") ||
    text.includes("liability only")
  ) {
    return new Set(["TP"]);
  }
  return new Set(["OD", "TP"]);
}

function coverageIntersects(left: Set<string>, right: Set<string>) {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dayDifference(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

async function findVehicleBy(column: "vehicle_no_normalized" | "chassis_no" | "engine_no", value: string) {
  if (!value) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,vehicle_no_normalized,chassis_no,engine_no,make,model")
    .eq(column, value)
    .limit(1)
    .maybeSingle<VehicleIdentityRow>();
  if (error) throw new Error(error.message);
  return data;
}

async function manufacturerIsKnown(make: string) {
  if (!make.trim()) return true;
  const normalized = normalizeIdentity(make);
  const admin = createSupabaseAdminClient();
  const [manufacturers, brands, aliases] = await Promise.all([
    admin.from("vehicle_manufacturers").select("name,display_name").eq("is_active", true),
    admin.from("vehicle_manufacturer_brands").select("brand_name").eq("is_active", true),
    admin.from("vehicle_manufacturer_aliases").select("alias").eq("is_active", true),
  ]);
  for (const result of [manufacturers, brands, aliases]) if (result.error) throw new Error(result.error.message);

  const values: string[] = [];
  for (const row of manufacturers.data ?? []) values.push(String(row.name ?? ""), String(row.display_name ?? ""));
  for (const row of brands.data ?? []) values.push(String(row.brand_name ?? ""));
  for (const row of aliases.data ?? []) values.push(String(row.alias ?? ""));
  return values.some((value) => normalizeIdentity(value) === normalized);
}

function managedPath(id: string) {
  return `/policies/${id}`;
}

function externalPath(id: string) {
  return `/policies/external/${id}`;
}

function vehicleConflict(existing: VehicleIdentityRow, input: { registration: string; chassis: string; engine: string }, message: string): PolicyBusinessConflict {
  return {
    type: "vehicle_identity_conflict",
    message,
    enteredRegistration: input.registration,
    enteredChassis: input.chassis,
    enteredEngine: input.engine,
    existingVehicleId: existing.id,
    existingVehicleNo: existing.vehicle_no,
    existingMake: existing.make,
    existingModel: existing.model,
    existingPath: `/vehicles/${existing.id}`,
  };
}

export async function findPolicyOnboardingBusinessConflict(input: {
  payload: PolicyOnboardingPayload;
  acceptCoverageGap?: boolean;
}): Promise<PolicyBusinessConflict | null> {
  const { payload } = input;
  const admin = createSupabaseAdminClient();
  const registration = normalizeIdentity(payload.vehicle.registrationNumber);
  const chassis = normalizeIdentity(payload.vehicle.chassisNumber);
  const engine = normalizeIdentity(payload.vehicle.engineNumber);
  const make = String(payload.vehicle.make ?? "").trim();
  const mode = payload.vehicle.registrationMode === "unregistered" ? "unregistered" : "registered";
  const enteredIdentity = { registration, chassis, engine };

  if (make && !(await manufacturerIsKnown(make))) return { type: "manufacturer_unknown", enteredMake: make };

  const [registrationVehicle, chassisVehicle, engineVehicle] = await Promise.all([
    mode === "registered" ? findVehicleBy("vehicle_no_normalized", registration) : Promise.resolve(null),
    chassis ? findVehicleBy("chassis_no", chassis) : Promise.resolve(null),
    engine ? findVehicleBy("engine_no", engine) : Promise.resolve(null),
  ]);

  const identityRows = [registrationVehicle, chassisVehicle, engineVehicle].filter((row): row is VehicleIdentityRow => Boolean(row));
  const distinctVehicleIds = new Set(identityRows.map((row) => row.id));
  if (distinctVehicleIds.size > 1) {
    return vehicleConflict(
      identityRows[0],
      enteredIdentity,
      "The registration, chassis or engine details point to different vehicle records. Review the vehicle identity before booking this policy.",
    );
  }

  if (mode === "registered" && !registrationVehicle && (chassisVehicle || engineVehicle)) {
    return vehicleConflict(
      chassisVehicle ?? engineVehicle!,
      enteredIdentity,
      "The entered chassis or engine number already belongs to a different registered vehicle. Review the vehicle identity before booking this policy.",
    );
  }

  if (mode === "unregistered" && !chassisVehicle && engineVehicle) {
    return vehicleConflict(
      engineVehicle,
      enteredIdentity,
      "This engine number is already linked to an existing vehicle, but the entered chassis number does not match it. Review the vehicle details before continuing.",
    );
  }

  const identifiedVehicle = mode === "registered" ? registrationVehicle : (chassisVehicle ?? engineVehicle);

  const policyNumber = String(payload.policy.policyNumber ?? "").trim().toUpperCase();
  const policyNumberNormalized = normalizeIdentity(policyNumber);
  const newStart = String(payload.policy.validFrom ?? "");
  const newEnd = String(payload.policy.validUpto ?? "");
  const newCoverage = coverageComponents(payload.policy.policyType);

  const { data: duplicateManaged, error: duplicateManagedError } = await admin
    .from("policies")
    .select("id,policy_no,policy_no_normalized,policy_type,start_date,end_date,status,vehicle_id,insurance_company_id")
    .eq("policy_no_normalized", policyNumberNormalized)
    .limit(1)
    .maybeSingle<ManagedPolicyRow>();
  if (duplicateManagedError) throw new Error(duplicateManagedError.message);
  if (duplicateManaged) {
    return {
      type: "policy_duplicate",
      existingPolicyId: duplicateManaged.id,
      existingPolicyNo: duplicateManaged.policy_no,
      existingPolicyType: duplicateManaged.policy_type,
      validFrom: duplicateManaged.start_date,
      validUpto: duplicateManaged.end_date,
      source: "managed",
      existingPath: managedPath(duplicateManaged.id),
    };
  }

  const { data: duplicateExternal, error: duplicateExternalError } = await admin
    .from("external_policies")
    .select("id,policy_no,policy_type,start_date,end_date,vehicle_id,insurance_company_id")
    .ilike("policy_no", policyNumber)
    .limit(1)
    .maybeSingle<ExternalPolicyRow>();
  if (duplicateExternalError) throw new Error(duplicateExternalError.message);
  if (duplicateExternal) {
    return {
      type: "policy_duplicate",
      existingPolicyId: duplicateExternal.id,
      existingPolicyNo: duplicateExternal.policy_no,
      existingPolicyType: duplicateExternal.policy_type,
      validFrom: duplicateExternal.start_date,
      validUpto: duplicateExternal.end_date,
      source: "external",
      existingPath: externalPath(duplicateExternal.id),
    };
  }

  if (!identifiedVehicle || !newStart || !newEnd) return null;

  const [managedResult, externalResult] = await Promise.all([
    admin
      .from("policies")
      .select("id,policy_no,policy_no_normalized,policy_type,start_date,end_date,status,vehicle_id,insurance_company_id")
      .eq("vehicle_id", identifiedVehicle.id)
      .order("end_date", { ascending: false })
      .returns<ManagedPolicyRow[]>(),
    admin
      .from("external_policies")
      .select("id,policy_no,policy_type,start_date,end_date,vehicle_id,insurance_company_id")
      .eq("vehicle_id", identifiedVehicle.id)
      .order("end_date", { ascending: false })
      .returns<ExternalPolicyRow[]>(),
  ]);
  if (managedResult.error) throw new Error(managedResult.error.message);
  if (externalResult.error) throw new Error(externalResult.error.message);

  const existing = [
    ...(managedResult.data ?? [])
      .filter((row) => !["cancelled", "canceled", "rejected", "superseded", "void"].includes(String(row.status ?? "").toLowerCase()))
      .map((row) => ({ ...row, source: "managed" as const, path: managedPath(row.id) })),
    ...(externalResult.data ?? []).map((row) => ({ ...row, source: "external" as const, path: externalPath(row.id) })),
  ];

  const overlapping = existing.find((row) => {
    if (!coverageIntersects(newCoverage, coverageComponents(row.policy_type))) return false;
    return newStart <= row.end_date && newEnd >= row.start_date;
  });
  if (overlapping) {
    return {
      type: "coverage_overlap",
      existingPolicyId: overlapping.id,
      existingPolicyNo: overlapping.policy_no,
      existingPolicyType: overlapping.policy_type,
      validFrom: overlapping.start_date,
      validUpto: overlapping.end_date,
      source: overlapping.source,
      existingPath: overlapping.path,
      suggestedStartDate: nextDate(overlapping.end_date),
    };
  }

  if (!input.acceptCoverageGap) {
    const previous = existing
      .filter((row) => coverageIntersects(newCoverage, coverageComponents(row.policy_type)) && row.end_date < newStart)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    if (previous) {
      const suggestedStartDate = nextDate(previous.end_date);
      const gapDays = dayDifference(suggestedStartDate, newStart);
      if (gapDays > 0) {
        return {
          type: "coverage_gap",
          existingPolicyId: previous.id,
          existingPolicyNo: previous.policy_no,
          existingPolicyType: previous.policy_type,
          validFrom: previous.start_date,
          validUpto: previous.end_date,
          source: previous.source,
          existingPath: previous.path,
          suggestedStartDate,
          gapDays,
        };
      }
    }
  }

  return null;
}
