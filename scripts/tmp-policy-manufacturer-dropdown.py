from pathlib import Path

page_path = Path('apps/web-portal/app/policies/new/page.tsx')
page = page_path.read_text()

page = page.replace(
'''type PartnerAssociateRow = { partner_record_id: string | null; associate_employee_id: string | null; created_at: string };''',
'''type PartnerAssociateRow = { partner_record_id: string | null; associate_employee_id: string | null; created_at: string };
type ManufacturerId = { id: string };
type BrandOption = { manufacturer_id: string; brand_name: string };'''
)

page = page.replace(
'''  const [insurersResult, intermediariesResult] = await Promise.all([
    admin.from("insurance_companies").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>(),
    admin
      .from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,application_id")
      .in("intermediary_type", ["posp", "misp", "partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>()
  ]);

  if (insurersResult.error || intermediariesResult.error) return <SetupError />;''',
'''  const [insurersResult, intermediariesResult, manufacturersResult, brandsResult] = await Promise.all([
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

  if (insurersResult.error || intermediariesResult.error || manufacturersResult.error || brandsResult.error) return <SetupError />;'''
)

page = page.replace(
'''  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));''',
'''  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));
  const activeManufacturerIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
  const makeNames = Array.from(new Set((brandsResult.data ?? []).filter((brand) => activeManufacturerIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name))).sort((a, b) => a.localeCompare(b));
  const manufacturerOptions = makeNames.map((name) => ({ value: name, label: name }));'''
)

page = page.replace(
'''      <PolicyUnifiedForm mode="create" insurers={insurerOptions} rms={rmOptions} sources={sourceOptions} />''',
'''      <PolicyUnifiedForm mode="create" insurers={insurerOptions} rms={rmOptions} sources={sourceOptions} manufacturers={manufacturerOptions} />'''
)

page_path.write_text(page)

form_path = Path('apps/web-portal/components/policy-unified-form.tsx')
form = form_path.read_text()

form = form.replace(
'''  sources: PolicySourceOption[];
  initialValues?: PolicyUnifiedInitialValues;''',
'''  sources: PolicySourceOption[];
  manufacturers: SelectOption[];
  initialValues?: PolicyUnifiedInitialValues;'''
)

form = form.replace(
'''export function PolicyUnifiedForm({ mode, insurers, rms, sources, initialValues }: Props) {''',
'''export function PolicyUnifiedForm({ mode, insurers, rms, sources, manufacturers, initialValues }: Props) {'''
)

form = form.replace(
'''        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled={isEdit}/>''',
'''        {isEdit
          ? <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled/>
          : <Select label="Make" value={form.make} onChange={e=>update("make",e.target.value)} options={manufacturers} placeholder="Select manufacturer"/>}'''
)

form_path.write_text(form)
