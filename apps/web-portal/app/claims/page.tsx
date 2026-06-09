import Link from "next/link";
import { sampleClaims } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";

export default function ClaimsPage() {
  return (
    <AppShell>
      <PageHeader title="Claims" description="Monitor every accident assistance case from first report through claim settlement or closure." />
      <Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2">Claim no</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Estimate</th></tr></thead><tbody className="divide-y divide-slate-100">{sampleClaims.map((claim, index) => <tr key={claim.claimNo}><td className="py-3"><Link href={`/claims/${index + 1}`} className="font-semibold text-navy-700">{claim.claimNo}</Link></td><td>{claim.customer}</td><td>{claim.vehicle}</td><td><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">{claim.status}</span></td><td>{claim.amount}</td></tr>)}</tbody></table></div></Card>
    </AppShell>
  );
}
