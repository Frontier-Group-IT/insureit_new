import { advanceClaimWorkflow, requestFinalDocuments } from "@/app/actions";
import { StatusBadge } from "@/components/ui";
import { stageAgeLabel, type ClaimStatus } from "@/lib/claim-workflow";

export type SummaryClaim = {
  claim_no: string;
  current_status: ClaimStatus;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; vehicle_type: string | null; make: string | null; model: string | null } | null;
  policies: { policy_no: string; policy_type: string | null } | null;
  insurance_companies: { name: string } | null;
};

export function ClaimSummaryStrip({ claim, title }: { claim: SummaryClaim; title: string }) {
  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-[#d9e6f7] bg-white shadow-[0_18px_45px_rgba(7,29,73,0.08)]">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-[#EAF3FF] via-white to-[#F4F8FF] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#174EA6]">Claim Manager Workflow</p>
          <h2 className="mt-1 text-2xl font-black text-[#071D49]">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{claim.claim_no} • {stageAgeLabel(claim.updated_at ?? claim.created_at)}</p>
        </div>
        <StatusBadge status={claim.current_status} />
      </div>
      <div className="grid gap-0 border-t border-[#d9e6f7] lg:grid-cols-4">
        <SummaryCell icon="👤" label="Customer Name" value={claim.customers?.company_name ?? claim.customers?.contact_name} subValue={claim.customers?.phone} />
        <SummaryCell icon="🚙" label="Vehicle Number" value={claim.vehicles?.vehicle_no} subValue={claim.vehicles?.vehicle_type} />
        <SummaryCell icon="🚘" label="Make / Model" value={[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ")} subValue={claim.policies?.policy_type} />
        <SummaryCell icon="🛡️" label="Insurance Company" value={claim.insurance_companies?.name ?? "-"} subValue={claim.policies?.policy_no} />
      </div>
    </section>
  );
}

export function ProceedPanel({ claimId, currentStatus, nextStatus }: { claimId: string; currentStatus: ClaimStatus; nextStatus?: ClaimStatus }) {
  if (currentStatus === "Vehicle Inspected") {
    return <form action={requestFinalDocuments.bind(null, claimId)}><input type="hidden" name="notes" value="Final documents requested from customer." /><SubmitButton /></form>;
  }
  if (nextStatus) {
    return <form action={advanceClaimWorkflow.bind(null, claimId)}><input type="hidden" name="next_status" value={nextStatus} /><input type="hidden" name="notes" value={`Claim moved to ${nextStatus}.`} /><SubmitButton /></form>;
  }
  return <button className="w-full rounded-2xl bg-slate-200 px-6 py-4 text-sm font-black text-slate-500" type="button" disabled>No proceed action</button>;
}

function SummaryCell({ icon, label, value, subValue }: { icon: string; label: string; value?: string | null; subValue?: string | null }) {
  return <div className="flex items-center gap-4 border-b border-[#d9e6f7] px-5 py-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EAF3FF] text-2xl">{icon}</div><div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-[#174EA6]">{label}</p><p className="mt-1 truncate text-base font-black text-[#071D49]">{value || "-"}</p>{subValue ? <p className="mt-0.5 truncate text-sm font-bold text-slate-600">{subValue}</p> : null}</div></div>;
}

function SubmitButton() {
  return <button className="w-full rounded-2xl bg-[#071D49] px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-950/20" type="submit">Submit & Proceed →</button>;
}
