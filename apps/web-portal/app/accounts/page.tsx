import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, ClipboardList, FileCheck2, Landmark, ReceiptIndianRupee, ReceiptText, Scale, WalletCards } from "lucide-react";
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
              <div className="flex items-center gap-2 text-[#0f766e]"><Landmark className="h-5 w-5" /><span className="text-[9px] font-black uppercase tracking-[.14em]">Accounts workspace</span></div>
              <h1 className="mt-2 text-[21px] font-semibold text-[#17365D]">Accounts Operations</h1>
              <p className="mt-1 max-w-4xl text-[10px] leading-5 text-[#667085]">Operational brokerage accounts workspace from commercial expectation through reconciliation, billing, insurer receivables and settlement. Reports remains the read-only analytical layer.</p>
            </div>
            <Link href="/reports/finance" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e1ec] bg-white px-4 py-2 text-[9px] font-bold text-[#17365D]">Accounts reports <BarChart3 className="h-3.5 w-3.5" /></Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WorkspaceCard href="/policies/commercial-review" icon={Scale} title="Commercial Control" description="Review and maintain projected insurer brokerage and agreed partner commercials." />
          <WorkspaceCard href="/reconciliation" icon={ClipboardList} title="Insurer Reconciliation" description="Create and work insurer reconciliation cycles using manual entry, Excel paste or the InsureIT template." />
          <WorkspaceCard href="/reconciliation/history" icon={FileCheck2} title="Reconciliation History" description="Review submitted cycles, exceptions, status changes and the reconciliation audit trail." />
          <WorkspaceCard href="/accounts/billing" icon={ReceiptText} title="Brokerage Billing" description="Create invoice drafts from finalized reconciled transactions and raise them into the insurer receivable ledger." />
          <WorkspaceCard href="/accounts/receivables" icon={WalletCards} title="Insurer Receivables" description="Review insurer debtor balances and accounting movements for raised invoices and settlements." />
          <WorkspaceCard href="/accounts/settlements" icon={ReceiptIndianRupee} title="Receipts & TDS" description="Allocate bank receipts and TDS credits to raised invoices while keeping the insurer receivable ledger auditable." />
        </section>

        <section className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-5 py-4">
          <h2 className="text-[12px] font-semibold text-[#17365D]">Accounts module rollout</h2>
          <p className="mt-1 text-[9.5px] leading-5 text-[#667085]">Implemented: Commercial Control → Reconciliation → Brokerage Billing → Insurer Receivables → Receipts & TDS. Next: Partner Payables → Period Close → Accounts Reports.</p>
        </section>
      </div>
    </AppShell>
  );
}

function WorkspaceCard({ href, icon: Icon, title, description }: { href: string; icon: typeof Landmark; title: string; description: string }) {
  return <Link href={href} className="group rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fb7c7] hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f5f3] text-[#0f766e]"><Icon className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-[#98a2b3] transition group-hover:translate-x-0.5" /></div><h2 className="mt-4 text-[13px] font-semibold text-[#17365D]">{title}</h2><p className="mt-1 text-[9.5px] leading-5 text-[#667085]">{description}</p></Link>;
}
