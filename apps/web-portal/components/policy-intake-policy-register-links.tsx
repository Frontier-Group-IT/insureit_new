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
  const pendingActive = totalPending > 0;
  const pendingTone = pendingActive
    ? "text-[#C62828]"
    : "text-[#66758B]";
  const pendingBadgeTone = pendingActive
    ? "bg-[#FFF0F0] text-[#C62828] ring-[#F4CACA]"
    : "bg-white/70 text-[#64748B] ring-[#DDE5EE]";

  return createPortal(
    <div className="group/queue grid h-12 shrink-0 grid-cols-[118px_208px] overflow-hidden rounded-2xl border border-[#D7E2F2] bg-[#F6F9FF] shadow-[0_3px_12px_rgba(49,86,184,0.06)] transition-[transform,border-color,background-color,box-shadow] duration-200 motion-safe:hover:-translate-y-px hover:border-[#C5D5EC] hover:bg-[#F2F6FD] hover:shadow-[0_7px_18px_rgba(49,86,184,0.10)] focus-within:border-[#B8CAE5] focus-within:ring-2 focus-within:ring-[#3156B8]/15 motion-reduce:transform-none">
      <div className="grid grid-rows-[18px_30px] border-r-2 border-[#AFC3DB]">
        <DividerHeading label="Proposal" />
        <Link
          href="/policy-intakes"
          prefetch={false}
          aria-label={`Proposal pending: ${totalPending}. Open Policy Intakes.`}
          className="group/item flex items-center gap-2 px-3 focus:outline-none hover:bg-white/65 focus-visible:bg-white/80"
        >
          <span className={`whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${pendingTone}`}>Pending</span>
          <span className={`grid min-w-7 place-items-center rounded-lg px-1.5 py-1 text-[14px] font-black leading-4 tabular-nums ring-1 ring-inset transition-transform duration-150 motion-safe:group-hover/item:scale-105 motion-reduce:transform-none ${pendingBadgeTone}`}>{totalPending}</span>
        </Link>
      </div>

      <div className="grid min-w-0 grid-rows-[18px_30px]">
        <DividerHeading label="Policy Intake" />
        <div className="grid min-w-0 grid-cols-[112px_96px]">
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
        </div>
      </div>
    </div>,
    host,
  );
}

function DividerHeading({ label }: { label: string }) {
  return <div className="flex items-center gap-1.5 px-2.5 pt-0.5">
    <span className="h-px w-3 shrink-0 bg-[#D7E2F2]" aria-hidden="true" />
    <span className="whitespace-nowrap text-[8px] font-black uppercase tracking-[0.08em] text-[#66758B]">{label}</span>
    <span className="h-px min-w-0 flex-1 bg-[#D7E2F2]" aria-hidden="true" />
  </div>;
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
    className="group/item flex min-w-0 items-center justify-between gap-1.5 border-r border-[#E1E8F2] px-2.5 last:border-r-0 transition-colors duration-150 hover:bg-white/65 focus:outline-none focus-visible:bg-white/80 motion-reduce:transition-none"
  >
    <span className={`min-w-0 whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${active ? activeTone : "text-[#66758B]"}`}>{label}</span>
    <span className={`grid min-w-7 place-items-center rounded-lg px-1.5 py-1 text-[14px] font-black leading-4 tabular-nums ring-1 ring-inset transition-transform duration-150 motion-safe:group-hover/item:scale-105 motion-reduce:transform-none ${badgeTone}`}>{count}</span>
  </Link>;
}
