import type { ReactNode } from "react";
import { PartnerReportTabs } from "@/components/partner-portal/partner-report-tabs";
import type { PartnerReportScope } from "@/lib/reports/partner-report-scope";
type Tab = "Overview" | "Business" | "Portfolio" | "Operations";
/** Presentation only. Data remains in account-scoped Partner RPCs, never employee/admin loaders. */
export function PartnerReportsShell({ active, scope, children }: { active: Tab; scope: PartnerReportScope; children: ReactNode }) {
  const label = scope.role === "group" || scope.role === "group_associate" ? "Assigned group" : scope.role === "branch" ? "Your branch" : "Assigned partner";
  return <main className="reports-reference-shell report-page-shell mx-auto max-w-[1560px] min-h-screen space-y-3 bg-[#F6F8FC] px-3 pb-24 pt-3 text-[#11254A] sm:px-5 lg:ml-[268px] lg:pb-8">
    <header className="reports-reference-header" aria-label="Reports">
      <div className="reports-reference-topbar">
        <div className="reports-reference-left">
          <div className="reports-reference-heading"><h1>Reports</h1></div>
          <PartnerReportTabs active={active}/>
        </div>
        <div className="reports-reference-toolbar"><span className="rounded-lg border border-[#DCE5F2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#536889]">{label}</span>
        </div>
      </div>
    </header>
    {children}
  </main>;
}
