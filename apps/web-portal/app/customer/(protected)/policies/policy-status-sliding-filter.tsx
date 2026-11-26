"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type PolicyStatus = "all" | "active" | "due" | "expired";
const statuses: PolicyStatus[] = ["all", "active", "due", "expired"];
const labels = ["All", "Active", "Due", "Expired"];

export function PolicyStatusDropdown({ accountId, query, source, status, counts }: {
  accountId: string;
  query: string;
  source: string;
  status: string;
  counts: Record<PolicyStatus, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const normalized = statuses.includes(status as PolicyStatus) ? status as PolicyStatus : "all";

  return (
    <select
      aria-label="Filter policy status"
      value={normalized}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        const params = new URLSearchParams({ account: accountId });
        if (query) params.set("q", query);
        if (source !== "all") params.set("source", source);
        if (next !== "all") params.set("status", next);
        startTransition(() => router.push(`/customer/policies?${params.toString()}`, { scroll: false }));
      }}
      className="customer-register-control ml-auto h-10 w-fit shrink-0 whitespace-nowrap rounded-xl border border-[#D8E2F0] bg-white px-3 text-[11px] font-semibold text-[#17345B]"
    >
      {statuses.map((value, index) => (
        <option key={value} value={value}>{labels[index]} {counts[value]}</option>
      ))}
    </select>
  );
}
