import { PolicyUnifiedForm, type PolicyRmOption, type PolicySourceOption } from "@/components/policy-unified-form";
import { PolicyOnboardingProductGuard } from "@/components/policy-onboarding-product-guard";
import { PolicyRemarksActionStyle } from "@/components/policy-remarks-action-style";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type InsurerOption = { id: string; name: string };
type IntermediaryOption = {
  id: string;
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
  associate_employee_id: string | null;
  application_id: string | null;
};
type ApplicationPartnerRow = { id: string; partner_record_id: string | null };
type PartnerAssociateRow = { partner_record_id: string | null; associate_employee_id: string | null; created_at: string };
type ManufacturerId = { id: string };
type BrandOption = { manufacturer_id: string; brand_name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage() {
  await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  let salesEmployees: Awaited<ReturnType<typeof loadPospMispAssociates>> = [];
  try {
    salesEmployees = await loadPospMispAssociates(admin);
  } catch {
    return <SetupError />;
  }

  const [insurersResult, intermediariesResult, manufacturersResult, brandsResult] = await Promise.all([
    admin.from("insurance_companies").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>(),
    admin
      .from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,application_id")
      .in("intermediary_type", ["posp", "misp", "partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>(),
    admin.from("vehicle_manufacturers").select("id").eq("is_active", true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id, brand_name").eq("is_active", true).order("brand_name", { ascending: true }).returns<BrandOption[]>(),
  ]);

  if (insurersResult.error || intermediariesResult.error || manufacturersResult.error || brandsResult.error) return <SetupError />;

  const intermediaryRows = intermediariesResult.data ?? [];
  const partnerApplicationIds = intermediaryRows
    .filter((item) => item.intermediary_type === "partner" && !item.associate_employee_id && item.application_id)
    .map((item) => item.application_id!)
    .filter((value, index, values) => values.indexOf(value) === index);

  const partnerApplicationsResult = partnerApplicationIds.length
    ? await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id")
      .in("id", partnerApplicationIds)
      .returns<ApplicationPartnerRow[]>()
    : { data: [] as ApplicationPartnerRow[], error: null };
  if (partnerApplicationsResult.error) return <SetupError />;

  const partnerRecordByApplication = new Map(
    (partnerApplicationsResult.data ?? [])
      .filter((row) => row.partner_record_id)
      .map((row) => [row.id, row.partner_record_id!])
  );
  const partnerRecordIds = Array.from(new Set(partnerRecordByApplication.values()));

  const partnerAssociatesResult = partnerRecordIds.length
    ? await admin
      .from("posp_misp_onboarding_profiles")
      .select("partner_record_id,associate_employee_id,created_at")
      .in("partner_record_id", partnerRecordIds)
      .not("associate_employee_id", "is", null)
      .order("created_at", { ascending: false })
      .returns<PartnerAssociateRow[]>()
    : { data: [] as PartnerAssociateRow[], error: null };
  if (partnerAssociatesResult.error) return <SetupError />;

  const associateByPartnerRecord = new Map<string, string>();
  for (const row of partnerAssociatesResult.data ?? []) {
    if (row.partner_record_id && row.associate_employee_id && !associateByPartnerRecord.has(row.partner_record_id)) {
      associateByPartnerRecord.set(row.partner_record_id, row.associate_employee_id);
    }
  }

  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));
  const activeManufacturerIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
  const makeNames = Array.from(new Set((brandsResult.data ?? []).filter((brand) => activeManufacturerIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name))).sort((a, b) => a.localeCompare(b));
  const manufacturerOptions = makeNames;
  const rmOptions: PolicyRmOption[] = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sourceOptions: PolicySourceOption[] = intermediaryRows
    .filter((item) => item.intermediary_code?.trim() && item.display_name?.trim())
    .map((item) => {
      const partnerRecordId = item.application_id ? partnerRecordByApplication.get(item.application_id) : null;
      const associateEmployeeId = item.associate_employee_id || (partnerRecordId ? associateByPartnerRecord.get(partnerRecordId) : null) || null;
      const associate = associateEmployeeId ? employeeById.get(associateEmployeeId) : null;
      return {
        type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
        value: item.id,
        label: item.display_name.trim(),
        code: item.intermediary_code!.trim(),
        rmName: associate?.full_name?.trim() || "",
        rmCode: associate?.employee_code?.trim() || ""
      };
    });

  return (
    <AppShell title="Add Policy">
      <PolicyRemarksActionStyle />
      <PolicyOnboardingProductGuard />
      <PolicyUnifiedForm mode="create" insurers={insurerOptions} rms={rmOptions} sources={sourceOptions} manufacturers={manufacturerOptions} />
    </AppShell>
  );
}

function SetupError() {
  return (
    <AppShell title="Add Policy">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-amber-900">Policy setup information is temporarily unavailable.</h2>
        <p className="mt-1 text-[10.5px] leading-5 text-amber-800">Insurer, intermediary or relationship master data could not be loaded. Refresh the page or try again shortly; no policy information has been changed.</p>
      </div>
    </AppShell>
  );
}
