import type { ReactNode } from "react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";

export async function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const resolvedTitle = title ?? "InsureIt";
  const normalizedTitle = resolvedTitle.toLowerCase();

  const activeNav = normalizedTitle.includes("customer") || normalizedTitle.includes("vehicle") || normalizedTitle.includes("polic")
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
      <div className="space-y-3 pb-5">{children}</div>
    </ClaimManagerShell>
  );
}

export function PageHeader({ action }: { title: string; description?: string; action?: ReactNode }) {
  return action ? <div className="mb-3 flex justify-end">{action}</div> : null;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#DDE3EC] bg-white p-3 shadow-[0_2px_8px_rgba(16,24,40,0.035)] ${className}`}>{children}</section>;
}
