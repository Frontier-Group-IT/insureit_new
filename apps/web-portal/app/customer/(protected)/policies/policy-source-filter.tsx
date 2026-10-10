"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function PolicySourceFilter({ accountId, query, status, source }: {
  accountId: string;
  query: string;
  status: string;
  source: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Filter policy source"
      value={source}
      disabled={pending}
      onChange={(event) => {
        const params = new URLSearchParams({ account: accountId });
        if (query) params.set("q", query);
        if (status !== "all") params.set("status", status);
        if (event.target.value !== "all") params.set("source", event.target.value);
        startTransition(() => router.push(`/customer/policies?${params.toString()}`));
      }}
      className="rounded-xl border border-[#D8E2F0] bg-white px-3 py-2.5 text-[11px] font-semibold text-[#17345B]"
    >
      <option value="all">All Sources</option>
      <option value="internal">Internal</option>
      <option value="external">External</option>
    </select>
  );
}
