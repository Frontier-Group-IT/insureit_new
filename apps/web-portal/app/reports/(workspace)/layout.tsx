import type { ReactNode } from "react";
import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportWorkspaceNavigation } from "@/components/reports/report-workspace-navigation";
import { DailyReportHeaderScopes, DailyReportHeaderPeriod } from "@/components/reports/daily-report-header-controls";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canViewDailyReportAll } from "@/lib/reports/daily-report-access";
import {
  ReportsNavigationPendingProvider,
  ReportsPendingContent,
} from "@/components/reports/reports-navigation-pending";

export default async function ReportsWorkspaceLayout({ children }: { children: ReactNode }) {
  const {profile}=await getAuthenticatedProfile(await getServerAccessToken());
  const canViewAll=profile?.is_active ? await canViewDailyReportAll(profile) : false;
  return (
    <AppShell title="Reports">
      <ReportsNavigationPendingProvider>
        <div className="reports-reference-shell report-page-shell mx-auto max-w-[1560px] pb-8">
          <header className="reports-reference-header" aria-label="Reports">
            <div className="reports-reference-topbar">
              <div className="reports-reference-left">
                <div className="reports-reference-heading">
                  <span className="daily-report-heading-icon" aria-hidden="true"><ChartNoAxesColumnIncreasing size={23} strokeWidth={2.8}/></span>
                  <h1>Reports</h1>
                </div>
                <ReportWorkspaceNavigation />
                <DailyReportHeaderScopes canViewAll={canViewAll} />
              </div>
              <div className="flex items-center gap-2">
                <DailyReportHeaderPeriod />
                <div id="reports-workspace-toolbar" className="reports-reference-toolbar reports-overview-reference" />
              </div>
            </div>
          </header>
          <ReportsPendingContent>{children}</ReportsPendingContent>
        </div>
      </ReportsNavigationPendingProvider>
    </AppShell>
  );
}
