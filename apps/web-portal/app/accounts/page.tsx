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
      <div className="mx-auto max-w-[1560px] space-y-4 pb-10">
        <section className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#0f766e]"><Landmark className="h-5 w-5" /><span className="text-[9px] font-black uppercase tracking-[.14em]">Accounts</span></div>
              <h1 className="mt-2 text-[21px] font-semibold text-[#17365D]">Accounts Operations</h1>
            </div>
            <Link href="/reports/accounts" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e1ec] bg-white px-4 py-2 text-[9px] font-bold text-[#17365D]">Accounts reports <BarChart3 className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WorkspaceCard href="/policies/commercial-review" icon={Scale} title="Commercial Control" />
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
  return <Link href={href} className="group rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fb7c7] hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f5f3] text-[#0f766e]"><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-[#98a2b3] transition group-hover:translate-x-0.5" /></div><h2 className="mt-4 text-[13px] font-semibold text-[#17365D]">{title}</h2></Link>;
}
