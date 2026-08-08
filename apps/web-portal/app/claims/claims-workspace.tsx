"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type QueueClaimRow } from "@/components/claim-manager/claim-queue-table";
import { claimStatuses, isCustomerActionAwaited, isDocumentVerificationPending, isManagerActionRequired, isOpenClaimStatus, operationsQueueForKey, operationsQueueForStatus, terminalClaimStatuses, type ClaimStatus } from "@/lib/claim-workflow";

type SearchParams = { queue?: string; journey?: string; status?: string; q?: string; page?: string; pageSize?: string };
const allowedPageSizes = [5, 10, 20, 50, 100];
const customerJourneyStages = [
  { key: "loss-report", label: "Loss Report", statuses: ["Accident Reported"] as ClaimStatus[] },
  { key: "spot-intimation", label: "Spot Intimation", statuses: ["Initial Documents Pending", "Initial Documents Verification Pending", "Initial Documents Submitted", "Initial Documents Verified", "Documents Submitted", "Documents Pending"] as ClaimStatus[] },
  { key: "spot-surveyor-assigned", label: "Spot Surveyor Assigned", statuses: ["Surveyor Appointed"] as ClaimStatus[] },
  { key: "spot-survey-completed", label: "Spot Survey Completed", statuses: ["Vehicle Inspected"] as ClaimStatus[] },
  { key: "final-documents", label: "Final Documents", statuses: ["Final Documents Awaited", "Final Documents Verification Pending", "Final Documents Submitted", "Final Documents Verified"] as ClaimStatus[] },
  { key: "claim-intimation", label: "Claim Intimation", statuses: ["Claim Intimated", "Claim Intimation"] as ClaimStatus[] },
  { key: "final-surveyor", label: "Final Surveyor", statuses: ["Final Surveyor Details", "Survey Status", "Survey Done"] as ClaimStatus[] },
  { key: "work-approval", label: "Work Approval", statuses: ["Work Approval Status", "Work Approval Received", "Estimate Submitted", "Approval Pending"] as ClaimStatus[] },
  { key: "under-repair", label: "Under Repair", statuses: ["Under Repair", "Repair Done", "Repair Started", "Repair Completed"] as ClaimStatus[] },
  { key: "ri-stage", label: "RI Stage", statuses: ["RA Intimation", "RA Intimation Done"] as ClaimStatus[] },
  { key: "do-stage", label: "DO Stage", statuses: ["DO Status", "DO Submitted"] as ClaimStatus[] },
  { key: "vehicle-release", label: "Vehicle Release", statuses: ["Final Bill Submitted"] as ClaimStatus[] },
  { key: "payment-advice-received", label: "Payment Advice Received", statuses: ["Payment Stage", "Claim Completion In Progress", "Settlement Under Process"] as ClaimStatus[] },
  { key: "journey-complete", label: "Journey Complete", statuses: ["Claim Complete", "Settled", "Closed"] as ClaimStatus[] },
] as const;

export function ClaimsWorkspace({ rows, initialParams, loadError }: { rows: QueueClaimRow[]; initialParams: SearchParams; loadError: string | null }) {
  const [query, setQuery] = useState(initialParams.q ?? "");
  const [selectedStatus, setSelectedStatus] = useState(initialParams.status && initialParams.status !== "all" ? initialParams.status : "");
  const [page, setPage] = useState(Math.max(1, Number(initialParams.page ?? "1") || 1));
  const requestedPageSize = Number(initialParams.pageSize ?? "10") || 10;
  const [pageSize, setPageSize] = useState(allowedPageSizes.includes(requestedPageSize) ? requestedPageSize : 10);
  const selectedJourney = customerJourneyForKey(initialParams.journey);
  const normalized = query.trim().toLowerCase();
  const visibleRows = useMemo(() => rows.filter((claim) => {
    const process = operationsQueueForStatus(claim.current_status)?.label;
    const haystack = [claim.claim_no, claim.insurer_claim_no, claim.current_status, process, claim.customers?.company_name, claim.customers?.contact_name, claim.customers?.phone, claim.vehicles?.vehicle_no, claim.vehicles?.make, claim.vehicles?.model, claim.policies?.policy_no, claim.insurance_companies?.name, claim.assignee?.full_name].filter(Boolean).join(" ").toLowerCase();
    return matchesQueue(claim.current_status, initialParams.queue) && (!selectedJourney || selectedJourney.statuses.includes(claim.current_status)) && (!selectedStatus || claim.current_status === selectedStatus) && (!normalized || haystack.includes(normalized));
  }), [initialParams.queue, normalized, rows, selectedJourney, selectedStatus]);
  useEffect(() => { setPage(1); }, [query, selectedStatus, pageSize]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (initialParams.queue) params.set("queue", initialParams.queue);
    if (initialParams.journey) params.set("journey", initialParams.journey);
    if (query.trim()) params.set("q", query.trim());
    if (selectedStatus) params.set("status", selectedStatus);
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 10) params.set("pageSize", String(pageSize));
    const nextUrl = `/claims${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [initialParams.journey, initialParams.queue, page, pageSize, query, selectedStatus]);

  return <>
    <div className="mb-2 grid grid-cols-[145px_1fr] items-center gap-3 max-lg:grid-cols-1">
      <div><p className="whitespace-nowrap text-[12px] font-medium leading-none text-[#071D49]">Total Claims <span className="text-[11px] font-normal text-[#5C6878]">(All Stages)</span></p><p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-[#003A83]">{visibleRows.length}</p></div>
      <form onSubmit={(event) => event.preventDefault()} className="flex items-center gap-2 max-md:flex-col max-md:items-stretch">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by customer, vehicle no., claim no., policy no., control no." aria-label="Search claims" className="h-10 flex-1 rounded-lg border border-[#CCD6E4] bg-white px-3.5 text-[12px] font-normal text-[#071D49] shadow-sm outline-none placeholder:text-[#7A8797] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" />
        <select value={selectedStatus || "all"} onChange={(event) => setSelectedStatus(event.target.value === "all" ? "" : event.target.value)} aria-label="Filter by status" className="h-10 w-[220px] rounded-lg border border-[#D4DDE9] bg-white px-3 text-[12px] font-medium text-[#071D49] shadow-sm outline-none focus:border-[#174EA6] max-md:w-full"><option value="all">All statuses</option>{claimStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
      </form>
    </div>
    {loadError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{loadError}</div> : null}
    <LocalClaimQueueTable rows={visibleRows} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
  </>;
}

function LocalClaimQueueTable({ rows, page, pageSize, onPageChange, onPageSizeChange }: { rows: QueueClaimRow[]; page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  return <>
    <div className="overflow-hidden rounded-lg border border-[#E1E7F0] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-separate border-spacing-y-0 text-left text-[11px] leading-tight text-[#071D49]">
          <thead><tr className="bg-[#003A83] text-center text-[10.5px] font-medium tracking-[0.01em] text-white"><th className="rounded-tl-lg px-2 py-2">Sr. No.</th><th className="px-2 py-2">Customer / Mobile</th><th className="px-2 py-2">Vehicle No.</th><th className="px-2 py-2">Vehicle</th><th className="px-2 py-2">Loss Date</th><th className="px-2 py-2">Insurer</th><th className="px-2 py-2">Policy</th><th className="px-2 py-2">Control No.</th><th className="px-2 py-2">Claim No.</th><th className="px-2 py-2">Process</th><th className="rounded-tr-lg px-2 py-2">Action</th></tr></thead>
          <tbody>{visibleRows.length ? visibleRows.map((claim, index) => {
            const process = operationsQueueForStatus(claim.current_status);
            const customer = claim.customers?.company_name ?? claim.customers?.contact_name ?? "-";
            return <tr key={claim.id} className="group bg-white align-middle shadow-[0_1px_0_rgba(226,232,240,0.86)] transition hover:bg-[#F8FBFF]"><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{start + index + 1}</td><td className="border-r border-[#E7ECF3] px-2 py-2"><span className="block font-medium">{customer}</span><span className="text-[10px] text-[#344256]">{claim.customers?.phone ?? "-"}</span></td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.vehicles?.vehicle_no ?? "-"}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{[claim.vehicles?.make, claim.vehicles?.model].filter(Boolean).join(" ") || "-"}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{formatDate(claim.accident_at ?? claim.created_at)}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.insurance_companies?.name ?? "InsureIT"}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.policies?.policy_no ?? "-"}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.claim_no}</td><td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.insurer_claim_no ?? "-"}</td><td className="border-r border-[#E7ECF3] px-2 py-2">{process?.label ?? claim.current_status}</td><td className="px-2 py-2 text-center"><Link href={`/claims/${claim.id}`} className="inline-flex h-7 items-center justify-center rounded-md bg-[#003A83] px-3 text-[10.5px] font-medium text-white">Proceed</Link></td></tr>;
          }) : <tr><td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={11}>No matching claims found.</td></tr>}</tbody>
        </table>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4EAF2] bg-white px-3 py-2 text-[11px] font-normal text-[#344256] shadow-[0_6px_18px_rgba(7,29,73,0.03)]">
      <p>Showing {rows.length ? start + 1 : 0} to {Math.min(rows.length, safePage * pageSize)} of {rows.length} claims</p>
      <div className="flex items-center gap-1.5"><button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="h-7 rounded-md border border-[#DCE4EF] bg-white px-3 font-medium disabled:opacity-40">Previous</button><span className="font-semibold">{safePage} / {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="h-7 rounded-md border border-[#DCE4EF] bg-white px-3 font-medium disabled:opacity-40">Next</button></div>
      <div className="flex items-center gap-2"><span>Items per page:</span><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-7 rounded-md border border-[#DCE4EF] bg-white px-2 text-[11px] font-medium text-[#071D49]">{allowedPageSizes.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
    </div>
  </>;
}

function customerJourneyForKey(key?: string) { return customerJourneyStages.find((stage) => stage.key === key); }
function matchesQueue(status: ClaimStatus, queue?: string) {
  if (!queue) return true;
  const operationalQueue = operationsQueueForKey(queue);
  if (operationalQueue) return operationalQueue.statuses.includes(status);
  if (queue === "active") return isOpenClaimStatus(status);
  if (queue === "documents") return isDocumentVerificationPending(status);
  if (queue === "customer-action") return isCustomerActionAwaited(status);
  if (queue === "manager-action") return isManagerActionRequired(status);
  if (queue === "closed") return terminalClaimStatuses.includes(status);
  return true;
}
function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
