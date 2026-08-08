import { AppShell } from "@/components/shell";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { getActiveBankOptions, getActiveVehicleManufacturerOptions, getPospMispAssociates } from "@/lib/reference-data-cache";
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

export async function renderNewOnboardingPage(partnerType: OnboardingPartnerType, query: NewOnboardingQuery) {
  const profile = await requirePospMispManager();
  const [salesManagers, oems, banks] = await Promise.all([
    loadSalesManagers(profile!.id, profile!.role),
    getActiveVehicleManufacturerOptions(),
    getActiveBankOptions(),
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

async function loadSalesManagers(profileId: string, role: string) {
  const [managers, scope] = await Promise.all([
    getPospMispAssociates(),
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
