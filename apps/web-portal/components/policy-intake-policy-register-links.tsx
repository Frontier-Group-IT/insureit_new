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

  return createPortal(
    <div className="grid h-12 shrink-0 grid-cols-[118px_208px] overflow-hidden">
      <div className="grid grid-rows-[18px_30px] border-r-2 border-[#AFC3DB]">
        <DividerHeading label="Proposal" />
        <Link
          href="/policies/life-health-cases"
          prefetch={false}
          aria-label={`Proposal pending: ${totalPending}. Open Case Register.`}
          className="group/item flex items-center gap-2 px-3 focus:outline-none hover:bg-[#F8FAFC] focus-visible:bg-[#F8FAFC]"
        >
          <span className={`whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${pendingTone}`}>Pending</span>
          <span className={`text-[14px] font-black leading-4 tabular-nums ${pendingTone}`}>{totalPending}</span>
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

  return <Link
    prefetch={false}
    href={href}
    aria-label={`${label}: ${count}. Open filtered Policy Intakes.`}
    className="group/item flex min-w-0 items-center justify-between gap-1.5 border-r border-[#E1E8F2] px-2.5 last:border-r-0 transition-colors duration-150 hover:bg-[#F8FAFC] focus:outline-none focus-visible:bg-[#F8FAFC] motion-reduce:transition-none"
  >
    <span className={`min-w-0 whitespace-nowrap text-[8.5px] font-extrabold leading-3 ${active ? activeTone : "text-[#66758B]"}`}>{label}</span>
    <span className={`text-[14px] font-black leading-4 tabular-nums ${active ? activeTone : "text-[#64748B]"}`}>{count}</span>
  </Link>;
}
