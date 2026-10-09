import Link from "next/link";
import { CalendarClock } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  MetricCard,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  CUSTOMER_RENEWAL_DUE_WINDOW_DAYS,
  formatRenewalExpiry,
  loadCustomerRenewals,
} from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerRenewalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; type?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const renewals = await loadCustomerRenewals(account.id);
  const selectedType = renewals.summaries.some((item) => item.key === params.type) ? params.type : "all";
  const items = selectedType === "all" ? renewals.items : renewals.items.filter((item) => item.key === selectedType);

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Compliance & renewals"
        title="Renewals"
        description={`Insurance and vehicle-compliance items due within ${CUSTOMER_RENEWAL_DUE_WINDOW_DAYS} days, plus expired items.`}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/renewals" />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Pending" value={renewals.total_pending} helper="Due + expired compliance" />
        <MetricCard label="Due soon" value={renewals.due_count} helper={`Within ${CUSTOMER_RENEWAL_DUE_WINDOW_DAYS} days`} />
        <MetricCard label="Expired" value={renewals.expired_count} helper="Needs immediate attention" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={{ pathname: "/customer/renewals", query: { account: account.id } }}
          className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${selectedType === "all" ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B]"}`}
        >
          All · {renewals.total_pending}
        </Link>
        {renewals.summaries.map((summary) => (
          <Link
            key={summary.key}
            href={{ pathname: "/customer/renewals", query: { account: account.id, type: summary.key } }}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${selectedType === summary.key ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B]"}`}
          >
            {summary.title} · {summary.total_pending}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyCustomerState title="No pending renewals" body="No due or expired items were found for this Customer account." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
          <table className="min-w-[830px] text-left text-[11px]">
            <thead><tr>{["Renewal item","Vehicle","Reference","Expiry date","Days left","Status","Action"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{items.map(item=><tr key={item.id} className="hover:bg-[#F8FAFD]">
              <td className="font-semibold text-[#142746]">{item.title}</td>
              <td className="font-bold text-[#154D9B]">{item.vehicle_no}</td>
              <td className="max-w-[220px] truncate" title={item.meta||""}>{item.meta||"—"}</td>
              <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5"/>{formatRenewalExpiry(item.expiry_date)}</span></td>
              <td>{item.days_until<0?Math.abs(item.days_until)+" overdue":item.days_until+" days"}</td>
              <td><StatusPill tone={item.status==="expired"?"expired":"due"}>{item.status==="expired"?"Expired":"Due soon"}</StatusPill></td>
              <td><Link href={{ pathname:`/customer/vehicles/${item.vehicle_id}`,query:{account:account.id}}} className="whitespace-nowrap font-bold text-[#1754A5] hover:underline">View →</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}