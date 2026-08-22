import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CarFront, Eye } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type VehicleDetail = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  chassis_no: string | null;
  engine_no: string | null;
  fuel_type: string | null;
  registration_status: string | null;
  registration_date: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  road_tax_expiry_date: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
  engine_capacity_cc: number | null;
  seating_capacity: number | null;
  gvw_kg: number | null;
  permit_no: string | null;
  customers: { customer_code: string; contact_name: string; phone: string } | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleReadOnlyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCapability("view_vehicles");
  if (!profile?.id) redirect("/access-denied");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,vehicle_type,make,model,year,chassis_no,engine_no,fuel_type,registration_status,registration_date,fitness_expiry_date,puc_expiry_date,road_tax_expiry_date,national_permit_expiry_date,local_permit_expiry_date,engine_capacity_cc,seating_capacity,gvw_kg,permit_no,customers(customer_code,contact_name,phone)")
    .eq("id", id)
    .maybeSingle<VehicleDetail>();
  if (error || !data) notFound();
  const accessibleIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles");
  if (accessibleIds !== null && !accessibleIds.includes(data.customer_id)) redirect("/access-denied");

  return (
    <AppShell title="Vehicle details" backHref="/vehicles">
      <section className="mx-auto max-w-[1100px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5ECF5] bg-[#F8FAFC] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#17365D] text-white"><CarFront className="h-5 w-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#64748B]">Read-only vehicle record</p><h1 className="mt-1 font-mono text-[18px] font-semibold text-[#0F172A]">{displayVehicleNo(data)}</h1><p className="mt-1 text-[10px] text-[#64748B]">{data.vehicle_type} · {[data.make, data.model].filter(Boolean).join(" ") || "Vehicle details"}</p></div></div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#CFE0F2] bg-[#EFF6FF] px-3 py-1.5 text-[9px] font-bold text-[#315B9A]"><Eye className="h-3.5 w-3.5" />View only</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Info label="Customer" value={data.customers?.contact_name} />
          <Info label="Customer code" value={data.customers?.customer_code} />
          <Info label="Registration status" value={pretty(data.registration_status)} />
          <Info label="Registration number" value={displayVehicleNo(data)} />
          <Info label="Class" value={data.vehicle_type} />
          <Info label="Make / model" value={[data.make, data.model].filter(Boolean).join(" ")} />
          <Info label="Manufacturing year" value={data.year ? String(data.year) : null} />
          <Info label="Fuel" value={data.fuel_type} />
          <Info label="Chassis number" value={data.chassis_no} />
          <Info label="Engine number" value={data.engine_no} />
          <Info label="Capacity" value={capacity(data)} />
          <Info label="Permit number" value={data.permit_no} />
          <Info label="Registration date" value={formatDate(data.registration_date)} />
          <Info label="Fitness expiry" value={formatDate(data.fitness_expiry_date)} />
          <Info label="PUC expiry" value={formatDate(data.puc_expiry_date)} />
          <Info label="Road tax expiry" value={formatDate(data.road_tax_expiry_date)} />
          <Info label="National permit expiry" value={formatDate(data.national_permit_expiry_date)} />
          <Info label="Local permit expiry" value={formatDate(data.local_permit_expiry_date)} />
        </div>
        <div className="border-t border-[#E5ECF5] bg-[#FBFCFE] px-5 py-4 text-[9.5px] text-[#64748B]">Vehicle identity and ownership fields are visible for operational verification but cannot be edited from this view.<Link href="/vehicles" className="ml-2 font-bold text-[#315B9A] hover:underline">Back to Vehicle Register</Link></div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) { return <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] px-4 py-3"><p className="text-[8.5px] font-bold uppercase tracking-[.07em] text-[#64748B]">{label}</p><p className="mt-1.5 text-[11px] font-semibold text-[#24324A]">{value?.trim() || "—"}</p></div>; }
function pretty(value: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "—"; }
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN"); }
function displayVehicleNo(vehicle: Pick<VehicleDetail, "vehicle_no" | "registration_status">) { const no = vehicle.vehicle_no?.toUpperCase() ?? ""; return vehicle.registration_status === "registration_pending" || no.startsWith("NEW-") || no.startsWith("PENDING-") ? "Registration pending" : vehicle.vehicle_no; }
function capacity(vehicle: VehicleDetail) { if (vehicle.gvw_kg) return `${vehicle.gvw_kg} kg GVW`; if (vehicle.seating_capacity) return `${vehicle.seating_capacity} seats`; if (vehicle.engine_capacity_cc) return `${vehicle.engine_capacity_cc} cc`; return "—"; }
