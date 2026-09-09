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
      {summary.actionRequired !== null ? <PolicyIntakeQuickLink
        href="/policy-intakes?view=action"
        label="Action Required"
        count={summary.actionRequired}
        tone="danger"
        icon={<AlertTriangle className="h-4 w-4" />}
      /> : null}
      <PolicyIntakeQuickLink
        href="/policy-intakes?view=in_review"
        label="In Review"
        count={summary.inReview}
        tone="review"
        icon={<Clock3 className="h-4 w-4" />}
      />
    </div>,
    host,
  );
}

type PolicyIntakeQuickLinkTone = "danger" | "review";

function PolicyIntakeQuickLink({ href, label, count, icon, tone }: { href: string; label: string; count: number; icon: ReactNode; tone: PolicyIntakeQuickLinkTone }) {
  const active = count > 0;
  const styles = tone === "danger"
    ? active
      ? {
          container: "border-[#FCA5A5] bg-[#FFF6F6] text-[#B91C1C] shadow-[0_5px_16px_rgba(220,38,38,0.10)] hover:border-[#F87171] hover:bg-[#FFF0F0] hover:shadow-[0_8px_22px_rgba(220,38,38,0.17)]",
          icon: "bg-[#FEE2E2] text-[#B91C1C]",
          divider: "bg-[#FECACA]",
        }
      : {
          container: "border-[#FECACA] bg-[#FFFBFB] text-[#9F1239] hover:border-[#FCA5A5] hover:bg-[#FFF6F6] hover:shadow-[0_7px_18px_rgba(220,38,38,0.10)]",
          icon: "bg-[#FFF1F2] text-[#BE123C]",
          divider: "bg-[#FFE4E6]",
        }
    : active
      ? {
          container: "border-[#F6C66A] bg-[#FFF8EA] text-[#B45309] shadow-[0_5px_16px_rgba(217,119,6,0.10)] hover:border-[#F2B84B] hover:bg-[#FFF3D9] hover:shadow-[0_8px_22px_rgba(217,119,6,0.16)]",
          icon: "bg-[#FEF0C7] text-[#B45309]",
          divider: "bg-[#FDE7B0]",
        }
      : {
          container: "border-[#FDE7B0] bg-[#FFFCF5] text-[#92400E] hover:border-[#F6C66A] hover:bg-[#FFF8EA] hover:shadow-[0_7px_18px_rgba(217,119,6,0.10)]",
          icon: "bg-[#FFF7E1] text-[#B45309]",
          divider: "bg-[#FEEDC7]",
        };

  return <Link
    prefetch={false}
    href={href}
    aria-label={`${label}: ${count}. Open Policy Intakes.`}
    className={`group inline-flex h-11 min-w-[136px] items-center rounded-2xl border px-2.5 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-1 ${styles.container}`}
  >
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105 ${styles.icon}`}>{icon}</span>
    <span aria-hidden="true" className={`mx-2 h-6 w-px shrink-0 ${styles.divider}`} />
    <span className="min-w-0 flex-1">
      <span className="block whitespace-nowrap text-[9px] font-extrabold leading-3">{label}</span>
      <span className="block text-[17px] font-black leading-[18px] tabular-nums">{count}</span>
    </span>
    <ChevronRight className="ml-1 h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5" />
  </Link>;
}
