import Link from "next/link";
import { ArrowLeft, CalendarDays, CarFront, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
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
  const currentPolicy = policies.find((policy) => customerPolicyTone(policy.end_date).tone !== "expired");

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
    { title: "Vehicle Ownership", fields: ownership },
    { title: "Vehicle Specification", fields: specification },
    { title: "Compliance & Permit", fields: compliance },
  ];

  return (
    <div className="space-y-3">
      <Link href={{ pathname: "/customer/vehicles", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to vehicles
      </Link>
      <CustomerPageHeading
        eyebrow="Vehicle detail"
        title={customerDisplayVehicleNo(vehicle)}
        description={[vehicle.make, vehicle.model].filter(Boolean).join(" · ") || vehicle.vehicle_type}
        action={<StatusPill tone={currentPolicy ? "active" : "expired"}>{currentPolicy ? "Covered" : "No active policy"}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />

      <div className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="bg-[#1E416D] px-4 py-3 text-white">
          <div className="flex items-center gap-2"><CarFront className="h-4 w-4"/><h2 className="text-[16px] font-semibold">Vehicle Details</h2></div>
        </div>
        <div className="grid grid-cols-3 border-b border-[#DFE8F3] bg-[#F8FAFD]">
          {sections.map((section,i)=><div key={section.title} className="flex items-center justify-center gap-2 border-r border-[#DFE8F3] px-2 py-3 text-[11px] font-semibold text-[#47607D] last:border-r-0">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EAF1F9] text-[10px] text-[#2B537A]">{String(i+1).padStart(2,"0")}</span>{section.title}
          </div>)}
        </div>
      </div>
      {sections.map((section,i)=><section key={section.title} className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="flex items-center gap-3 border-b border-[#DFE8F3] px-3 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365F] text-[11px] font-bold text-white">{String(i+1).padStart(2,"0")}</span>
          <h2 className="text-[13px] font-semibold text-[#10213D]">{section.title}</h2>
        </div>
        <dl className={`grid gap-x-3 gap-y-2 p-3 ${i===0?"sm:grid-cols-2 lg:grid-cols-5":i===1?"sm:grid-cols-2 lg:grid-cols-3":"sm:grid-cols-2 lg:grid-cols-5"}`}>
          {section.fields.map(([label,value])=><div key={label} className="min-w-0">
            <dt className="mb-1 text-[10px] font-semibold text-[#60728B]">{label}</dt>
            <dd className="min-h-9 break-words rounded-lg border border-[#DCE4EE] bg-[#FBFCFE] px-3 py-2 text-[11px] font-semibold text-[#142746]">{value}</dd>
          </div>)}
        </dl>
      </section>)}
      <section className="overflow-hidden rounded-xl border border-[#DCE4EE] bg-white">
        <div className="flex items-center gap-2 border-b border-[#DFE8F3] px-3 py-2.5"><ShieldCheck className="h-4 w-4 text-[#174EA6]"/><h2 className="text-[13px] font-semibold text-[#10213D]">Insurance History</h2></div>
        <div className="p-3">
          {policies.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[11px]"><thead><tr><th>Policy No.</th><th>Insurer</th><th>Valid Until</th><th>Source</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{policies.map(policy=>{const status=customerPolicyTone(policy.end_date);return <tr key={`${policy.source}:${policy.id}`}>
              <td className="font-bold text-[#153D76]">{policy.policy_no}</td><td>{policy.insurer_name||policy.policy_type}</td>
              <td><span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3"/>{formatCustomerDate(policy.end_date)}</span></td>
              <td className="uppercase">{policy.source}</td><td><StatusPill tone={status.tone}>{status.tone}</StatusPill></td>
              <td><Link href={{pathname:`/customer/policies/${policy.id}`,query:{account:account.id,source:policy.source}}} className="font-bold text-[#174EA6] hover:underline">View →</Link></td>
            </tr>})}</tbody></table></div> : <EmptyCustomerState title="No policies for this vehicle" body="Insurance policies linked to this vehicle will appear here."/>}
        </div>
      </section>

    </div>
  );
}