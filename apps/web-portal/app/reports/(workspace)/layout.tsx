import type { ReactNode } from "react";
import { AppShell } from "@/components/shell";
import { ReportWorkspaceNavigation } from "@/components/reports/report-workspace-navigation";
import {
  ReportsNavigationPendingProvider,
  ReportsPendingContent,
} from "@/components/reports/reports-navigation-pending";

export default function ReportsWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell title="Reports">
      <ReportsNavigationPendingProvider>
        <div className="reports-reference-shell report-page-shell mx-auto max-w-[1560px] pb-8">
          <header className="reports-reference-header" aria-label="Reports">
            <div className="reports-reference-topbar">
              <div className="reports-reference-left">
                <div className="reports-reference-heading">
                  <h1>Reports</h1>
                </div>
                <ReportWorkspaceNavigation />
              </div>
              <div
                id="reports-workspace-toolbar"
                className="reports-reference-toolbar reports-overview-reference"
              />
            </div>
          </header>
          <ReportsPendingContent>{children}</ReportsPendingContent>
        </div>
      </ReportsNavigationPendingProvider>
    </AppShell>
  );
}
