import { redirect } from "next/navigation";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { displayVehicleRegistrationNumber } from "@/lib/vehicle-registration";
import { TransferVehicleForm, type TransferCustomerOption } from "./transfer-vehicle-form";

const TRANSFER_ROLES = new Set(["manager", "admin", "super_admin", "it_super_user", "sales_operations_head"]);

type VehicleRow = {
  id: string;
  customer_id: string;
  vehicle_no: string;
  chassis_no: string | null;
  registration_status: string | null;
  customers: { customer_code: string; company_name: string | null; contact_name: string; phone: string } | null;
};

type CustomerRow = {
  id: string;
  customer_code: string;
  company_name: string | null;
  contact_name: string;
  phone: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VehicleTransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await requireCapability("view_vehicles", "edit");
  if (!profile?.id || !TRANSFER_ROLES.has(profile.role ?? "")) redirect("/access-denied");

  const { id } = await params;
  const { error } = await searchParams;
  const admin = createSupabaseAdminClient();
  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles");

  let vehicleQuery = admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,chassis_no,registration_status,customers:customers!vehicles_customer_id_fkey(customer_code,company_name,contact_name,phone)")
    .eq("id", id);
  if (accessibleCustomerIds !== null) vehicleQuery = vehicleQuery.in("customer_id", accessibleCustomerIds);

  const { data: vehicle } = await vehicleQuery.maybeSingle<VehicleRow>();
  if (!vehicle) redirect("/access-denied");

  let customerQuery = admin
    .from("customers")
    .select("id,customer_code,company_name,contact_name,phone")
    .eq("status", "active")
    .neq("id", vehicle.customer_id)
    .order("company_name", { ascending: true, nullsFirst: false })
    .order("contact_name", { ascending: true })
    .limit(1000);

  if (accessibleCustomerIds !== null) {
    const destinationIds = accessibleCustomerIds.filter((customerId) => customerId !== vehicle.customer_id);
    if (!destinationIds.length) {
      customerQuery = customerQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      customerQuery = customerQuery.in("id", destinationIds);
    }
  }

  const { data: customerRows, error: customerError } = await customerQuery.returns<CustomerRow[]>();
  if (customerError) throw new Error(`Unable to load transfer customers: ${customerError.message}`);

  const customers: TransferCustomerOption[] = (customerRows ?? []).map((customer) => ({
    id: customer.id,
    customerCode: customer.customer_code,
    name: customer.company_name?.trim() || customer.contact_name,
    phone: customer.phone ?? "",
  }));

  const currentCustomer = vehicle.customers?.company_name?.trim() || vehicle.customers?.contact_name || "Current customer";

  return (
    <AppShell title="Transfer vehicle" backHref={`/vehicles/${id}`}>
      <section className="mx-auto max-w-[820px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white"><ArrowRightLeft className="h-5 w-5" /></span>
            <div>
              <h1 className="text-[15px] font-semibold text-[#0F172A]">Transfer {displayVehicleRegistrationNumber(vehicle)}</h1>
              <p className="mt-1 text-[10px] text-[#64748B]">Current customer: <span className="font-semibold text-[#334155]">{currentCustomer}</span></p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex gap-3 rounded-xl border border-[#F3D08B] bg-[#FFF9E8] p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#A16207]" />
            <div>
              <p className="text-[11px] font-bold text-[#7C4A03]">Complete-transfer rule</p>
              <p className="mt-1 text-[10px] leading-5 text-[#795C2B]">
                INSUREIT does not allow a vehicle-only transfer. Confirming this action moves the vehicle and every associated customer-scoped dependency together, including policies, claims, related documents and operational/commercial references. The operation is atomic: if any dependency cannot move safely, nothing is transferred.
              </p>
            </div>
          </div>

          {error ? <div className="rounded-lg border border-[#F3C2C2] bg-[#FFF5F5] px-3 py-2 text-[10px] font-semibold text-[#B42318]">{error}</div> : null}

          <TransferVehicleForm vehicleId={id} customers={customers} />
        </div>
      </section>
    </AppShell>
  );
}
