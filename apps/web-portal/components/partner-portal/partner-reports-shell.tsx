import type { ReactNode } from "react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerReportTabs } from "@/components/partner-portal/partner-report-tabs";
import type { PartnerReportScope } from "@/lib/reports/partner-report-scope";
type Tab = "Overview" | "Business";
/** Presentation only. Data remains in account-scoped Partner RPCs, never employee/admin loaders. */
export function PartnerReportsShell({ active, scope, children }: { active: Tab; scope: PartnerReportScope; children: ReactNode }) {
  const label = scope.role === "group" || scope.role === "group_associate" ? "Assigned group" : scope.role === "branch" ? "Your branch" : "Assigned partner";
  return <PartnerPortalShell title={active === "Overview" ? "Reports" : "Business Reports"}>
    <div className="reports-reference-shell report-page-shell mx-auto w-full max-w-[1560px] space-y-3 bg-[#F6F8FC] text-[#11254A]">
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
    </div>
  </PartnerPortalShell>;
}
