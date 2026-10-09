"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  section: "tickets" | "quotes";
  query: string;
  status: string;
};

export default function EnquiryInstantFilters({ section, query, status }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isPending, startTransition] = useTransition();
  const latest = useRef({ section, query, status });

  useEffect(() => {
    latest.current = { section, query, status };
    setSearch(query);
    setSelectedStatus(status);
  }, [section, query, status]);

  const navigate = (nextQuery: string, nextStatus: string) => {
    const values = new URLSearchParams({ section: latest.current.section });
    if (nextQuery.trim()) values.set("q", nextQuery.trim().slice(0, 100));
    if (nextStatus) values.set("status", nextStatus);
    startTransition(() => router.replace(`${pathname}?${values.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (search.trim() === query) return;
    const timeout = window.setTimeout(() => navigate(search, selectedStatus), 350);
    return () => window.clearTimeout(timeout);
    // Search changes should debounce; status changes are applied immediately by the select.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, query]);

  return (
    <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2" aria-busy={isPending}>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search service enquiries"
        placeholder="Search request, customer, mobile, vehicle..."
        className="h-11 w-[min(32vw,500px)] min-w-[190px] rounded-lg border border-[#CBD6E6] bg-white px-3 text-xs text-[#172844] outline-none focus:border-[#1C4C8E]"
      />
      <select
        value={selectedStatus}
        onChange={(event) => {
          const nextStatus = event.target.value;
          setSelectedStatus(nextStatus);
          navigate(search, nextStatus);
        }}
        aria-label="Filter enquiry status"
        className="h-11 min-w-[145px] rounded-lg border border-[#CBD6E6] bg-white px-3 text-xs font-semibold text-[#172844]"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
    </div>
  );
}
