import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { formatRenewalExpiry, loadCustomerRenewals } from "@/lib/customer-web-phase2-data";
import { CustomerRenewalsRegister } from "./customer-renewals-register";

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
  const items = renewals.items.map(item => ({
    id: item.id,
    title: item.title,
    key: item.key,
    vehicleId: item.vehicle_id,
    vehicleNo: item.vehicle_no,
    reference: item.meta || "",
    expiry: formatRenewalExpiry(item.expiry_date),
    daysUntil: item.days_until,
    status: item.status,
  }));
  const categories = renewals.summaries.map(summary => ({
    key: summary.key,
    title: summary.title,
    count: summary.total_pending,
  }));
  return (
    <div className="space-y-3">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/renewals" />
      <CustomerRenewalsRegister accountId={account.id} items={items} categories={categories} />
    </div>
  );
}
