import Link from "next/link";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { isOpenClaimStatus, operationsQueueDefinitions, operationsQueueForStatus, stageAgeLabel, terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

type ClaimRow = {
  id: string;
  claim_no: string;
  current_status: ClaimStatus;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string; phone: string | null } | null;
  vehicles: { vehicle_no: string; make: string | null; model: string | null } | null;
  policies: { policy_no: string } | null;
  insurance_companies: { name: string } | null;
};

const queueCardCopy: Record<string, { body: string; icon: string; tone: QueueTone }> = {
  "vehicle-intimation": { body: "New accidents and initial customer document intake.", icon: "🚨", tone: "blue" },
  "spot-deputation": { body: "Spot survey, surveyor assignment and inspection action.", icon: "📍", tone: "amber" },
  "claim-intimation": { body: "Final documents and insurer intimation preparation.", icon: "📤", tone: "cyan" },
  "work-approval": { body: "Estimate approval and work permission follow-up.", icon: "✅", tone: "green" },
  reinspection: { body: "Final surveyor details and re-inspection status.", icon: "🔎", tone: "violet" },
  "delivery-order": { body: "Repair, RA intimation, DO and final bill tracking.", icon: "📄", tone: "amber" },
  payment: { body: "Payment advice, settlement and closure amounts.", icon: "💳", tone: "red" },
  "closed-claims": { body: "Completed and closed claim files.", icon: "🏁", tone: "green" }
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, current_status, estimated_loss, approved_amount, settlement_amount, updated_at, created_at, customers(company_name, contact_name, phone), vehicles(vehicle_no, make, model), policies(policy_no), insurance_companies(name)")
    .order("updated_at", { ascending: false })
    .returns<ClaimRow[]>();

  const claims = data ?? [];
  const queueCounts = operationsQueueDefinitions.map((queue) => ({
    ...queue,
    count: claims.filter((claim) => queue.statuses.includes(claim.current_status)).length
  }));
  const totals = {
    all: claims.length,
    open: claims.filter((claim) => isOpenClaimStatus(claim.current_status)).length,
    closed: claims.filter((claim) => terminalClaimStatuses.includes(claim.current_status)).length,
    highTouch: claims.filter((claim) => ["Initial Documents Verification Pending", "Final Documents Verification Pending", "Work Approval Status", "Payment Stage"].includes(claim.current_status)).length
  };
  const priorityClaims = claims.filter((claim) => isOpenClaimStatus(claim.current_status)).slice(0, 7);

  return (
    <AppShell title="Claim Manager Dashboard">
      <div className="mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 shadow-soft">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Claim manager control center</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">Operational Claims Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Monitor every commercial vehicle claim by process queue, open the correct stage workspace, and move claim desk actions forward from one cockpit.
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <HeroMetric label="Total Claims" value={totals.all} />
            <HeroMetric label="Open Claims" value={totals.open} />
            <HeroMetric label="Closed Claims" value={totals.closed} />
          </div>
        </div>
      </div>

      {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-navy-900">Priority claim queue</h2>
              <p className="mt-1 text-sm text-slate-500">Latest open claims with their current operational process.</p>
            </div>
            <Link className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-900" href="/claims?queue=vehicle-intimation">Open claims list</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-navy-900 text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="rounded-l-2xl px-4 py-3">Claim</th>
                  <th className="px-4 py-3">Customer / Mobile</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Insurer</th>
                  <th className="px-4 py-3">Policy</th>
                  <th className="px-4 py-3">Process</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="rounded-r-2xl px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {priorityClaims.length ? priorityClaims.map((claim) => {
                  const queue = operationsQueueForStatus(claim.current_status);
                  return (
                    <tr key={claim.id} className="hover:bg-blue-50/40">
                      <td className="px-4 py-4 font-bold text-navy-900">{claim.claim_no}</td>
                      <td className="px-4 py-4 text-slate-700">
                        <span className="block font-bold text-navy-900">{claim.customers?.company_name ?? claim.customers?.contact_name ?? "-"}</span>
                        <span className="text-xs text-slate-500">{claim.customers?.phone ?? "-"}</span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <span className="block font-mono text-xs font-bold text-navy-900">{claim.vehicles?.vehicle_no ?? "-"}</span>
                        <span className="text-xs text-slate-500">{[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ") || "-"}</span>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{claim.insurance_companies?.name ?? "-"}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-700">{claim.policies?.policy_no ?? "-"}</td>
                      <td className="px-4 py-4"><ProcessPill label={queue?.label ?? claim.current_status} /></td>
                      <td className="px-4 py-4 text-slate-500">{stageAgeLabel(claim.updated_at ?? claim.created_at)}</td>
                      <td className="px-4 py-4"><Link className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-navy-900" href={`/claims/${claim.id}`}>Proceed</Link></td>
                    </tr>
                  );
                }) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={8}>No active claims found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Needs close monitoring</p>
            <p className="mt-2 text-4xl font-black text-navy-900">{totals.highTouch}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Document verification, work approval and payment-stage files that usually need faster claim desk attention.</p>
          </section>
          <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-navy-900">Workflow guide</h2>
            <div className="mt-4 space-y-3">
              {operationsQueueDefinitions.slice(0, 4).map((queue, index) => <WorkflowLine key={queue.key} index={index + 1} label={queue.label} />)}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-28 border-r border-blue-50 px-5 py-4 last:border-r-0">
      <p className="text-3xl font-black text-navy-900">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

type QueueTone = "blue" | "cyan" | "amber" | "green" | "violet" | "red";

function OperationalQueueCard({ title, value, body, href, icon, tone }: { title: string; value: number; body: string; href: string; icon: string; tone: QueueTone }) {
  const tones = {
    blue: "border-blue-100 bg-blue-50/80 text-blue-700",
    cyan: "border-cyan-100 bg-cyan-50/80 text-cyan-700",
    amber: "border-amber-100 bg-amber-50/80 text-amber-700",
    green: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
    violet: "border-violet-100 bg-violet-50/80 text-violet-700",
    red: "border-red-100 bg-red-50/80 text-red-700"
  }[tone];

  return (
    <Link href={href} className={`group rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${tones}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm ring-1 ring-black/5">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-base font-black leading-5 text-navy-900">{title}</h2>
          <p className="mt-2 text-4xl font-black leading-none">{value}</p>
        </div>
      </div>
      <p className="mt-4 min-h-10 text-xs font-semibold leading-5 text-slate-600">{body}</p>
      <p className="mt-4 text-sm font-black text-navy-900 group-hover:text-blue-700">Open queue →</p>
    </Link>
  );
}

function ProcessPill({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-800"><span className="h-2 w-2 rounded-full bg-blue-700" />{label}</span>;
}

function WorkflowLine({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-700">{index}</span>
      <p className="text-sm font-bold text-slate-700">{label}</p>
    </div>
  );
}
