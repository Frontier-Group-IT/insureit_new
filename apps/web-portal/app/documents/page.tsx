import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

const docs = [
  { name: "Driving license", claim: "CB-2026-0001", owner: "Metro Freight Co.", status: "Documents Submitted" },
  { name: "RC book", claim: "CB-2026-0001", owner: "Metro Freight Co.", status: "Documents Submitted" },
  { name: "Policy PDF", claim: "CB-2026-0002", owner: "GreenLine Logistics", status: "Documents Pending" },
  { name: "FIR / police memo", claim: "CB-2026-0003", owner: "North Star Carriers", status: "Documents Submitted" },
  { name: "Repair estimate", claim: "CB-2026-0004", owner: "Shakti Roadways", status: "Approval Pending" }
];

export default function DocumentsPage() {
  return (
    <AppShell>
      <PageHeader title="Document verification" description="Review private claim documents uploaded to the protected Supabase storage bucket." />
      <SearchFilterBar searchPlaceholder="Search documents by claim no, customer, document type, or status" filterLabel="Document status" />
      <Card>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{docs.map((doc) => <div className="flex flex-col gap-4 bg-white p-4 hover:bg-slate-50 md:flex-row md:items-center md:justify-between" key={`${doc.claim}-${doc.name}`}><div><p className="font-semibold text-navy-900">{doc.name}</p><p className="text-sm text-slate-500">{doc.claim} · {doc.owner}</p></div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={doc.status} /><button className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white" type="button">Verify</button><button className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" type="button">Reject</button></div></div>)}</div>
        <div className="mt-4"><EmptyState className="hidden" title="No documents awaiting review" description="When private files are uploaded to a claim, verification tasks will appear here." /></div>
      </Card>
    </AppShell>
  );
}
