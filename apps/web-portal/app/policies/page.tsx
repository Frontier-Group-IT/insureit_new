import Link from "next/link";
import { samplePolicies } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

export default function PoliciesPage() {
  return (
    <AppShell>
      <PageHeader title="Policies" description="Track insurer, coverage period, IDV, premium, and vehicle-policy mapping." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/policies/new">Add policy</Link>} />
      <SearchFilterBar searchPlaceholder="Search policies by policy no, insurer, customer, or vehicle" filterLabel="Policy status" />
      <Card>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Policy no</th><th className="px-4 py-3">Insurer</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Validity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{samplePolicies.map((policy, index) => <tr className="hover:bg-slate-50" key={policy.policyNo}><td className="px-4 py-4 font-semibold text-navy-700">{policy.policyNo}</td><td className="px-4 py-4">{policy.insurer}</td><td className="px-4 py-4">{policy.customer}</td><td className="px-4 py-4 font-mono text-xs">{policy.vehicle}</td><td className="px-4 py-4">{policy.validity}</td><td className="px-4 py-4"><StatusBadge status={policy.status} /></td><td className="px-4 py-4 text-right"><Link href={`/policies/${index + 1}/edit`} className="font-semibold text-navy-700">Edit</Link></td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="mt-4"><EmptyState className="hidden" title="No policies found" description="Try another policy number, insurer name, or vehicle registration search." /></div>
      </Card>
    </AppShell>
  );
}
