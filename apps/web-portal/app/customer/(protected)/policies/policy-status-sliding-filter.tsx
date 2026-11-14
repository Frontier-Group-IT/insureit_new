"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PolicyStatus = "all" | "active" | "due" | "expired";
const statuses: PolicyStatus[] = ["all", "active", "due", "expired"];
const labels = ["All", "Active", "Due", "Expired"];
const SLIDE_MS = 1050;

export function PolicyStatusSlidingFilter({
  accountId, query, source, status, counts,
}: {
  accountId: string;
  query: string;
  source: string;
  status: string;
  counts: { all: number; active: number; due: number; expired: number };
}) {
  const router = useRouter();
  const normalized = statuses.includes(status as PolicyStatus) ? status as PolicyStatus : "all";
  const [selected, setSelected] = useState<PolicyStatus>(normalized);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSelected(normalized);
  }, [normalized]);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const currentIndex = statuses.indexOf(selected);

  function select(next: PolicyStatus) {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (next === selected) return;
    setSelected(next);

    const params = new URLSearchParams({ account: accountId });
    if (query) params.set("q", query);
    if (source !== "all") params.set("source", source);
    if (next !== "all") params.set("status", next);

    // Let the travelling highlight visibly finish before the URL navigation,
    // which may remount server-rendered sections of the Policies page.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.push(`/customer/policies?${params.toString()}`, { scroll: false });
    }, reducedMotion ? 0 : SLIDE_MS);
  }

  return (
    <div
      role="group"
      aria-label="Policy status filter"
      className="relative ml-auto grid shrink-0 grid-cols-4 items-center rounded-lg border border-[#D8E2F0] bg-[#F8FAFD] p-1"
    >
      <span
        aria-hidden="true"
        className="policy-status-sliding-indicator pointer-events-none absolute bottom-1 left-1 top-1 rounded-md bg-[#0D756D] shadow-[0_2px_7px_rgba(13,117,109,.14)]"
        style={{
          width: "calc((100% - 8px) / 4)",
          transform: `translateX(${currentIndex * 100}%)`,
        }}
      />
      {statuses.map((value, index) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected === value}
          onClick={() => select(value)}
          className={`relative z-10 whitespace-nowrap rounded-md px-3 py-2 text-[12px] font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1769DC] ${selected === value ? "text-white" : "text-[#60728D] hover:bg-white/70"}`}
        >
          {labels[index]} {counts[value]}
        </button>
      ))}
    </div>
  );
}
