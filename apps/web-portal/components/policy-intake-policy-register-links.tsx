"use client";

import Link from "next/link";
import { AlertTriangle, Clock3 } from "lucide-react";
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
    <div className="flex shrink-0 items-center gap-1">
      {summary.actionRequired !== null ? <PolicyIntakeQuickLink
        href="/policy-intakes?view=action"
        label="Action Required"
        count={summary.actionRequired}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      /> : null}
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
  const active = count > 0;
  const tone = active ? "text-[#C62828]" : "text-[#64748B]";

  return <Link
    prefetch={false}
    href={href}
    aria-label={`${label}: ${count}. Open Policy Intakes.`}
    className={`group inline-flex h-11 min-w-[122px] items-center gap-2 rounded-xl px-2.5 transition-[background-color,box-shadow] duration-150 hover:bg-[#EEF2F7] hover:shadow-sm hover:ring-1 hover:ring-inset hover:ring-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#CBD5E1]/60 ${tone}`}
  >
    <span className="grid h-6 w-6 shrink-0 place-items-center">{icon}</span>
    <span className="whitespace-nowrap text-[8.5px] font-bold leading-3">{label}</span>
    <span className="ml-auto shrink-0 text-[15px] font-black leading-4 tabular-nums">{count}</span>
  </Link>;
}
