import { notFound } from "next/navigation";
import { claimStatuses } from "@/components/data";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type ClaimDetail = {
  id: string;
  claim_no: string;
  current_status: string;
  accident_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  policies: { policy_no: string } | null;
  insurance_companies: { name: string } | null;
  garages: { name: string } | null;
  surveyors: { name: string } | null;
};

type ClaimDocument = { id: string; document_type: string; file_name: string; verification_status: string };

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: claim, error }, { data: documents }] = await Promise.all([
    supabase
      .from("claims")
      .select("id, claim_no, current_status, accident_at, accident_location, accident_description, estimated_loss, approved_amount, settlement_amount, customers(company_name, contact_name), vehicles(vehicle_no), policies(policy_no), insurance_companies(name), garages(name), surveyors(name)")
      .eq("id", id)
      .maybeSingle<ClaimDetail>(),
    supabase.from("claim_documents").select("id, document_type, file_name, verification_status").eq("claim_id", id).returns<ClaimDocument[]>()
  ]);

  if (error || !claim) {
    notFound();
  }

  return (
    <AppShell title={`Claim ${claim.claim_no}`}>
      <PageHeader title={`Claim ${claim.claim_no}`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">Accident and policy details</h3>
              <p className="mt-1 text-sm text-slate-500">Commercial vehicle assistance file with insurer and garage coordination.</p>
            </div>
            <StatusBadge status={claim.current_status} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
            <Info label="Customer" value={claim.customers?.company_name ?? claim.customers?.contact_name ?? "—"} />
            <Info label="Vehicle" value={claim.vehicles?.vehicle_no ?? "—"} />
            <Info label="Policy" value={claim.policies?.policy_no ?? "—"} />
            <Info label="Insurer" value={claim.insurance_companies?.name ?? "—"} />
            <Info label="Surveyor" value={claim.surveyors?.name ?? "—"} />
            <Info label="Garage" value={claim.garages?.name ?? "—"} />
            <Info label="Accident date" value={claim.accident_at ? new Date(claim.accident_at).toLocaleString() : "—"} />
            <Info label="Accident location" value={claim.accident_location ?? "—"} />
          </dl>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{claim.accident_description ?? "No accident description recorded yet."}</div>
        </Card>
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Status update</h3>
            <select className="mt-4 w-full" defaultValue={claim.current_status}>{claimStatuses.map((status) => <option key={status}>{status}</option>)}</select>
            <button className="mt-4 w-full rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white" type="button">Record status</button>
          </Card>
          <Card>
            <h3 className="text-lg font-semibold text-navy-900">Document checklist</h3>
            <div className="mt-4 space-y-3">{(documents ?? []).length === 0 ? <EmptyState title="No documents uploaded" /> : documents?.map((document) => <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm" key={document.id}><div className="flex items-center justify-between gap-3"><span>{document.document_type}</span><StatusBadge status={document.verification_status} /></div><p className="mt-1 text-xs text-slate-500">{document.file_name}</p></div>)}</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-navy-900">{value}</dd></div>;
}
