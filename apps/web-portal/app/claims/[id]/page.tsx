import { claimStatuses } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { PriorityBadge, StatusBadge } from "@/components/ui";

const documents = ["Driving license", "Registration certificate", "Policy copy", "Repair estimate"];

export default function ClaimDetailPage() {
  return (
    <AppShell>
      <PageHeader title="Claim CB-2026-0001" description="Detailed claim workspace for accident summary, documents, insurer coordination, surveyor activity, repair milestones, and settlement values." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">Accident and policy details</h3>
              <p className="mt-1 text-sm text-slate-500">Commercial vehicle assistance file with insurer and garage coordination.</p>
            </div>
            <div className="flex gap-2"><StatusBadge status="Surveyor Appointed" /><PriorityBadge priority="High" /></div>
          </div>
          <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2"><Info label="Customer" value="Metro Freight Co." /><Info label="Vehicle" value="MH12AB1234" /><Info label="Policy" value="POL-CV-10001" /><Info label="Insurer" value="Sample Insurance Ltd." /><Info label="Surveyor" value="R. Sharma" /><Info label="Garage" value="Prime Commercial Motors" /></dl>
          <div className="mt-6 grid gap-2"><label>Internal notes</label><textarea rows={5} defaultValue="Surveyor appointment confirmed. Awaiting vehicle inspection report and repair estimate validation." /></div>
        </Card>
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Status update</h3>
            <select className="mt-4 w-full" defaultValue="Surveyor Appointed">{claimStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            <button className="mt-4 w-full rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white" type="button">Record status</button>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Document checklist</h3>
            <div className="mt-4 space-y-3">{documents.map((document) => <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm" key={document}><span>{document}</span><StatusBadge status={document === "Repair estimate" ? "Documents Pending" : "Documents Submitted"} /></div>)}</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-navy-900">{value}</dd></div>;
}
