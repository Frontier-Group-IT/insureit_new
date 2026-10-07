import Link from "next/link";
import { CalendarClock, CarFront, FileCheck2, ShieldCheck } from "lucide-react";
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

const renewalIcon = {
  insurance_policy: ShieldCheck,
  national_permit: FileCheck2,
  local_permit: FileCheck2,
  road_tax: FileCheck2,
  puc: FileCheck2,
  fitness: FileCheck2,
} as const;

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
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const Icon = renewalIcon[item.key];
            return (
              <Link
                key={item.id}
                href={{ pathname: `/customer/vehicles/${item.vehicle_id}`, query: { account: account.id } }}
                className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-black text-[#10213D]">{item.title}</p>
                      <StatusPill tone={item.status === "expired" ? "expired" : "due"}>
                        {item.status === "expired" ? "Expired" : `${item.days_until}d left`}
                      </StatusPill>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-black text-[#35445B]"><CarFront className="h-3.5 w-3.5" />{item.vehicle_no}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-[#74839A]">
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatRenewalExpiry(item.expiry_date)}</span>
                      {item.meta ? <span className="truncate">{item.meta}</span> : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}