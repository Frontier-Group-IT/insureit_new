"use client";

import Link from "next/link";
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
  const showActionRequired = summary.actionRequired !== null;

  return createPortal(
    <div className="group/queue grid h-12 shrink-0 grid-cols-[118px_112px_96px] grid-rows-[18px_30px] overflow-hidden rounded-2xl border border-[#D7E2F2] bg-[#F6F9FF] shadow-[0_3px_12px_rgba(49,86,184,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-px hover:border-[#C5D5EC] hover:bg-[#F2F6FD] hover:shadow-[0_7px_18px_rgba(49,86,184,0.10)] focus-within:border-[#B8CAE5] focus-within:ring-2 focus-within:ring-[#3156B8]/15 motion-reduce:transform-none">
      <div className="flex items-end border-r border-b border-[#DCE5F2] px-3 pb-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#66758B]">
        Proposal
      </div>
      <div className="col-span-2 flex items-end border-b border-[#DCE5F2] px-3 pb-1 text-[8px] font-black uppercase tracking-[0.08em] text-[#66758B]">
        Policy Intake
      </div>

      <Link
        href="/policy-intakes"
        prefetch={false}
        aria-label={`Proposal pending: ${totalPending}. Open Policy Intakes.`}
        className="flex items-center gap-1.5 border-r border-[#DCE5F2] px-3 focus:outline-none hover:bg-white/65 focus-visible:bg-white/80"
      >
        <span className="whitespace-nowrap text-[8.5px] font-extrabold text-[#1B2F4E]">Pending</span>
        <span className="text-[14px] font-black leading-4 tabular-nums text-[#3156B8]">{totalPending}</span>
      </Link>

      {showActionRequired ? <PolicyIntakeQuickLink
        href="/policy-intakes?view=action"
        label="Action Required"
        count={summary.actionRequired ?? 0}
        variant="action"
      /> : <div className="border-r border-[#E1E8F2]" />}
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
    className="group/item flex items-center justify-between gap-2 border-r border-[#E1E8F2] px-3 last:border-r-0 transition-colors duration-150 hover:bg-white/65 focus:outline-none focus-visible:bg-white/80 motion-reduce:transition-none"
  >
    <span className={`whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${active ? activeTone : "text-[#66758B]"}`}>{label}</span>
    <span className={`grid min-w-7 place-items-center rounded-lg px-1.5 py-1 text-[14px] font-black leading-4 tabular-nums ring-1 ring-inset transition-transform duration-150 motion-safe:group-hover/item:scale-105 motion-reduce:transform-none ${badgeTone}`}>{count}</span>
  </Link>;
}
