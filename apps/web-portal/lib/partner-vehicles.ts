import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";
import type { VehicleStatusFilter, VehicleTypeFilter } from "@/app/partner/vehicles/vehicle-filter-types";

export type PartnerVehicleRow = {
  vehicle_id: string;
  customer_id: string;
  vehicle_no: string;
  vehicle_type: string | null;
  make: string | null;
  model: string | null;
  registration_status: string | null;
  customer_name: string;
  policy_count: number;
  total_count: number;
};

export type PartnerVehicleFilterCounts = {
  all: number;
  registered: number;
  rcPending: number;
  uninsured: number;
};

export type PartnerVehiclePage = {
  rows: PartnerVehicleRow[];
  total: number;
  counts: PartnerVehicleFilterCounts;
};

export async function listPartnerWebVehicles({
  query = "",
  status = "all",
  vehicleType = "all",
  limit = 25,
  offset = 0,
}: {
  query?: string;
  status?: VehicleStatusFilter;
  vehicleType?: VehicleTypeFilter;
  limit?: number;
  offset?: number;
} = {}): Promise<PartnerVehiclePage> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const search = query.trim() || null;

  const [listResult, countsResult] = await Promise.all([
    supabase.rpc("partner_app_list_vehicles_filtered", {
      p_limit: Math.max(1, Math.min(limit, 100)),
      p_offset: Math.max(0, offset),
      p_search: search,
      p_status: status,
      p_vehicle_type: vehicleType,
    }),
    supabase.rpc("partner_app_vehicle_filter_counts", {
      p_search: search,
      p_vehicle_type: vehicleType,
    }),
  ]);

  if (listResult.error) throw new Error(listResult.error.message || "Partner vehicles are unavailable.");
  if (countsResult.error) throw new Error(countsResult.error.message || "Partner vehicle counts are unavailable.");

  const rows = (listResult.data ?? []) as PartnerVehicleRow[];
  const countRow = (countsResult.data?.[0] ?? {}) as Record<string, number | string | null | undefined>;

  return {
    rows,
    total: Number(rows[0]?.total_count ?? 0),
    counts: {
      all: Number(countRow.all_count ?? 0),
      registered: Number(countRow.registered_count ?? 0),
      rcPending: Number(countRow.rc_pending_count ?? 0),
      uninsured: Number(countRow.uninsured_count ?? 0),
    },
  };
}

export type PartnerVehicleDetail = {
  vehicle: {
    vehicle_id: string;
    customer_id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    registration_status: string | null;
    registration_date: string | null;
    chassis_no: string | null;
    engine_no: string | null;
    fuel_type: string | null;
    gvw_kg: number | string | null;
    fitness_expiry_date: string | null;
    puc_expiry_date: string | null;
    road_tax_expiry_date: string | null;
    national_permit_expiry_date: string | null;
    local_permit_expiry_date: string | null;
  };
  customer: {
    customer_id: string;
    customer_name: string;
  };
  activity: {
    policies: number;
    claims: number;
  };
};

export async function getPartnerWebVehicleDetail(vehicleId: string): Promise<PartnerVehicleDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_vehicle_detail", {
    p_vehicle_id: vehicleId,
  });

  if (error || !data) throw new Error(error?.message || "Vehicle detail is unavailable.");
  return data as PartnerVehicleDetail;
}
