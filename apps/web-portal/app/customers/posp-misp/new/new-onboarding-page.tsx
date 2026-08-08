import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManualPospMispOnboardingV2 } from "../manual-actions-v2";
import { LegacyOnboardingFields } from "../legacy-onboarding-fields";
import { OnboardingFieldPresentation } from "../onboarding-field-presentation";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export type OnboardingPartnerType = "posp" | "misp";
export type NewOnboardingQuery = Record<string, string | undefined> & {
  form_error?: string;
  form_field?: string;
  legacy_mode?: string;
};

type ManufacturerId = { id: string };
type ManufacturerBrand = { manufacturer_id: string; brand_name: string };

export async function renderNewOnboardingPage(partnerType: OnboardingPartnerType, query: NewOnboardingQuery) {
  const profile = await requirePospMispManager();
  const admin = createSupabaseAdminClient();
  const [salesManagers, oems, banks] = await Promise.all([
    loadSalesManagers(admin, profile!.id, profile!.role),
    loadVehicleManufacturers(admin),
    loadBanks(admin),
  ]);

  const isMisp = partnerType === "misp";
  const legacyMode = query.legacy_mode === "existing";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";
  const title = legacyMode
    ? `Add Existing ${isMisp ? "MISP" : "POSP"} & Partner`
    : isMisp
      ? "Add MISP Application"
      : "Add POSP Application";
  const initialValues = extractInitialValues(query);

  return (
    <AppShell title={title} backHref={backHref}>
      <OnboardingFieldPresentation>
        <PospMispOnboardingForm
          action={createManualPospMispOnboardingV2}
          submitPath={legacyMode ? "/customers/posp-misp/new/legacy-submit" : "/customers/posp-misp/new/submit"}
          partnerType={partnerType}
          initialError={query.form_error ?? null}
          initialField={query.form_field ?? null}
          initialValues={initialValues}
          salesManagers={salesManagers}
          oems={oems}
          banks={banks}
          legacyFields={legacyMode ? <LegacyOnboardingFields partnerType={partnerType} initialValues={initialValues} /> : null}
        />
      </OnboardingFieldPresentation>
    </AppShell>
  );
}

function extractInitialValues(query: NewOnboardingQuery) {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([key, value]) => key.startsWith("v_") && typeof value === "string")
      .map(([key, value]) => [key.slice(2), value ?? ""]),
  );
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>, profileId: string, role: string) {
  const [managers, scope] = await Promise.all([
    loadPospMispAssociates(admin),
    getEmployeeAccessScope(profileId, role),
  ]);
  const visibleManagers = scope.mode === "organization"
    ? managers
    : managers.filter((manager) => scope.employeeIds.includes(manager.id));
  return visibleManagers.map((manager) => ({
    value: manager.id,
    label: `${manager.full_name?.trim() || "Unnamed Sales Employee"}${manager.employee_code ? ` - ${manager.employee_code}` : ""}`,
  }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const [manufacturersResult, brandsResult] = await Promise.all([
    admin.from("vehicle_manufacturers").select("id").eq("is_active", true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id, brand_name").eq("is_active", true).order("brand_name", { ascending: true }).returns<ManufacturerBrand[]>(),
  ]);
  if (manufacturersResult.error || brandsResult.error) throw new Error(`Unable to load vehicle OEMs: ${manufacturersResult.error?.message ?? brandsResult.error?.message}`);

  const activeIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
  const names = Array.from(new Set((brandsResult.data ?? []).filter((brand) => activeIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name))).sort((a, b) => a.localeCompare(b));
  return names.map((name) => ({ value: name, label: name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("banks")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}
