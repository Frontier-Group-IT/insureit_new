import Link from "next/link";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { claimStatuses, isCustomerActionAwaited, isDocumentVerificationPending, isManagerActionRequired, isOpenClaimStatus, stageAgeLabel, terminalClaimStatuses } from "@/lib/claim-workflow";

type ClaimRow = {
  id: string;
  claim_no: string;
  current_status: string;
  estimated_loss: number | null;
  settlement_amount: number | null;
  updated_at: string | null;
  created_at: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  assignee: { full_name: string } | null;
};

type SearchParams = { queue?: string; status?: string; q?: string };

function currency(value: number | null) {
  return value == null ? "-" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, claim_no, current_status, estimated_loss, settlement_amount, updated_at, created_at, customers(company_name, contact_name), vehicles(vehicle_no), assignee:profiles!claims_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .returns<ClaimRow[]>();

  const normalizedQuery = (params.q ?? "").trim().toLowerCase();
  const rows = (data ?? []).filter((claim) => {
    const queueMatch = matchesQueue(claim.current_status, params.queue);
    const statusMatch = !params.status || params.status === "all" || claim.current_status === params.status;
    const haystack = [claim.claim_no, claim.current_status, claim.customers?.company_name, claim.customers?.contact_name, claim.vehicles?.vehicle_no, claim.assignee?.full_name].filter(Boolean).join(" ").toLowerCase();
    const searchMatch = !normalizedQuery || haystack.includes(normalizedQuery);
    return queueMatch && statusMatch && searchMatch;
  });

  return (
    <AppShell title={titleForQueue(params.queue)}>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Claim queues</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">{titleForQueue(params.queue)}</h1>
          <p className="mt-2 text-sm text-slate-500">{rows.length} visible claim{rows.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/dashboard" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">Back to dashboard</Link>
      </div>

      <form className="mb-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm" action="/claims">
        {params.queue ? <input type="hidden" name="queue" value={params.queue} /> : null}
        <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto] lg:items-center">
          <input name="q" defaultValue={params.q ?? ""} placeholder="Search claim, customer, vehicle, assignee" aria-label="Search claims" />
          <select name="status" defaultValue={params.status ?? "all"} aria-label="Claim status">
            <option value="all">All statuses</option>
            {claimStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-900" type="submit">Filter</button>
        </div>
      </form>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error.message}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Estimated loss</th><th className="px-4 py-3">Settlement</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? rows.map((claim) => (
                <tr key={claim.id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-4 font-bold text-navy-900">{claim.claim_no}</td>
                  <td className="px-4 py-4 text-slate-700">{claim.customers?.company_name ?? claim.customers?.contact_name ?? "-"}</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-700">{claim.vehicles?.vehicle_no ?? "-"}</td>
                  <td className="px-4 py-4"><StatusBadge status={claim.current_status} /></td>
                  <td className="px-4 py-4 text-slate-600">{claim.assignee?.full_name ?? "Unassigned"}</td>
                  <td className="px-4 py-4 text-slate-500">{stageAgeLabel(claim.updated_at ?? claim.created_at)}</td>
                  <td className="px-4 py-4 text-slate-700">{currency(claim.estimated_loss)}</td>
                  <td className="px-4 py-4 text-slate-700">{currency(claim.settlement_amount)}</td>
                  <td className="px-4 py-4"><Link href={`/claims/${claim.id}`} className="font-bold text-blue-700">Open</Link></td>
                </tr>
              )) : <tr><td className="px-4 py-10 text-center text-slate-500" colSpan={9}>No matching claims found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function matchesQueue(status: string, queue?: string) {
  if (!queue) return true;
  if (queue === "active") return isOpenClaimStatus(status);
  if (queue === "documents") return isDocumentVerificationPending(status);
  if (queue === "customer-action") return isCustomerActionAwaited(status);
  if (queue === "manager-action") return isManagerActionRequired(status);
  if (queue === "closed") return terminalClaimStatuses.includes(status as never);
  return true;
}

function titleForQueue(queue?: string) {
  if (queue === "active") return "Active Claims";
  if (queue === "documents") return "Documents Pending Verification";
  if (queue === "customer-action") return "Customer Action Awaited";
  if (queue === "manager-action") return "Our Action Required";
  if (queue === "closed") return "Closed Cases";
  return "Claims";
}
