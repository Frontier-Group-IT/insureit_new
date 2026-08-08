import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type SelectOption = { value: string; label: string };
export type SalesManagerOption = SelectOption;
export type ImportSalesManagerOption = { id: string; fullName: string; employeeCode: string | null };
export type PospMispAssociateOption = {
  id: string;
  profile_id: string | null;
  full_name: string | null;
  employee_code: string | null;
};
type ManufacturerId = { id: string };
type ManufacturerBrand = { manufacturer_id: string; brand_name: string };

export const getActiveBankOptions = unstable_cache(
  async (): Promise<SelectOption[]> => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("banks")
      .select("id,name")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string }>>();
    if (error) throw error;
    return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
  },
  ["reference-active-bank-options"],
  { revalidate: 300, tags: ["reference:banks"] },
);

export const getActiveVehicleManufacturerOptions = unstable_cache(
  async (): Promise<SelectOption[]> => {
    const admin = createSupabaseAdminClient();
    const [manufacturersResult, brandsResult] = await Promise.all([
      admin.from("vehicle_manufacturers").select("id").eq("is_active", true).returns<ManufacturerId[]>(),
      admin
        .from("vehicle_manufacturer_brands")
        .select("manufacturer_id, brand_name")
        .eq("is_active", true)
        .order("brand_name", { ascending: true })
        .returns<ManufacturerBrand[]>(),
    ]);
    if (manufacturersResult.error || brandsResult.error) {
      throw new Error(`Unable to load vehicle OEMs: ${manufacturersResult.error?.message ?? brandsResult.error?.message}`);
    }

    const activeIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
    const names = Array.from(
      new Set((brandsResult.data ?? []).filter((brand) => activeIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name)),
    ).sort((a, b) => a.localeCompare(b));
    return names.map((name) => ({ value: name, label: name }));
  },
  ["reference-active-vehicle-manufacturer-options"],
  { revalidate: 300, tags: ["reference:vehicle-manufacturers"] },
);

export const getPospMispAssociates = unstable_cache(
  async (): Promise<PospMispAssociateOption[]> => {
    const admin = createSupabaseAdminClient();
    const { data: employees, error } = await admin
      .from("employees")
      .select("id, full_name, employee_code")
      .ilike("department", "sales")
      .eq("employment_status", "active")
      .order("full_name", { ascending: true })
      .returns<Array<{ id: string; full_name: string | null; employee_code: string | null }>>();
    if (error) throw error;

    const employeeIds = (employees ?? []).map((employee) => employee.id);
    const { data: profiles, error: profileError } = employeeIds.length
      ? await admin
        .from("profiles")
        .select("id, employee_id")
        .in("employee_id", employeeIds)
        .eq("is_active", true)
        .returns<Array<{ id: string; employee_id: string | null }>>()
      : { data: [], error: null };
    if (profileError) throw profileError;

    const profileByEmployeeId = new Map((profiles ?? []).map((profile) => [profile.employee_id, profile.id]));
    return (employees ?? []).map((employee) => ({
      ...employee,
      profile_id: profileByEmployeeId.get(employee.id) ?? null,
    }));
  },
  ["reference-posp-misp-associates"],
  { revalidate: 60, tags: ["reference:posp-misp-associates"] },
);

export async function getPospMispSalesManagerOptions(): Promise<SalesManagerOption[]> {
  const associates = await getPospMispAssociates();
  return associates.map((manager) => ({
    value: manager.id,
    label: `${manager.full_name?.trim() || "Unnamed Sales Employee"}${manager.employee_code ? ` - ${manager.employee_code}` : ""}`,
  }));
}

export async function getImportSalesManagerOptions(): Promise<ImportSalesManagerOption[]> {
  const associates = await getPospMispAssociates();
  return associates.map((manager) => ({
    id: manager.id,
    fullName: manager.full_name?.trim() || "Unnamed Sales Employee",
    employeeCode: manager.employee_code,
  }));
}
