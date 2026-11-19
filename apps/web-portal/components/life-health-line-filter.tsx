"use client";

import { useRouter } from "next/navigation";

export function LifeHealthLineFilter({ line, status }: {
  line: "all" | "life" | "health";
  status: "pending" | "rejected" | "issued" | "all";
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Filter cases by Life or Health"
      value={line}
      onChange={(event) => {
        const next = event.target.value;
        const params = new URLSearchParams();
        if (status !== "pending") params.set("status", status);
        if (next !== "all") params.set("line", next);
        const query = params.toString();
        router.push(`/policies/life-health-cases${query ? `?${query}` : ""}`);
      }}
      className="h-[38px] min-w-[112px] rounded-xl border border-[#D9E2F0] bg-[#F8FAFC] px-3 text-[10px] font-bold text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#315B9A]/10"
    >
      <option value="all">All</option>
      <option value="life">Life</option>
      <option value="health">Health</option>
    </select>
  );
}
