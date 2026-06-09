import Link from "next/link";
import { AppShell, Card, PageHeader } from "@/components/shell";

const policies = ["POL-CV-10001", "POL-CV-10002", "POL-CV-10003"];

export default function PoliciesPage() {
  return <AppShell><PageHeader title="Policies" description="Track insurer, coverage period, IDV, premium, and vehicle-policy mapping." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white" href="/policies/new">Add policy</Link>} /><Card><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="py-2">Policy no</th><th>Insurer</th><th>Vehicle</th><th>Validity</th><th></th></tr></thead><tbody className="divide-y divide-slate-100">{policies.map((policy, index) => <tr key={policy}><td className="py-3 font-semibold text-navy-700">{policy}</td><td>Sample Insurance Ltd.</td><td>MH12AB1234</td><td>2026-04-01 to 2027-03-31</td><td><Link href={`/policies/${index + 1}/edit`} className="font-semibold text-navy-700">Edit</Link></td></tr>)}</tbody></table></div></Card></AppShell>;
}
