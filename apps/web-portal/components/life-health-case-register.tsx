"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { LifeHealthIssuedPolicyButton } from "@/components/life-health-issued-policy-button";

export type LifeHealthCaseRegisterRow = {
  id: string;
  caseNumber: string;
  businessLine: string;
  customerName: string;
  customerPhone: string;
  insurerName: string;
  productName: string;
  proposalNumber: string;
  sourcingDate: string;
  rmName: string;
  leadSource: string;
  premiumAmount: number;
  finalPolicyId: string | null;
};

function normalize(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function LifeHealthCaseRegister({
  rows,
  emptyLabel,
}: {
  rows: LifeHealthCaseRegisterRow[];
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);

  const filteredRows = useMemo(() => {
    if (!normalizedQuery) return rows;
    return rows.filter((row) => {
      const status = row.finalPolicyId ? "issued" : "awaiting policy";
      const searchable = [
        row.caseNumber,
        row.businessLine,
        row.customerName,
        row.customerPhone,
        row.insurerName,
        row.productName,
        row.proposalNumber,
        row.sourcingDate,
        row.rmName,
        row.leadSource,
        row.premiumAmount,
        Number(row.premiumAmount || 0).toLocaleString("en-IN"),
        status,
      ].map(normalize).join(" ");
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, rows]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
      <div className="border-b border-[#E8EDF3] bg-white px-4 py-3">
        <div className="relative max-w-[720px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search case no., customer, mobile, insurer, product, proposal no., RM, source..."
            aria-label="Search Life and Health case register"
            className="h-10 w-full rounded-xl border border-[#C9D6E6] bg-[#FBFCFE] pl-10 pr-10 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#315B9A] focus:bg-white focus:ring-2 focus:ring-[#315B9A]/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[#98A2B3] hover:bg-[#EEF3F8] hover:text-[#17365D]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {query ? (
          <p className="mt-1.5 text-[9px] font-medium text-[#667085]">
            {filteredRows.length} of {rows.length} cases match “{query.trim()}”
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-[10px]">
          <thead className="border-b bg-[#F8FAFC] text-[8px] uppercase tracking-[.05em] text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Insurer / Product</th>
              <th className="px-3 py-3">Proposal</th>
              <th className="px-3 py-3">Sourcing</th>
              <th className="px-3 py-3">RM / Source</th>
              <th className="px-3 py-3 text-right">Premium</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8EDF3]">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-[#FAFCFF]">
                <td className="px-4 py-3">
                  <p className="font-bold text-[#17365D]">{row.caseNumber}</p>
                  <p className="mt-0.5 text-[8px] text-[#667085]">{row.businessLine}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[#17203A]">{row.customerName}</p>
                  <p className="mt-0.5 text-[8px] text-[#667085]">{row.customerPhone || "—"}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[#17203A]">{row.insurerName}</p>
                  <p className="mt-0.5 max-w-[210px] truncate text-[8px] text-[#667085]">{row.productName}</p>
                </td>
                <td className="px-3 py-3 font-medium">{row.proposalNumber}</td>
                <td className="px-3 py-3">{row.sourcingDate}</td>
                <td className="px-3 py-3">
                  <p className="font-medium">{row.rmName || "—"}</p>
                  <p className="mt-0.5 max-w-[180px] truncate text-[8px] text-[#667085]">{row.leadSource || "—"}</p>
                </td>
                <td className="px-3 py-3 text-right font-semibold">₹{Number(row.premiumAmount || 0).toLocaleString("en-IN")}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${row.finalPolicyId ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#FFF3CD] text-[#A96A00]"}`}>
                    {row.finalPolicyId ? "Issued" : "Awaiting policy"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.finalPolicyId ? (
                    <LifeHealthIssuedPolicyButton policyId={row.finalPolicyId} />
                  ) : (
                    <Link href={`/policies/life-health-cases/${row.id}`} className="rounded-lg border border-[#CAD7E7] bg-white px-2.5 py-1.5 text-[8.5px] font-bold text-[#315B9A]">
                      Open / Issue
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!filteredRows.length ? (
        <div className="px-4 py-16 text-center">
          <p className="text-[10px] font-semibold text-[#42526B]">{query ? "No matching cases found." : emptyLabel}</p>
          {query ? <p className="mt-1 text-[9px] text-[#98A2B3]">Try a case number, customer, mobile, insurer, product, proposal, RM, source or status.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
