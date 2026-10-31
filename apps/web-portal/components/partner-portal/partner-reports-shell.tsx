import type { ReactNode } from "react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerReportTabs } from "@/components/partner-portal/partner-report-tabs";
import type { PartnerReportScope } from "@/lib/reports/partner-report-scope";
type Tab = "Overview" | "Business";
/** Presentation only. Data remains in account-scoped Partner RPCs, never employee/admin loaders. */
export function PartnerReportsShell({ active, scope, toolbar, children }: { active: Tab; scope: PartnerReportScope; toolbar?: ReactNode; children: ReactNode }) {
  return <PartnerPortalShell title={active === "Overview" ? "Reports" : "Business Reports"}>
    <div className="reports-reference-shell report-page-shell mx-auto w-full max-w-[1560px] space-y-2 bg-[#F6F8FC] text-[#11254A]">
    <header className="reports-reference-header" aria-label="Reports">
      <div className="reports-reference-topbar !flex !flex-wrap !items-center !gap-3 !border-0 !pb-0">
        <div className="reports-reference-left !flex !shrink-0 !items-center">
          <PartnerReportTabs active={active}/>
        </div>
        {toolbar ? <div className="reports-reference-toolbar !ml-auto !min-w-0 !flex-1 !justify-end">{toolbar}</div> : null}
      </div>
    </header>
    {children}
    </div>
  </PartnerPortalShell>;
}
