import Image from "next/image";
import { getStaticInsurerLogo } from "@/lib/insurer-logo";
import { VehicleInsuranceHistoryRow } from "./vehicle-insurance-history-row";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
} from "@/components/customer-portal/customer-phase1";
import {
  customerDisplayVehicleNo,
  customerPolicyTone,
  formatCustomerDate,
  loadCustomerVehicleDetail,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerVehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const query: { account?: string } = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const { vehicle, policies } = await loadCustomerVehicleDetail(account.id, id);

  const ownership = [
    ["Registration number", customerDisplayVehicleNo(vehicle)],
    ["Registration date", formatCustomerDate(vehicle.registration_date)],
    ["Manufacturer", vehicle.make || "—"],
    ["Manufacturing year", vehicle.year?.toString() || "—"],
    ["Model", vehicle.model || "—"],
  ];
  const specification = [
    ["Vehicle class", vehicle.vehicle_type || "—"],
    ["Chassis number", vehicle.chassis_no || "—"],
    ["Engine number", vehicle.engine_no || "—"],
  ];
  const compliance = [
    ["Fitness expiry", formatCustomerDate(vehicle.fitness_expiry_date)],
    ["PUC expiry", formatCustomerDate(vehicle.puc_expiry_date)],
    ["Road tax expiry", formatCustomerDate(vehicle.road_tax_expiry_date)],
    ["National permit expiry", formatCustomerDate(vehicle.national_permit_expiry_date)],
    ["Local permit expiry", formatCustomerDate(vehicle.local_permit_expiry_date)],
  ];
  const sections = [
    { title: "Vehicle Ownership", fields: ownership, image: "/assets/customer-3d-icons/vehicle_register.png" },
    { title: "Vehicle Specification", fields: specification, image: "/assets/customer-3d-icons/brand_new_vehicle.png" },
    { title: "Compliance & Permit", fields: compliance, image: "/assets/customer-3d-icons/e_challan.png" },
  ];

  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />
      <header className="relative isolate flex min-h-[105px] items-center overflow-hidden rounded-xl border border-[#244A7A] bg-[linear-gradient(110deg,#102A4F_0%,#164878_70%,#245F95_100%)] px-5 py-4 text-white sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] overflow-hidden sm:block">
          <div className="absolute -right-8 -top-16 h-44 w-44 rounded-full border-[25px] border-white/10" />
          <div className="absolute bottom-[-56px] right-28 h-40 w-40 rounded-full bg-[#82C5FF]/10 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-3">
          <Image src="/assets/customer-3d-icons/my_vehicles.png" alt="" width={56} height={56} className="h-14 w-14 shrink-0 object-contain drop-shadow-md" />
          <div><h1 className="text-[20px] font-extrabold leading-tight text-white">Vehicle Details</h1><p className="mt-1 text-[11px] font-medium text-[#D2E5FC]">View and manage your vehicle information</p></div>
        </div>
      </header>
      {sections.map((section, i) => {
        return <section key={section.title} className="overflow-hidden rounded-xl border border-[#DBE5F1] bg-white p-2.5 shadow-[0_3px_12px_rgba(18,47,88,0.04)] sm:p-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#EAF1FA] px-2.5 py-1.5">
            <Image src={section.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
            <h2 className="text-[13px] font-bold text-[#17365F]">{section.title}</h2>
          </div>
          <dl className={"grid gap-x-3 gap-y-3 px-2 py-3 " + (i === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-5")}>
            {section.fields.map(([label, value]) => {
              return <div key={label} className="min-w-0">
                <dt className="mb-1.5 text-[10px] font-semibold text-[#5C7190]">{label}</dt>
                <dd className="flex min-h-[38px] items-center gap-2 overflow-hidden rounded-md border border-[#DBE5F1] bg-white px-2.5 text-[11px] font-semibold text-[#244264] shadow-[0_1px_3px_rgba(18,47,88,0.04)]">
                  <span className="min-w-0 flex-1 break-words">{value}</span>
                </dd>
              </div>;
            })}
          </dl>
        </section>;
      })}
      <section className="overflow-hidden rounded-xl border border-[#DBE5F1] bg-white p-2.5 shadow-[0_3px_12px_rgba(18,47,88,0.04)] sm:p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#EAF1FA] px-2.5 py-1.5">
          <Image src="/assets/customer-3d-icons/policy_related.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
          <h2 className="text-[13px] font-bold text-[#17365F]">Insurance History</h2>
        </div>
        <div className="px-2 pb-1 pt-2.5">
          {policies.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-[11px] text-[#244264]">
            <thead className="bg-[#EAF1FA] text-[10px] font-semibold text-[#385B82]"><tr>
              {["Policy No.", "Insurer", "Valid Until", "Source", "Status"].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E5EDF6]">{policies.map(policy => {
              const status = customerPolicyTone(policy.end_date);
              return <VehicleInsuranceHistoryRow
                key={policy.source + ":" + policy.id}
                href={`/customer/policies/${encodeURIComponent(policy.id)}?${new URLSearchParams({account: account.id, source: policy.source}).toString()}`}
                policyNo={policy.policy_no || "—"}
                insurerName={policy.insurer_name || policy.policy_type || "Unknown insurer"}
                insurerLogo={getStaticInsurerLogo(policy.insurer_name)}
                validUntil={formatCustomerDate(policy.end_date)}
                source={policy.source}
                status={status.tone}
              />;
            })}</tbody>
          </table></div> : <EmptyCustomerState title="No policies for this vehicle" body="Insurance policies linked to this vehicle will appear here."/>}
        </div>
      </section>
    </div>
  );
}