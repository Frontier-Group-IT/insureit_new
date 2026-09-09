"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

  return createPortal(
    <div className="flex shrink-0 items-center gap-2">
      <PolicyIntakeQuickLink
        href="/policy-intakes?view=action"
        label="Action Required"
        count={summary.actionRequired}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
      <PolicyIntakeQuickLink
        href="/policy-intakes?view=in_review"
        label="In Review"
        count={summary.inReview}
        icon={<Clock3 className="h-3.5 w-3.5" />}
      />
    </div>,
    host,
  );
}

function PolicyIntakeQuickLink({ href, label, count, icon }: { href: string; label: string; count: number; icon: ReactNode }) {
  return <Link
    prefetch={false}
    href={href}
    aria-label={`${label}: ${count}. Open Policy Intakes.`}
    className="group inline-flex h-11 min-w-[128px] items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FFF7F7] px-2.5 text-[#C62828] transition hover:border-[#FCA5A5] hover:bg-[#FFF0F0] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/15"
  >
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#FEE2E2] text-[#DC2626]">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block whitespace-nowrap text-[8.5px] font-bold leading-3">{label}</span>
      <span className="block text-[15px] font-black leading-4 tabular-nums">{count}</span>
    </span>
    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-65 transition group-hover:translate-x-0.5" />
  </Link>;
}
