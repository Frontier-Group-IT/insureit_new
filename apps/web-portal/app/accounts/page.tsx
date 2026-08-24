import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CalendarCheck2, ClipboardList, FileCheck2, HandCoins, Landmark, ReceiptIndianRupee, ReceiptText, Scale, WalletCards } from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";

export default async function AccountsPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");

  return (
    <AppShell title="Accounts">
      <div className="mx-auto max-w-[1560px] space-y-2.5 pb-6">
        <section className="flex items-center justify-between rounded-2xl border border-[#dbe3ee] bg-white px-4 py-2.5 shadow-sm">
          <h1 className="text-[17px] font-semibold text-[#17365D]">Accounts</h1>
          <Link href="/reports/accounts" title="Accounts reports" aria-label="Accounts reports" className="grid h-8 w-8 place-items-center rounded-lg border border-[#d8e1ec] bg-white text-[#17365D] hover:bg-[#f8fafc]"><BarChart3 className="h-4 w-4" /></Link>
        </section>

        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <WorkspaceCard href="/policies/commercial-review" icon={Scale} title="Pay-In / Payout" />
          <WorkspaceCard href="/reconciliation" icon={ClipboardList} title="Insurer Reconciliation" />
          <WorkspaceCard href="/reconciliation/history" icon={FileCheck2} title="Reconciliation History" />
          <WorkspaceCard href="/accounts/billing" icon={ReceiptText} title="Brokerage Billing" />
          <WorkspaceCard href="/accounts/receivables" icon={WalletCards} title="Insurer Receivables" />
          <WorkspaceCard href="/accounts/settlements" icon={ReceiptIndianRupee} title="Receipts & TDS" />
          <WorkspaceCard href="/accounts/partner-payables" icon={HandCoins} title="Partner Payables" />
          <WorkspaceCard href="/accounts/period-close" icon={CalendarCheck2} title="Period Close" />
          <WorkspaceCard href="/reports/accounts" icon={BarChart3} title="Accounts Reports" />
        </section>
      </div>
    </AppShell>
  );
}

function WorkspaceCard({ href, icon: Icon, title }: { href: string; icon: typeof Landmark; title: string }) {
  return <Link href={href} className="group rounded-2xl border border-[#dbe3ee] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fb7c7] hover:shadow-md"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e8f5f3] text-[#0f766e]"><Icon className="h-4.5 w-4.5" /></span><h2 className="min-w-0 flex-1 text-[11px] font-semibold text-[#17365D]">{title}</h2><ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#98a2b3] transition group-hover:translate-x-0.5" /></div></Link>;
}
