"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PolicyIntakeReviewSummary } from "@/lib/policy-intake-review-summary";

export function PolicyIntakePolicyRegisterLinksPortal({ summary }: { summary: PolicyIntakeReviewSummary | null }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!summary) return;
    const addPolicyAction = Array.from(document.querySelectorAll<HTMLAnchorElement>('.ui-page-stage a[href="/policies/new"]'))
      .find((anchor) => anchor.textContent?.trim() === "Add Policy");
    if (!addPolicyAction?.parentElement) return;

    const portalHost = document.createElement("div");
    portalHost.dataset.policyIntakeQuickLinksHost = "true";
    portalHost.className = "shrink-0";
    addPolicyAction.parentElement.insertBefore(portalHost, addPolicyAction);
    setHost(portalHost);

    return () => {
      setHost(null);
      portalHost.remove();
    };
  }, [summary]);

  if (!summary || !host) return null;

  const totalPending = (summary.actionRequired ?? 0) + summary.inReview;

  return createPortal(
    <div className="group/queue flex h-12 shrink-0 items-stretch overflow-hidden rounded-2xl border border-[#D7E2F2] bg-[#F6F9FF] shadow-[0_3px_12px_rgba(49,86,184,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-px hover:border-[#C5D5EC] hover:bg-[#F2F6FD] hover:shadow-[0_7px_18px_rgba(49,86,184,0.10)] focus-within:border-[#B8CAE5] focus-within:ring-2 focus-within:ring-[#3156B8]/15 motion-reduce:transform-none">
      <Link
        href="/policy-intakes"
        prefetch={false}
        aria-label={`Policy Intake Queue. ${totalPending} pending items.`}
        className="flex min-w-[118px] items-center gap-2 border-r border-[#DCE5F2] px-3 focus:outline-none"
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#E8F0FF] text-[#3156B8] transition-colors group-hover/queue:bg-[#DFEAFF]">
          <ClipboardList className="h-4 w-4" />
          {totalPending > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F6F9FF] bg-[#3156B8] motion-safe:animate-pulse" aria-hidden="true" /> : null}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block whitespace-nowrap text-[9.5px] font-black text-[#1B2F4E]">Policy Intake</span>
          <span className="mt-0.5 block whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.08em] text-[#7A899F]">Pending Queue</span>
        </span>
      </Link>

      {summary.actionRequired !== null ? <PolicyIntakeQuickLink
        href="/policy-intakes?view=action"
        label="Action Required"
        count={summary.actionRequired}
        variant="action"
      /> : null}
      <PolicyIntakeQuickLink
        href="/policy-intakes?view=in_review"
        label="In Review"
        count={summary.inReview}
        variant="review"
      />
    </div>,
    host,
  );
}

function PolicyIntakeQuickLink({ href, label, count, variant }: { href: string; label: string; count: number; variant: "action" | "review" }) {
  const active = count > 0;
  const activeTone = variant === "action"
    ? "text-[#C62828]"
    : "text-[#B54708]";
  const badgeTone = active
    ? variant === "action"
      ? "bg-[#FFF0F0] text-[#C62828] ring-[#F4CACA]"
      : "bg-[#FFF7E8] text-[#A65300] ring-[#F0D9AE]"
    : "bg-white/70 text-[#64748B] ring-[#DDE5EE]";

  return <Link
    prefetch={false}
    href={href}
    aria-label={`${label}: ${count}. Open filtered Policy Intakes.`}
    className="group/item flex min-w-[96px] items-center justify-between gap-2 border-r border-[#E1E8F2] px-3 last:border-r-0 transition-colors duration-150 hover:bg-white/65 focus:outline-none focus-visible:bg-white/80 motion-reduce:transition-none"
  >
    <span className={`whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${active ? activeTone : "text-[#66758B]"}`}>{label}</span>
    <span className={`grid min-w-7 place-items-center rounded-lg px-1.5 py-1 text-[14px] font-black leading-4 tabular-nums ring-1 ring-inset transition-transform duration-150 motion-safe:group-hover/item:scale-105 motion-reduce:transform-none ${badgeTone}`}>{count}</span>
  </Link>;
}
