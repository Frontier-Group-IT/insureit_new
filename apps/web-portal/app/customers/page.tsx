import Link from "next/link";
import { sampleCustomers } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

export default function CustomersPage() {
  return (
    <AppShell>
      <PageHeader title="Customers" description="Onboard and manage fleet owners, operators, and commercial vehicle customers." action={<Link className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm" href="/customers/new">Add customer</Link>} />
      <SearchFilterBar searchPlaceholder="Search customers by name, code, contact, city, or phone" filterLabel="Customer status" />
      <Card>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Vehicles</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-100 bg-white">{sampleCustomers.map((customer, index) => <tr className="hover:bg-slate-50" key={customer.code}><td className="px-4 py-4"><p className="font-semibold text-navy-900">{customer.name}</p><p className="text-xs text-slate-500">{customer.code}</p></td><td className="px-4 py-4">{customer.contact}</td><td className="px-4 py-4">{customer.phone}</td><td className="px-4 py-4">{customer.city}</td><td className="px-4 py-4 font-semibold">{customer.vehicles}</td><td className="px-4 py-4"><StatusBadge status={customer.status} /></td><td className="px-4 py-4 text-right"><Link className="font-semibold text-navy-700" href={`/customers/${index + 1}/edit`}>Edit</Link></td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="mt-4"><EmptyState className="hidden" title="No customers found" description="Try a different search term or clear the customer status filter." /></div>
      </Card>
    </AppShell>
  );
}
