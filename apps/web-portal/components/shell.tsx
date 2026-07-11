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
          : "none";

  return (
    <ClaimManagerShell title={resolvedTitle} activeNav={activeNav}>
      <div className="space-y-5 pb-8 pt-3">{children}</div>
    </ClaimManagerShell>
  );
}

export function PageHeader({ action }: { title: string; description?: string; action?: ReactNode }) {
  return action ? <div className="mb-6 flex justify-end">{action}</div> : null;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#DCE7F5] bg-white p-5 shadow-[0_8px_22px_rgba(7,29,73,0.04)] ${className}`}>{children}</section>;
}
