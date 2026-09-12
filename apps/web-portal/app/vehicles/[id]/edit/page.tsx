import { notFound, redirect } from "next/navigation";
import { saveVehicleMaster } from "@/app/vehicles/vehicle-master-actions";
import { VehicleActivityStatus } from "@/components/vehicle-activity-status";
import { VehiclePolicyFooterSummary, type VehicleLinkedPolicy } from "@/components/vehicle-policy-footer-summary";
import { VehicleForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type ManufacturerId = { id: string };
type BrandOption = { manufacturer_id: string; brand_name: string };
type VehicleValues = {
  customer_id: string;
  vehicle_no: string;
  registration_status: string | null;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  chassis_no: string | null;
  engine_no: string | null;
  permit_no: string | null;
  year: number | null;
  engine_capacity_cc: number | null;
  seating_capacity: number | null;
  gvw_kg: number | null;
  fuel_type: string | null;
  registration_date: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  road_tax_expiry_date: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
};
type VehicleRow = VehicleValues & {
  id: string;
  created_at: string | null;
  updated_at: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function capacityForVehicle(vehicle: VehicleValues) {
  if (vehicle.vehicle_type === "PCP" || vehicle.vehicle_type === "TWP" || vehicle.vehicle_type === "MISD") return vehicle.engine_capacity_cc;
  if (vehicle.vehicle_type === "PCV") return vehicle.seating_capacity;
  if (vehicle.vehicle_type === "GCV" || vehicle.vehicle_type === "CPM") return vehicle.gvw_kg;
  return vehicle.engine_capacity_cc ?? vehicle.gvw_kg ?? vehicle.seating_capacity;
}

export default async function EditVehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ embedded?: string; error?: string }> }) {
  const profile = await requireCapability("view_vehicles");
  const [{ id }, query, canEdit, accessibleCustomerIds] = await Promise.all([
    params,
    searchParams,
    hasEffectiveCapability(profile, "view_vehicles", "edit"),
    getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles"),
  ]);
  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) redirect("/access-denied");

  const embedded = query.embedded === "1";
  const admin = createSupabaseAdminClient();
  let vehicleRequest = admin
    .from("vehicles")
    .select("id, customer_id, vehicle_no, registration_status, vehicle_type, make, model, chassis_no, engine_no, permit_no, year, engine_capacity_cc, seating_capacity, gvw_kg, fuel_type, registration_date, fitness_expiry_date, puc_expiry_date, road_tax_expiry_date, national_permit_expiry_date, local_permit_expiry_date, created_at, updated_at")
    .eq("id", id);
  if (accessibleCustomerIds !== null) vehicleRequest = vehicleRequest.in("customer_id", accessibleCustomerIds);
  const vehicleResult = await vehicleRequest.maybeSingle<VehicleRow>();

  if (vehicleResult.error) throw new Error(`Unable to load vehicle details: ${vehicleResult.error.message}`);
  if (!vehicleResult.data) notFound();

  let customersRequest = admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false });
  if (accessibleCustomerIds !== null) customersRequest = customersRequest.in("id", accessibleCustomerIds);

  const [customersResult, manufacturersResult, brandsResult, policiesResult] = await Promise.all([
    customersRequest.returns<CustomerOption[]>(),
    admin.from("vehicle_manufacturers").select("id").eq("is_active", true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id, brand_name").eq("is_active", true).order("brand_name", { ascending: true }).returns<BrandOption[]>(),
    admin.from("policies").select("id,policy_no,start_date,end_date,policy_documents(id,document_type)").eq("vehicle_id", id).order("end_date", { ascending: false }).limit(20).returns<VehicleLinkedPolicy[]>(),
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (manufacturersResult.error || brandsResult.error) throw new Error(`Unable to load vehicle makes: ${manufacturersResult.error?.message ?? brandsResult.error?.message}`);
  if (policiesResult.error) throw new Error(`Unable to load linked policies: ${policiesResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const activeManufacturerIds = new Set((manufacturersResult.data ?? []).map((manufacturer) => manufacturer.id));
  const makeNames = Array.from(new Set((brandsResult.data ?? []).filter((brand) => activeManufacturerIds.has(brand.manufacturer_id)).map((brand) => brand.brand_name)));
  if (vehicleResult.data.make && !makeNames.some((name) => name.toLowerCase() === vehicleResult.data!.make!.toLowerCase())) makeNames.push(vehicleResult.data.make);
  makeNames.sort((a, b) => a.localeCompare(b));
  const manufacturerOptions = makeNames.map((name) => ({ value: name, label: name }));
  const vehicle = vehicleResult.data;
  const formVehicle = { ...vehicle, gvw_kg: capacityForVehicle(vehicle) };

  const editor = (
    <>
      {query.error && canEdit ? <div className="mx-auto mb-3 max-w-[1480px] rounded-xl border border-[#F0C9C5] bg-[#FFF5F4] px-4 py-3 text-[10px] font-semibold text-[#B42318]">{query.error}</div> : null}
      {!canEdit ? (
        <div className="mx-auto mb-3 max-w-[1480px] rounded-xl border border-[#D6E2F0] bg-[#F7FAFD] px-4 py-2.5 text-[10.5px] font-semibold text-[#3D536D]">
          View only — you can review this vehicle, but you do not have permission to edit it.
        </div>
      ) : null}
      <fieldset disabled={!canEdit} className={`m-0 min-w-0 border-0 p-0 ${canEdit ? "" : "[&_button[type=submit]]:hidden"}`}>
        <VehicleForm
          action={saveVehicleMaster.bind(null, id)}
          customers={customerOptions}
          manufacturers={manufacturerOptions}
          values={formVehicle}
          submitLabel="Save changes"
          beforeActions={<VehicleActivityStatus vehicleId={vehicle.id} createdAt={vehicle.created_at} updatedAt={vehicle.updated_at} />}
          footerContent={<VehiclePolicyFooterSummary policies={policiesResult.data ?? []} customerId={vehicle.customer_id} vehicleId={vehicle.id} />}
        />
      </fieldset>
    </>
  );

  if (embedded) return <main data-embedded-editor="vehicle" className="min-h-screen bg-[#F6F8FB] p-3 sm:p-4">{editor}</main>;
  return <AppShell title={canEdit ? "Edit Vehicle" : "Vehicle Details"}>{editor}</AppShell>;
}
