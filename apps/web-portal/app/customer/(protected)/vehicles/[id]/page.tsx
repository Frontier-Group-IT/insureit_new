import Link from "next/link";
import { ArrowLeft, CalendarDays, CarFront, ShieldCheck, Gauge, History, FileText, Hash, Factory, CalendarCheck, ChevronDown, Settings2 } from "lucide-react";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
  StatusPill,
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
    { title: "Vehicle Ownership", fields: ownership, icons: [Hash, CalendarDays, Factory, CalendarDays, CarFront], icon: CarFront },
    { title: "Vehicle Specification", fields: specification, icons: [CarFront, FileText, Settings2], icon: Gauge },
    { title: "Compliance & Permit", fields: compliance, icons: [CalendarCheck, CalendarCheck, CalendarCheck, CalendarCheck, CalendarCheck], icon: ShieldCheck },
  ];

  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />
      <header className="relative isolate flex min-h-[105px] items-center overflow-hidden rounded-xl border border-[#E8E5FF] bg-[#EFEDFF] px-5 py-4 sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[45%] overflow-hidden sm:block">
          <div className="absolute inset-0 bg-gradient-to-l from-[#C5BCFF] via-[#E4DFFF] to-transparent" />
          <CarFront className="absolute bottom-[-36px] right-12 h-36 w-36 rotate-[-7deg] text-[#6652BE]/35" strokeWidth={1.1} />
          <ShieldCheck className="absolute right-4 top-2 h-16 w-16 text-[#6754C5]/45" strokeWidth={1.4} />
        </div>
        <div className="relative flex items-center gap-3">
          <Link href={{ pathname: "/customer/vehicles", query: { account: account.id } }} aria-label="Back to Vehicles" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#5A43B5] text-white shadow-sm hover:bg-[#44318E]"><ArrowLeft className="h-5 w-5" /></Link>
          <div><h1 className="text-[20px] font-extrabold leading-tight text-[#292458]">Vehicle Details</h1><p className="mt-1 text-[11px] font-medium text-[#777395]">View and manage your vehicle information</p></div>
        </div>
      </header>
      {sections.map((section, i) => {
        const SectionIcon = section.icon;
        return <section key={section.title} className="overflow-hidden rounded-xl border border-[#E5E6F3] bg-white p-2.5 shadow-[0_3px_12px_rgba(52,40,115,0.04)] sm:p-3">
          <div className="flex items-center gap-2 rounded-lg bg-[#F0F0FF] px-2.5 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#5E44B8] text-white"><SectionIcon className="h-[17px] w-[17px]" /></span>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#4D3C9B] text-[10px] font-bold text-white">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="text-[13px] font-bold text-[#292458]">{section.title}</h2>
          </div>
          <dl className={"grid gap-x-3 gap-y-3 px-2 py-3 " + (i === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-5")}>
            {section.fields.map(([label, value], fieldIndex) => {
              const Icon = section.icons[fieldIndex];
              return <div key={label} className="min-w-0">
                <dt className="mb-1.5 text-[10px] font-semibold text-[#746F9B]">{label}</dt>
                <dd className="flex min-h-[38px] items-center gap-2 overflow-hidden rounded-md border border-[#E1E4F4] bg-white px-2.5 text-[11px] font-semibold text-[#3D3866] shadow-[0_1px_3px_rgba(45,40,110,0.04)]">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[#6759B0]" />
                  <span className="min-w-0 flex-1 break-words">{value}</span>
                  {(i === 2 || label === "Manufacturer" || label === "Manufacturing year" || label === "Model") ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#7E78B1]" /> : null}
                </dd>
              </div>;
            })}
          </dl>
        </section>;
      })}
      <section className="overflow-hidden rounded-xl border border-[#E5E6F3] bg-white p-2.5 shadow-[0_3px_12px_rgba(52,40,115,0.04)] sm:p-3">
        <div className="flex items-center gap-2 rounded-lg bg-[#F0F0FF] px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#5E44B8] text-white"><History className="h-[17px] w-[17px]" /></span>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#4D3C9B] text-[10px] font-bold text-white">13</span>
          <h2 className="text-[13px] font-bold text-[#292458]">Insurance History</h2>
        </div>
        <div className="px-2 pb-1 pt-2.5">
          {policies.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-[11px] text-[#393766]">
            <thead className="bg-[#F0F0FF] text-[10px] font-semibold text-[#625B90]"><tr>
              {["Policy No.", "Insurer", "Valid Until", "Source", "Status", "Action"].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#ECECF6]">{policies.map(policy => {
              const status = customerPolicyTone(policy.end_date);
              return <tr key={policy.source + ":" + policy.id} className="hover:bg-[#FAF9FF]">
                <td className="px-3 py-3 font-semibold text-[#36306A]">{policy.policy_no || "—"}</td>
                <td className="px-3 py-3">{policy.insurer_name || policy.policy_type}</td>
                <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#6351AB]"/>{formatCustomerDate(policy.end_date)}</span></td>
                <td className="px-3 py-3 text-[10px] font-semibold uppercase">{policy.source}</td>
                <td className="px-3 py-3"><StatusPill tone={status.tone}>{status.tone}</StatusPill></td>
                <td className="px-3 py-3"><Link href={{pathname:"/customer/policies/" + policy.id,query:{account:account.id,source:policy.source}}} className="font-bold text-[#5A43B5] hover:underline">View →</Link></td>
              </tr>;
            })}</tbody>
          </table></div> : <EmptyCustomerState title="No policies for this vehicle" body="Insurance policies linked to this vehicle will appear here."/>}
        </div>
      </section>
    </div>
  );
}