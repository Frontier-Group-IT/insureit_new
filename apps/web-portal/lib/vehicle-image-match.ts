// Pure, fail-closed image matching. Original vehicle descriptions are never rewritten.
export type VehicleImageIdentity = { manufacturerId: string; model: string; variant?: string | null; year?: number | null };
export type VehicleImageMapping = { manufacturerId: string; model: string; variant?: string | null; year?: number | null; active: boolean; path: string };
export function normalizeVehicleImageKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
export function resolveVehicleImage(identity: VehicleImageIdentity, mappings: readonly VehicleImageMapping[]): string | null {
  const model = normalizeVehicleImageKey(identity.model);
  const variant = normalizeVehicleImageKey(identity.variant);
  if (!identity.manufacturerId || !model) return null;
  const candidates = mappings.filter(row => row.active && row.manufacturerId === identity.manufacturerId &&
    normalizeVehicleImageKey(row.model) === model &&
    (!normalizeVehicleImageKey(row.variant) || (variant && normalizeVehicleImageKey(row.variant) === variant)) &&
    (row.year == null || row.year === identity.year));
  const rank = (row: VehicleImageMapping) => (normalizeVehicleImageKey(row.variant) ? 2 : 0) + (row.year != null ? 1 : 0);
  candidates.sort((a,b) => rank(b)-rank(a));
  if (!candidates.length || (candidates.length > 1 && rank(candidates[0]) === rank(candidates[1]))) return null;
  return candidates[0].path;
}
