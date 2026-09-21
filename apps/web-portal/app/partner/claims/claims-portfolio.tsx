"use client";

import { INTERNAL_JOURNEY_STAGES, projectInternalClaim } from "@insureit/claim-journey";
import Image from "next/image";
import { FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { claimStatuses, operationsQueueForStatus, type ClaimStatus } from "@/lib/claim-workflow";
import { getInsurerLogo } from "@/lib/insurer-logo";

export type PartnerClaimPortfolioRow = {
  id: string;
  controlNo: string | null;
  insurerClaimNo: string | null;
  currentStatus: string | null;
  source: "internal" | "external";
  customerName: string;
  customerPhone: string | null;
  vehicleNo: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  accidentAt: string | null;
  createdAt: string;
  insurerName: string | null;
  policyNo: string | null;
};

const CLAIMS_PAGE_SIZE = 10;
const workflowStages = INTERNAL_JOURNEY_STAGES.map((stage) => ({
  key: stage.key.replaceAll("_", "-"),
  label: stage.label,
  statuses: claimStatuses.filter((status) => projectInternalClaim(status).stageKey === stage.key),
}));

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function projectionFor(status: string | null) {
  const resolved = (status && claimStatuses.includes(status as ClaimStatus) ? status : "Initial Documents Pending") as ClaimStatus;
  return projectInternalClaim(resolved);
}

export function PartnerClaimsPortfolio({ rows }: { rows: PartnerClaimPortfolioRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [activeMode, setActiveMode] = useState<"internal" | "external">("internal");
  const [page, setPage] = useState(1);

  const selectedJourney = workflowStages.find((stage) => stage.key === selectedStage);
  const normalized = query.trim().toLowerCase();

  const filteredRows = useMemo(() => rows.filter((claim) => {
    const projection = projectionFor(claim.currentStatus);
    const process = claim.currentStatus ? operationsQueueForStatus(claim.currentStatus as ClaimStatus)?.label : null;
    const haystack = [
      claim.controlNo,
      claim.insurerClaimNo,
      claim.currentStatus,
      process,
      claim.customerName,
      claim.customerPhone,
      claim.vehicleNo,
      claim.vehicleMake,
      claim.vehicleModel,
      claim.policyNo,
      claim.insurerName,
      projection.stageLabel,
    ].filter(Boolean).join(" ").toLowerCase();
    const stageMatch = !selectedJourney || (claim.currentStatus && selectedJourney.statuses.includes(claim.currentStatus as ClaimStatus));
    return claim.source === activeMode && stageMatch && (!normalized || haystack.includes(normalized));
  }), [activeMode, normalized, rows, selectedJourney]);

  const internalCount = rows.filter((claim) => claim.source === "internal").length;
  const externalCount = rows.filter((claim) => claim.source === "external").length;

  useEffect(() => { setPage(1); }, [query, selectedStage, activeMode]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / CLAIMS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * CLAIMS_PAGE_SIZE;
  const visibleRows = filteredRows.slice(start, start + CLAIMS_PAGE_SIZE);

  return (
    <div className="pb-4">
      <section className="overflow-hidden rounded-xl border border-[#D8E3F2] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
        <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]">
                  <FileText className="h-5 w-5" />
                </span>
                <h2 className="shrink-0 text-[18px] font-semibold leading-tight text-[#0F172A]">Claim Portfolio</h2>
              </div>

              <nav aria-label="Claim type" className="flex w-fit max-w-full items-center gap-0.5 rounded-lg border border-[#DCE5F1] bg-[#F8FAFD] p-0.5">
                <button type="button" onClick={() => setActiveMode("internal")} aria-current={activeMode === "internal" ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-[11px] font-semibold transition-colors ${activeMode === "internal" ? "bg-[#E4F0FC] text-[#003A83]" : "text-[#5C6878] hover:bg-[#F1F5FA] hover:text-[#071D49]"}`}>
                  Internal claims <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeMode === "internal" ? "bg-[#D5E7FA] text-[#003A83]" : "bg-[#EEF3F9] text-[#5C6878]"}`}>{internalCount}</span>
                </button>
                <button type="button" onClick={() => setActiveMode("external")} aria-current={activeMode === "external" ? "page" : undefined} className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-[11px] font-semibold transition-colors ${activeMode === "external" ? "bg-[#E4F0FC] text-[#003A83]" : "text-[#5C6878] hover:bg-[#F1F5FA] hover:text-[#071D49]"}`}>
                  External claims <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeMode === "external" ? "bg-[#D5E7FA] text-[#003A83]" : "bg-[#EEF3F9] text-[#5C6878]"}`}>{externalCount}</span>
                </button>
              </nav>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-2 max-md:flex-col max-md:items-stretch lg:justify-end">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by customer, vehicle no., claim no., policy no., control no."
                aria-label="Search claims"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#CCD6E4] bg-white px-3.5 text-[12px] font-normal text-[#071D49] shadow-sm outline-none placeholder:text-[#7A8797] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100 lg:max-w-[520px]"
              />
              <select value={selectedStage || "all"} onChange={(event) => setSelectedStage(event.target.value === "all" ? "" : event.target.value)} aria-label="Filter by claim stage" className="h-10 w-[220px] rounded-lg border border-[#D4DDE9] bg-white px-3 text-[12px] font-medium text-[#071D49] shadow-sm outline-none focus:border-[#174EA6] max-md:w-full">
                <option value="all">All claim stages</option>
                {workflowStages.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border-t border-[#D8E3F2] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#D8E3F2] px-3 py-2.5">
            <h2 className="text-[14px] font-semibold text-[#071D49]">{activeMode === "external" ? "External claims" : "Internal claims"}</h2>
            <span className="rounded-full bg-[#EEF4FC] px-2.5 py-1 text-[10px] font-semibold text-[#174EA6]">{filteredRows.length} claim{filteredRows.length === 1 ? "" : "s"}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#E1E7F0] bg-white shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-separate border-spacing-y-0 text-left text-[11px] leading-tight text-[#071D49]">
                <thead>
                  <tr className="bg-[#003A83] text-center text-[10.5px] font-medium tracking-[0.01em] text-white">
                    <th className="rounded-tl-lg px-2 py-2">Customer / Mobile</th><th className="px-2 py-2">Vehicle No.</th><th className="px-2 py-2">Vehicle</th><th className="px-2 py-2">Loss Date</th><th className="px-2 py-2">Insurer</th><th className="px-2 py-2">Policy</th><th className="px-2 py-2">Control No.</th><th className="px-2 py-2">Claim No.</th><th className="px-2 py-2">Process</th><th className="rounded-tr-lg px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length ? visibleRows.map((claim) => {
                    const projection = projectionFor(claim.currentStatus);
                    const process = claim.currentStatus ? operationsQueueForStatus(claim.currentStatus as ClaimStatus) : null;
                    const insurerLogo = getInsurerLogo(claim.insurerName);
                    return (
                      <tr key={claim.id} className="group bg-white align-middle shadow-[0_1px_0_rgba(226,232,240,0.86)] transition hover:bg-[#F8FBFF]">
                        <td className="border-r border-[#E7ECF3] px-2 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-9 shrink-0 items-center justify-center overflow-visible bg-transparent p-0">
                              {insurerLogo ? (
                                <Image
                                  src={insurerLogo}
                                  alt={claim.insurerName ? `${claim.insurerName} logo` : "Insurance company"}
                                  width={32}
                                  height={32}
                                  className="max-h-7 max-w-[34px] w-auto object-contain"
                                />
                              ) : (
                                <ShieldCheck className="h-4 w-4 text-[#7E91A8]" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate font-medium">{claim.customerName || "-"}</span>
                              <span className="block truncate text-[10px] text-[#344256]">{claim.customerPhone || "-"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.vehicleNo || "-"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{[claim.vehicleMake, claim.vehicleModel].filter(Boolean).join(" ") || "-"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{formatDate(claim.accidentAt || claim.createdAt)}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.insurerName || "InsureIT"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.policyNo || "-"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.controlNo || "-"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2 text-center">{claim.insurerClaimNo || "-"}</td>
                        <td className="border-r border-[#E7ECF3] px-2 py-2"><span className="block">{process?.label || claim.currentStatus || "-"}</span><span className="mt-0.5 block text-[9px] text-[#65748A]">{projection.stageLabel} · {projection.nextActionOwner === "customer" ? "Customer action" : projection.nextActionOwner === "operations" ? "Operations action" : "Complete"}</span></td>
                        <td className="px-2 py-2 text-center"><Link prefetch={false} href={`/partner/claims/${claim.id}`} className="inline-flex h-7 items-center justify-center rounded-md bg-[#003A83] px-3 text-[10.5px] font-medium text-white">Proceed</Link></td>
                      </tr>
                    );
                  }) : <tr><td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={10}>No matching claims found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#E4EAF2] bg-white px-5 py-4 text-[11px] font-normal text-[#344256]">
            <p>Showing {filteredRows.length ? start + 1 : 0}–{Math.min(filteredRows.length, safePage * CLAIMS_PAGE_SIZE)} of {filteredRows.length}</p>
            <div className="flex items-center gap-5">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-9 rounded-lg border border-[#D6DEE9] px-4 font-medium text-[#344256] disabled:cursor-not-allowed disabled:text-[#C0C9D5]">←&nbsp; Previous</button>
              <span className="font-semibold text-[#344256]">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="h-9 rounded-lg border border-[#D6DEE9] px-4 font-medium text-[#344256] disabled:cursor-not-allowed disabled:text-[#C0C9D5]">Next&nbsp; →</button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
