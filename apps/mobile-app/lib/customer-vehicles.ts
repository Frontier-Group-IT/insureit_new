import { supabase } from '@/lib/supabase';
import type { Vehicle } from '@/lib/types';

type VehicleLinkRow = {
  customer_id: string;
  created_at?: string | null;
  vehicle: Vehicle | Vehicle[] | null;
};

function linkedVehicle(row: VehicleLinkRow): Vehicle | null {
  const vehicle = Array.isArray(row.vehicle) ? row.vehicle[0] ?? null : row.vehicle;
  if (!vehicle) return null;
  return { ...vehicle, customer_id: row.customer_id };
}

export async function loadCustomerVehicleAssociations(customerIds: string[]) {
  if (!customerIds.length) return { data: [] as Vehicle[], error: null as { message?: string } | null };

  const result = await (supabase as any)
    .from('vehicle_customer_links')
    .select('customer_id,created_at,vehicle:vehicles(*)')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  if (result.error) return { data: [] as Vehicle[], error: result.error as { message?: string } };

  const vehicles = ((result.data ?? []) as VehicleLinkRow[])
    .map(linkedVehicle)
    .filter((vehicle): vehicle is Vehicle => Boolean(vehicle));

  return { data: vehicles, error: null as { message?: string } | null };
}

export async function loadCustomerLinkedVehicles(customerIds: string[]) {
  if (!customerIds.length) return { data: [] as Vehicle[], error: null as { message?: string } | null };

  const result = await (supabase as any)
    .from('vehicle_customer_links')
    .select('customer_id,created_at,vehicle:vehicles(*)')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  if (result.error) return { data: [] as Vehicle[], error: result.error as { message?: string } };

  const byVehicleId = new Map<string, Vehicle>();
  for (const row of (result.data ?? []) as VehicleLinkRow[]) {
    const vehicle = linkedVehicle(row);
    if (vehicle && !byVehicleId.has(vehicle.id)) byVehicleId.set(vehicle.id, vehicle);
  }

  return { data: Array.from(byVehicleId.values()), error: null as { message?: string } | null };
}

export async function isVehicleLinkedToCustomer(customerId: string, normalizedRegistration: string) {
  if (!customerId || !normalizedRegistration) return false;

  const result = await (supabase as any)
    .from('vehicle_customer_links')
    .select('vehicle:vehicles(vehicle_no)')
    .eq('customer_id', customerId)
    .limit(500);

  if (result.error) return false;

  return (result.data ?? []).some((row: { vehicle?: { vehicle_no?: string | null } | { vehicle_no?: string | null }[] | null }) => {
    const vehicle = Array.isArray(row.vehicle) ? row.vehicle[0] : row.vehicle;
    const vehicleNo = String(vehicle?.vehicle_no ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return vehicleNo === normalizedRegistration;
  });
}
