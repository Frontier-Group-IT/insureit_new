import type { ReactNode } from "react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";

export async function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const resolvedTitle = title ?? "InsureIt";
  const normalizedTitle = resolvedTitle.toLowerCase();

  const activeNav = normalizedTitle.includes("intermediar") || normalizedTitle.includes("distribution") || normalizedTitle.includes("posp") || normalizedTitle.includes("misp")
    ? "distribution"
    : normalizedTitle.includes("employee") || normalizedTitle.includes("customer") || normalizedTitle.includes("kyc") || normalizedTitle.includes("vehicle") || normalizedTitle.includes("polic")
      ? "master-data"
      : normalizedTitle.includes("claim")
        ? "claims"
        : normalizedTitle.includes("task")
          ? "tasks"
          : normalizedTitle.includes("report")
            ? "reports"
            : normalizedTitle.includes("dashboard")
              ? "dashboard"
              : "none";

  return (
    <ClaimManagerShell title={resolvedTitle} activeNav={activeNav}>
      <div className="ui-page-stage relative isolate space-y-4 pb-7">{children}</div>
    </ClaimManagerShell>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <section className="ui-page-hero overflow-hidden rounded-[26px] border border-white/70 bg-white/72 px-5 py-4 shadow-[0_22px_60px_rgba(35,39,90,0.10)] backdrop-blur-xl sm:px-6">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ui-eyebrow">InsureIT workspace</p>
          <h1 className="mt-1 font-display text-[clamp(1.35rem,2.4vw,2rem)] font-semibold tracking-[-0.035em] text-[#161936]">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-[11.5px] leading-5 text-[#6C738A]">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`ui-glass-panel rounded-[22px] border border-white/75 bg-white/78 p-4 shadow-[0_18px_50px_rgba(37,39,92,0.075)] backdrop-blur-xl ${className}`}>{children}</section>;
}
