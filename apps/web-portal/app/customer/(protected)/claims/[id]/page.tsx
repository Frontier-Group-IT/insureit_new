import Link from "next/link";
import { ArrowLeft, CarFront, Check, Circle, Clock3, FileText, ShieldCheck } from "lucide-react";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  buildExternalClaimProjection,
  customerClaimStatusTone,
  formatCustomerDateTime,
  isExternalCustomerClaim,
  loadCustomerClaimDetail,
} from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const query: { account?: string } = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const detail = await loadCustomerClaimDetail(account.id, id);
  const { claim, documents, tasks, milestones, internal_projection } = detail;
  const external = isExternalCustomerClaim(claim);
  const externalProjection = external ? buildExternalClaimProjection(milestones) : null;
  const completed = external ? externalProjection?.completed : internal_projection?.isTerminal;
  const actionRequired = external
    ? claim.claim_service_mode === "self_managed" && !externalProjection?.completed &&
      (claim.current_status.includes("Document") || claim.current_status.includes("Awaited") || claim.current_status.includes("Pending"))
    : Boolean(internal_projection?.customerActionRequired);

  const stageLabel = externalProjection?.current_stage.label ?? internal_projection?.stageLabel ?? claim.current_status;
  const progress = externalProjection?.progress ?? internal_projection?.progress ?? 0;
  const journey = external
    ? externalProjection?.stages.map((stage) => ({ key: stage.key, label: stage.label, complete: stage.completed, current: stage.key === externalProjection.current_stage.key }))
    : INTERNAL_JOURNEY_STAGES.map((stage, index) => ({
        key: stage.key,
        label: stage.label,
        complete: index < (internal_projection?.completedStageCount ?? 0),
        current: index === (internal_projection?.stageIndex ?? 0),
      }));

  return (
    <div className="space-y-5">
      <Link href={{ pathname: "/customer/claims", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to claims
      </Link>

      <CustomerPageHeading
        eyebrow={external ? "Self-tracked / external claim" : "Claim journey"}
        title={claim.vehicle_no || claim.claim_no}
        description={`${claim.claim_no} · ${claim.insurer_name || claim.policy_no || "Insurance claim"}`}
        action={<StatusPill tone={completed ? "active" : actionRequired ? "due" : customerClaimStatusTone(claim.current_status)}>{completed ? "Completed" : actionRequired ? "Action required" : claim.current_status}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/claims" />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8794A7]">Current stage</p>
              <h2 className="mt-1 text-[17px] font-black text-[#10213D]">{stageLabel}</h2>
              <p className="mt-1 max-w-xl text-[10.5px] font-semibold text-[#74839A]">
                {external ? "This journey is tracked from the Customer-added policy milestones." : internal_projection?.customerMessage}
              </p>
            </div>
            <div className="min-w-[120px]">
              <div className="flex items-center justify-between text-[9px] font-black text-[#718096]"><span>Progress</span><span>{progress}%</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E9EEF5]"><div className="h-full rounded-full bg-[#174EA6]" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} /></div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {journey?.map((stage) => (
              <div key={stage.key} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${stage.current ? "border-[#AFC7EA] bg-[#F3F7FD]" : "border-[#E5EAF1] bg-[#FBFCFE]"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${stage.complete ? "bg-[#EAF7F0] text-[#0B7A54]" : stage.current ? "bg-[#E7F0FF] text-[#174EA6]" : "bg-[#F0F3F7] text-[#8B97A8]"}`}>
                  {stage.complete ? <Check className="h-4 w-4" /> : stage.current ? <Clock3 className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1"><p className="text-[11.5px] font-black text-[#10213D]">{stage.label}</p><p className="mt-0.5 text-[9.5px] font-semibold text-[#8290A3]">{stage.complete ? "Completed" : stage.current ? "Current stage" : "Upcoming"}</p></div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
            <div className="flex items-center gap-2"><CarFront className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Claim information</h2></div>
            <dl className="mt-4 space-y-3 text-[10.5px]">
              {[
                ["Vehicle", claim.vehicle_no || "—"],
                ["Make / Model", [claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(" · ") || "—"],
                ["Policy", claim.policy_no || "—"],
                ["Insurer", claim.insurer_name || "—"],
                ["Control no.", claim.claim_no],
                ["Insurer claim no.", claim.insurer_claim_no || "Awaiting insurer"],
                ["Incident", formatCustomerDateTime(claim.accident_at)],
                ["Location", claim.accident_location || "—"],
              ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 border-b border-[#EEF2F6] pb-2 last:border-0 last:pb-0"><dt className="font-bold text-[#8895A8]">{label}</dt><dd className="max-w-[60%] text-right font-black text-[#35445B]">{value}</dd></div>)}
            </dl>
          </section>

          <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Documents & actions</h2></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-bold text-[#8794A7]">Documents</p><p className="mt-1 text-[18px] font-black text-[#10213D]">{documents.length}</p></div>
              <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-bold text-[#8794A7]">Open tasks</p><p className="mt-1 text-[18px] font-black text-[#10213D]">{tasks.length}</p></div>
            </div>
            {claim.assistance_status === "requested" ? <p className="mt-3 rounded-xl bg-[#FFF7E8] px-3 py-2 text-[10px] font-bold text-[#8C6419]">Assistance has been requested and is awaiting response.</p> : null}
            {actionRequired ? <p className="mt-3 rounded-xl bg-[#FFF0F0] px-3 py-2 text-[10px] font-bold text-[#A13B3B]">Customer action is required in the mobile app for this stage. Web writes remain intentionally disabled in Phase 2.</p> : null}
          </section>

          <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Service mode</h2></div>
            <p className="mt-3 text-[11px] font-black text-[#35445B]">{external ? "Self tracked / Customer-added policy" : "INSUREIT managed"}</p>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-[#7A8799]">{external ? "The journey is shown from customer-tracked milestones. INSUREIT processing is not implied unless assistance is accepted." : "The current journey state is projected from the shared internal claim workflow."}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}