import Link from "next/link";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { isCustomerActionAwaited, isDocumentVerificationPending, isManagerActionRequired, isOpenClaimStatus, stageAgeLabel, terminalClaimStatuses } from "@/lib/claim-workflow";

type ClaimRow = {
  id: string;
  claim_no: string;
  current_status: string;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, current_status, updated_at, created_at, customers(company_name, contact_name), vehicles(vehicle_no)")
    .order("updated_at", { ascending: false })
    .returns<ClaimRow[]>();

  const claims = data ?? [];
  const counts = {
    active: claims.filter((claim) => isOpenClaimStatus(claim.current_status)).length,
    documents: claims.filter((claim) => isDocumentVerificationPending(claim.current_status)).length,
    customerAction: claims.filter((claim) => isOpenClaimStatus(claim.current_status) && isCustomerActionAwaited(claim.current_status)).length,
    managerAction: claims.filter((claim) => isManagerActionRequired(claim.current_status)).length,
    closed: claims.filter((claim) => terminalClaimStatuses.includes(claim.current_status as never)).length
  };
  const priorityClaims = claims.filter((claim) => isOpenClaimStatus(claim.current_status)).slice(0, 8);

  return (
    <AppShell title="Claims Desk">
      <div className="mb-6 overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-6 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Claim manager workspace</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">Claims Desk</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">Track active commercial vehicle claims, verify uploaded documents, and move manager-side actions forward from one clean workspace.</p>
          </div>
          <Link href="/claims?queue=manager-action" className="inline-flex rounded-2xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-navy-900">Open action queue</Link>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <QueueCard title="Active Claims" value={counts.active} href="/claims?queue=active" tone="blue" body="All claims currently in progress" />
        <QueueCard title="Documents Pending Verification" value={counts.documents} href="/claims?queue=documents" tone="cyan" body="Uploaded files waiting for review" />
        <QueueCard title="Customer Action Awaited" value={counts.customerAction} href="/claims?queue=customer-action" tone="slate" body="Customer upload or correction needed" />
        <QueueCard title="Our Action Required" value={counts.managerAction} href="/claims?queue=manager-action" tone="amber" body="Manager-side review or workflow action" />
        <QueueCard title="Closed Cases" value={counts.closed} href="/claims?queue=closed" tone="green" body="Settled, rejected, and closed records" />
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-navy-900">Priority claims</h2>
            <p className="mt-1 text-sm text-slate-500">Newest active files for manager review.</p>
          </div>
          <Link className="text-sm font-bold text-blue-700" href="/claims?queue=active">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Age</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {priorityClaims.length ? priorityClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-4 font-bold text-navy-900">{claim.claim_no}</td>
                  <td className="px-4 py-4 text-slate-700">{claim.customers?.company_name ?? claim.customers?.contact_name ?? "-"}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-700">{claim.vehicles?.vehicle_no ?? "-"}</td>
                  <td className="px-4 py-4"><StatusBadge status={claim.current_status} /></td>
                  <td className="px-4 py-4 text-slate-500">{stageAgeLabel(claim.updated_at ?? claim.created_at)}</td>
                  <td className="px-4 py-4"><Link className="font-bold text-blue-700" href={`/claims/${claim.id}`}>Open</Link></td>
                </tr>
              )) : <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No active claims found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function QueueCard({ title, value, body, href, tone }: { title: string; value: number; body: string; href: string; tone: "blue" | "cyan" | "slate" | "amber" | "green" }) {
  const tones = {
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    cyan: "border-cyan-100 bg-cyan-50 text-cyan-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700"
  }[tone];
  return (
    <Link href={href} className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${tones}`}>
      <p className="text-3xl font-black">{value}</p>
      <h2 className="mt-3 text-base font-black text-navy-900">{title}</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{body}</p>
      <p className="mt-4 text-sm font-black">Open ?</p>
    </Link>
  );
}
