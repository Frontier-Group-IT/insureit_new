import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadManagementPack, type ManagementPack } from "@/lib/reports/management-pack";

type ViewerProfile = { id: string; role: string | null };

export type ManagementPackSnapshotSummary = {
  id: string;
  month: string;
  scopeMode: ManagementPack["scopeMode"];
  snapshotVersion: number;
  capturedAt: string;
};

export type ManagementPackSnapshot = ManagementPackSnapshotSummary & {
  pack: ManagementPack;
};

export async function listManagementPackSnapshots(profileId: string, limit = 24): Promise<ManagementPackSnapshotSummary[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("management_pack_snapshots")
    .select("id, month, scope_mode, snapshot_version, captured_at")
    .eq("owner_profile_id", profileId)
    .order("month", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 60));
  if (error) throw new Error(`Unable to load management pack archive: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    month: String(row.month).slice(0, 7),
    scopeMode: scopeMode(row.scope_mode),
    snapshotVersion: numberValue(row.snapshot_version) || 1,
    capturedAt: String(row.captured_at),
  }));
}

export async function loadManagementPackSnapshot(profileId: string, snapshotId: string | undefined): Promise<ManagementPackSnapshot | null> {
  if (!validUuid(snapshotId)) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("management_pack_snapshots")
    .select("id, month, scope_mode, snapshot_version, snapshot, captured_at")
    .eq("id", snapshotId)
    .eq("owner_profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load management pack snapshot: ${error.message}`);
  if (!data || !isPack(data.snapshot)) return null;
  return {
    id: String(data.id),
    month: String(data.month).slice(0, 7),
    scopeMode: scopeMode(data.scope_mode),
    snapshotVersion: numberValue(data.snapshot_version) || 1,
    capturedAt: String(data.captured_at),
    pack: data.snapshot as ManagementPack,
  };
}

export async function findManagementPackSnapshotForMonth(profileId: string, month: string): Promise<ManagementPackSnapshotSummary | null> {
  if (!validMonth(month)) return null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("management_pack_snapshots")
    .select("id, month, scope_mode, snapshot_version, captured_at")
    .eq("owner_profile_id", profileId)
    .eq("month", `${month}-01`)
    .maybeSingle();
  if (error) throw new Error(`Unable to check management pack snapshot: ${error.message}`);
  if (!data) return null;
  return {
    id: String(data.id),
    month: String(data.month).slice(0, 7),
    scopeMode: scopeMode(data.scope_mode),
    snapshotVersion: numberValue(data.snapshot_version) || 1,
    capturedAt: String(data.captured_at),
  };
}

export async function captureManagementPackSnapshot(profile: ViewerProfile, month: string): Promise<ManagementPackSnapshotSummary> {
  if (!isManagementPackCloseEligible(month)) throw new Error("Management Pack snapshots can only be captured on the final calendar day of the current month.");
  const existing = await findManagementPackSnapshotForMonth(profile.id, month);
  if (existing) return existing;

  const pack = await loadManagementPack(profile, { month });
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("management_pack_snapshots")
    .insert({
      owner_profile_id: profile.id,
      month: `${pack.filters.month}-01`,
      scope_mode: pack.scopeMode,
      snapshot_version: 1,
      snapshot: pack,
    })
    .select("id, month, scope_mode, snapshot_version, captured_at")
    .single();
  if (error) {
    if (error.code === "23505") {
      const raced = await findManagementPackSnapshotForMonth(profile.id, month);
      if (raced) return raced;
    }
    throw new Error(`Unable to capture management pack snapshot: ${error.message}`);
  }
  return {
    id: String(data.id),
    month: String(data.month).slice(0, 7),
    scopeMode: scopeMode(data.scope_mode),
    snapshotVersion: numberValue(data.snapshot_version) || 1,
    capturedAt: String(data.captured_at),
  };
}

export function isManagementPackCloseEligible(month: string) {
  if (!validMonth(month)) return false;
  const today = indiaDate(new Date());
  const currentMonth = today.slice(0, 7);
  return month === currentMonth && today === lastDayOfMonth(currentMonth);
}

function isPack(value: unknown): value is ManagementPack {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pack = value as Record<string, unknown>;
  return Boolean(pack.filters && pack.business && pack.distribution && pack.finance && pack.claims && pack.renewals && pack.operations);
}
function scopeMode(value: unknown): ManagementPack["scopeMode"] {
  return value === "organization" || value === "hierarchy" || value === "self" || value === "none" ? value : "none";
}
function validUuid(value: string | undefined) { return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)); }
function validMonth(value: string | undefined) { return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)); }
function numberValue(value: unknown) { const numeric = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(numeric) ? numeric : 0; }
function lastDayOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
