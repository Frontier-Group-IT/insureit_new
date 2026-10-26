import Link from "next/link";
import { PartnerReportsShell } from "@/components/partner-portal/partner-reports-shell";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
import { BarChart3, BriefcaseBusiness, FileText, ShieldCheck, Truck, UsersRound } from "lucide-react";
import {
  getPartnerWebBusinessPerformance,
  getPartnerWebPolicySummary,
  getPartnerWebClaimSummary,
  getPartnerWebRenewalSummary,
  getPartnerWebPayoutSummary,
} from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const integer = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value ?? 0));
const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export default async function PartnerReportsPage() {
  // The partner-session guard and every data RPC enforce the authenticated portal account scope.
  // Never substitute the admin report loaders or trust client-supplied group/partner IDs here.
  const reportScope = await requirePartnerReportScope();
  const canShowPayout = reportScope.role === "partner" || reportScope.role === "partner_associate";
  const [performance, policies, claims, renewals, payout] = await Promise.all([
    getPartnerWebBusinessPerformance(),
    getPartnerWebPolicySummary(),
    getPartnerWebClaimSummary(),
    getPartnerWebRenewalSummary(),
    canShowPayout ? getPartnerWebPayoutSummary() : Promise.resolve({ available: false as const, visibility: "restricted" as const }),
  ]);

  const cards = [
    { title: "Premium this month", value: money(performance.premium_this_month), icon: BriefcaseBusiness },
    { title: "Policies this month", value: integer(performance.policies_this_month), icon: FileText },
    { title: "Active policies", value: integer(policies.in_force_policies), icon: ShieldCheck },
    { title: "Customers", value: integer(performance.total_customers), icon: UsersRound },
    { title: "Open claims", value: integer(claims.active_claims), icon: Truck },
    { title: "Renewals due (30 days)", value: integer(policies.expiring_30_days), icon: BarChart3 },
  ];

  return (
    <PartnerReportsShell active="Overview" scope={reportScope}>
<section aria-label="Business metrics" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E2E9F3] bg-white md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ title, value, icon: Icon }) => (
          <div key={title} className="min-w-0 border-b border-r border-[#E9EEF6] p-4">
            <div className="flex items-center gap-2 text-[#51739F]"><Icon className="h-4 w-4" aria-hidden="true" /><span className="text-[11px] font-semibold">{title}</span></div>
            <p className="mt-3 break-words text-xl font-bold text-[#132F60]">{value}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
          <h2 className="text-base font-bold">Policy & renewal summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-[#70809A]">Total policies</dt><dd className="mt-1 text-xl font-bold">{integer(policies.total_policies)}</dd></div>
            <div><dt className="text-[#70809A]">Motor policies</dt><dd className="mt-1 text-xl font-bold">{integer(policies.motor_policies)}</dd></div>
            <div><dt className="text-[#70809A]">Due in 7 days</dt><dd className="mt-1 text-xl font-bold">{integer(renewals.due_0_7_count)}</dd></div>
            <div><dt className="text-[#70809A]">Overdue renewals</dt><dd className="mt-1 text-xl font-bold">{integer(renewals.overdue_count)}</dd></div>
          </dl>
          <Link href="/partner/policies" className="mt-5 inline-block text-sm font-semibold text-[#345DD6]">View policies →</Link>
        </section>
        <section className="rounded-2xl border border-[#E2E9F3] bg-white p-3 shadow-sm">
          <h2 className="text-base font-bold">Claims & commercials</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-[#70809A]">Total claims</dt><dd className="mt-1 text-xl font-bold">{integer(claims.total_claims)}</dd></div>
            <div><dt className="text-[#70809A]">Completed claims</dt><dd className="mt-1 text-xl font-bold">{integer(claims.completed_claims)}</dd></div>
            {payout.available && canShowPayout ? <>
              <div><dt className="text-[#70809A]">Recorded payout</dt><dd className="mt-1 text-xl font-bold">{money(payout.recorded_amount)}</dd></div>
              <div><dt className="text-[#70809A]">Pending payout</dt><dd className="mt-1 text-xl font-bold">{money(payout.pending_amount)}</dd></div>
            </> : <div className="col-span-2 rounded-lg bg-[#F4F7FC] p-3 text-xs text-[#64758F]">Commercial figures are available only to authorized accounts.</div>}
          </dl>
          <Link href="/partner/claims" className="mt-5 inline-block text-sm font-semibold text-[#345DD6]">View claims →</Link>
        </section>
      </div>

    </PartnerReportsShell>
  );
}
