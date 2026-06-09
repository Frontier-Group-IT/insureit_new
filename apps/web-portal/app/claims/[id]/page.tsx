import { claimStatuses } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";

export default function ClaimDetailPage() {
  return (
    <AppShell>
      <PageHeader title="Claim CB-2026-0001" description="Detailed claim workspace for accident summary, documents, insurer coordination, surveyor activity, and settlement values." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-lg font-semibold text-navy-900">Accident and policy details</h3>
          <dl className="mt-4 grid gap-4 md:grid-cols-2 text-sm"><div><dt className="text-slate-500">Customer</dt><dd className="font-semibold">Metro Freight Co.</dd></div><div><dt className="text-slate-500">Vehicle</dt><dd className="font-semibold">MH12AB1234</dd></div><div><dt className="text-slate-500">Policy</dt><dd className="font-semibold">POL-CV-10001</dd></div><div><dt className="text-slate-500">Current status</dt><dd className="font-semibold text-green-700">Surveyor Appointed</dd></div></dl>
          <div className="mt-6 grid gap-2"><label>Internal notes</label><textarea rows={5} defaultValue="Surveyor appointment confirmed. Awaiting vehicle inspection report." /></div>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold text-navy-900">Status update</h3>
          <select className="mt-4 w-full" defaultValue="Surveyor Appointed">{claimStatuses.map((status) => <option key={status}>{status}</option>)}</select>
          <button className="mt-4 w-full rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white" type="button">Record status</button>
        </Card>
      </div>
    </AppShell>
  );
}
