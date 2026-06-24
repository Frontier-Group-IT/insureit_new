import Link from "next/link";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { isOpenClaimStatus, operationsQueueDefinitions, operationsQueueForStatus, stageAgeLabel, terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

type ClaimRow = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  current_status: ClaimStatus;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  accident_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string } | null;
  insurance_companies: { name: string } | null;
};

type QueueTone = "blue" | "cyan" | "amber" | "green" | "violet" | "red";

const queueCardCopy: Record<string, { body: string; icon: string; tone: QueueTone }> = {
  "vehicle-intimation": { body: "New accidents and initial document intake.", icon: "VI", tone: "blue" },
  "spot-deputation": { body: "Spot survey, surveyor and inspection action.", icon: "SP", tone: "amber" },
  "claim-intimation": { body: "Final documents and insurer intimation.", icon: "CI", tone: "cyan" },
  "work-approval": { body: "Estimate and repair approval follow-up.", icon: "WA", tone: "green" },
  reinspection: { body: "Final survey and re-inspection tracking.", icon: "RI", tone: "violet" },
  "delivery-order": { body: "Repair, RA, DO and final bill stage.", icon: "DO", tone: "amber" },
  payment: { body: "Payment advice and settlement follow-up.", icon: "PY", tone: "red" },
  "closed-claims": { body: "Settled and completed claim files.", icon: "CL", tone: "green" }
};

const riskStatuses: ClaimStatus[] = ["Initial Documents Verification Pending", "Final Documents Verification Pending", "Work Approval Status", "Payment Stage"];

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, insurer_claim_no, current_status, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, accident_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), insurance_companies(name)")
    .order("updated_at", { ascending: false })
    .returns<ClaimRow[]>();

  const claims = data ?? [];
  const openClaims = claims.filter((claim) => isOpenClaimStatus(claim.current_status));
  const queueCounts = operationsQueueDefinitions.map((queue) => ({
    ...queue,
    count: claims.filter((claim) => queue.statuses.includes(claim.current_status)).length
  }));
  const totals = {
    all: claims.length,
    open: openClaims.length,
    closed: claims.filter((claim) => terminalClaimStatuses.includes(claim.current_status)).length,
    attention: claims.filter((claim) => riskStatuses.includes(claim.current_status)).length,
    payment: claims.filter((claim) => ["Payment Stage", "Claim Completion In Progress", "Claim Complete", "Settlement Under Process"].includes(claim.current_status)).length
  };
  const priorityClaims = openClaims.slice(0, 7);
  const missingDocs = claims.filter((claim) => ["Initial Documents Pending", "Documents Pending", "Final Documents Awaited"].includes(claim.current_status)).length;
  const documentReview = claims.filter((claim) => ["Initial Documents Verification Pending", "Initial Documents Submitted", "Documents Submitted", "Final Documents Verification Pending", "Final Documents Submitted"].includes(claim.current_status)).length;

  return (
    <ClaimManagerShell title="Claims Operations Dashboard" activeNav="dashboard">
      <div className="space-y-4 pb-8">
        <section className="rounded-[22px] border border-[#DCE7F5] bg-gradient-to-br from-[#EAF3FF] via-white to-[#F8FBFF] px-5 py-4 shadow-[0_10px_28px_rgba(7,29,73,0.06)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#174EA6]">Claim manager cockpit</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-[#071D49]">Today&apos;s claim desk</h1>
              <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#5C6878]">Stage-wise workload, priority claims and action alerts for commercial vehicle claim operations.</p>
            </div>
            <div className="grid min-w-[480px] grid-cols-4 overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-sm max-lg:min-w-0 max-lg:w-full">
              <HeroMetric label="Total" value={totals.all} />
              <HeroMetric label="Open" value={totals.open} />
              <HeroMetric label="Attention" value={totals.attention} />
              <HeroMetric label="Closed" value={totals.closed} />
            </div>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error.message}</div> : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_315px]">
          <div className="space-y-4">
            <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              {queueCounts.map((queue) => {
                const copy = queueCardCopy[queue.key];
                return (
                  <OperationalQueueCard
                    key={queue.key}
                    title={queue.label}
                    value={queue.count}
                    href={`/claims?queue=${queue.key}`}
                    icon={copy.icon}
                    tone={copy.tone}
                    body={copy.body}
                  />
                );
              })}
            </section>

            <section className="rounded-[20px] border border-[#DCE7F5] bg-white p-4 shadow-[0_8px_24px_rgba(7,29,73,0.05)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-[#071D49]">Priority claim queue</h2>
                  <p className="mt-0.5 text-[12px] text-[#68758A]">Latest open claims with their current operational stage.</p>
                </div>
                <Link className="rounded-xl bg-[#174EA6] px-3.5 py-2 text-[12px] font-medium text-white shadow-sm transition hover:bg-[#071D49]" href="/claims">Open list</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-[12px]">
                  <thead>
                    <tr className="bg-[#071D49] text-white">
                      <th className="rounded-l-xl px-3 py-2 font-medium">Control No.</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Vehicle</th>
                      <th className="px-3 py-2 font-medium">Insurer</th>
                      <th className="px-3 py-2 font-medium">Process</th>
                      <th className="px-3 py-2 font-medium">Age</th>
                      <th className="rounded-r-xl px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityClaims.length ? priorityClaims.map((claim) => {
                      const queue = operationsQueueForStatus(claim.current_status);
                      return (
                        <tr key={claim.id} className="border-b border-[#EEF3FA] hover:bg-[#F7FBFF]">
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5 font-mono text-[11px] font-medium text-[#071D49]">{claim.claim_no}</td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5">
                            <span className="block font-medium text-[#071D49]">{claim.customers?.company_name ?? claim.customers?.contact_name ?? "-"}</span>
                            <span className="text-[11px] text-[#68758A]">{claim.customers?.phone ?? "-"}</span>
                          </td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5">
                            <span className="block font-mono text-[11px] font-medium text-[#071D49]">{claim.vehicles?.vehicle_no ?? "-"}</span>
                            <span className="text-[11px] text-[#68758A]">{[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ") || "-"}</span>
                          </td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5 text-[#344256]">{claim.insurance_companies?.name ?? "-"}</td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5"><ProcessPill label={queue?.label ?? claim.current_status} /></td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5 text-[#68758A]">{stageAgeLabel(claim.updated_at ?? claim.created_at)}</td>
                          <td className="border-b border-[#EEF3FA] px-3 py-2.5"><Link className="rounded-lg bg-[#174EA6] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#071D49]" href={`/claims/${claim.id}`}>Proceed</Link></td>
                        </tr>
                      );
                    }) : <tr><td className="px-3 py-8 text-center text-[#68758A]" colSpan={7}>No active claims found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <ManagerAlertCard title="SLA watch" value={totals.attention} body="Verification, work approval and payment-stage claims needing close monitoring." tone="amber" />
            <ManagerAlertCard title="Missing documents" value={missingDocs} body="Customer upload or corrected document action is pending." tone="red" />
            <ManagerAlertCard title="Document review" value={documentReview} body="Uploaded documents waiting for claim desk verification." tone="blue" />
            <ManagerAlertCard title="Payment follow-up" value={totals.payment} body="Claims in payment, settlement or closure recording stages." tone="green" />
            <section className="rounded-[20px] border border-[#DCE7F5] bg-white p-4 shadow-sm">
              <h2 className="text-[15px] font-semibold text-[#071D49]">Workflow guide</h2>
              <div className="mt-3 space-y-2">
                {operationsQueueDefinitions.slice(0, 5).map((queue, index) => <WorkflowLine key={queue.key} index={index + 1} label={queue.label} />)}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </ClaimManagerShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-[#EDF2F8] px-4 py-3 last:border-r-0">
      <p className="text-[24px] font-semibold leading-none text-[#071D49]">{value}</p>
      <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#68758A]">{label}</p>
    </div>
  );
}

function OperationalQueueCard({ title, value, body, href, icon, tone }: { title: string; value: number; body: string; href: string; icon: string; tone: QueueTone }) {
  const tones = {
    blue: "border-[#CFE1FA] bg-[#F2F7FF] text-[#174EA6]",
    cyan: "border-[#CDEFF6] bg-[#F0FBFE] text-[#007C9B]",
    amber: "border-[#F5D8A8] bg-[#FFF8EA] text-[#B36A00]",
    green: "border-[#CFEBDC] bg-[#F2FBF6] text-[#0C7A51]",
    violet: "border-[#DED7FA] bg-[#F7F4FF] text-[#5B45C7]",
    red: "border-[#F6D0D3] bg-[#FFF4F5] text-[#C7363D]"
  }[tone];

  return (
    <Link href={href} className={`group rounded-[18px] border p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(7,29,73,0.08)] ${tones}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[12px] font-semibold shadow-sm ring-1 ring-black/5">{icon}</div>
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-[13px] font-semibold leading-[16px] text-[#071D49]">{title}</h2>
          <p className="mt-1 text-[26px] font-semibold leading-none">{value}</p>
        </div>
      </div>
      <p className="mt-2 min-h-8 text-[11.5px] leading-4 text-[#5C6878]">{body}</p>
      <p className="mt-2 text-[11.5px] font-semibold text-[#071D49] group-hover:text-[#174EA6]">Open queue</p>
    </Link>
  );
}

function ProcessPill({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[10.5px] font-medium text-[#174EA6]"><span className="h-1.5 w-1.5 rounded-full bg-[#174EA6]" />{label}</span>;
}

function ManagerAlertCard({ title, value, body, tone }: { title: string; value: number; body: string; tone: "amber" | "red" | "blue" | "green" }) {
  const tones = {
    amber: "border-[#F5D8A8] bg-[#FFF8EA] text-[#B36A00]",
    red: "border-[#F6D0D3] bg-[#FFF4F5] text-[#C7363D]",
    blue: "border-[#CFE1FA] bg-[#F2F7FF] text-[#174EA6]",
    green: "border-[#CFEBDC] bg-[#F2FBF6] text-[#0C7A51]"
  }[tone];
  return (
    <section className={`rounded-[18px] border p-3.5 shadow-sm ${tones}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-sm font-semibold shadow-sm">!</div>
        <div>
          <p className="text-[12px] font-semibold text-[#071D49]">{title}</p>
          <p className="mt-0.5 text-[24px] font-semibold leading-none">{value}</p>
          <p className="mt-2 text-[11.5px] leading-4 text-[#5C6878]">{body}</p>
        </div>
      </div>
    </section>
  );
}

function WorkflowLine({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#F7FAFE] p-2">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EAF3FF] text-[11px] font-semibold text-[#174EA6]">{index}</span>
      <p className="text-[12px] font-medium text-[#344256]">{label}</p>
    </div>
  );
}
