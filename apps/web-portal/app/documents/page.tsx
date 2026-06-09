import { AppShell, Card, PageHeader } from "@/components/shell";

const docs = ["Driving license", "RC book", "Policy PDF", "FIR / police memo", "Repair estimate"];

export default function DocumentsPage() {
  return <AppShell><PageHeader title="Document verification" description="Review private claim documents uploaded to the protected Supabase storage bucket." /><Card><div className="divide-y divide-slate-100">{docs.map((doc) => <div className="flex flex-wrap items-center justify-between gap-3 py-4" key={doc}><div><p className="font-semibold text-navy-900">{doc}</p><p className="text-sm text-slate-500">CB-2026-0001 · Pending verification</p></div><div className="flex gap-2"><button className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white" type="button">Verify</button><button className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" type="button">Reject</button></div></div>)}</div></Card></AppShell>;
}
