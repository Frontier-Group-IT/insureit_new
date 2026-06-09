import Link from "next/link";
import { AppShell, Card, PageHeader } from "@/components/shell";

const customers = ["Metro Freight Co.", "GreenLine Logistics", "North Star Carriers", "Shakti Roadways"];

export default function CustomersPage() {
  return (
    <AppShell>
      <PageHeader title="Customers" description="Onboard and manage fleet owners, operators, and commercial vehicle customers." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white" href="/customers/new">Add customer</Link>} />
      <Card><div className="divide-y divide-slate-100">{customers.map((name, index) => <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={name}><div><p className="font-semibold text-navy-900">{name}</p><p className="text-sm text-slate-500">CB-CUST-{String(index + 1).padStart(4, "0")} · Active</p></div><Link className="text-sm font-semibold text-navy-700" href={`/customers/${index + 1}/edit`}>Edit</Link></div>)}</div></Card>
    </AppShell>
  );
}
