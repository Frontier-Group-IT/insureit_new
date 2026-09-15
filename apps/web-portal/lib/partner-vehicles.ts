import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";

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

export type PartnerVehiclePage = {
  rows: PartnerVehicleRow[];
  total: number;
};

export async function listPartnerWebVehicles({
  query = "",
  limit = 25,
  offset = 0,
}: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<PartnerVehiclePage> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_vehicles", {
    p_limit: Math.max(1, Math.min(limit, 100)),
    p_offset: Math.max(0, offset),
    p_search: query.trim() || null,
  });

  if (error) throw new Error(error.message || "Partner vehicles are unavailable.");
  const rows = (data ?? []) as PartnerVehicleRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}
