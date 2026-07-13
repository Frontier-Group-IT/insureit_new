import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getManagerDashboardData } from "@/lib/manager-dashboard";
import { ActivityCenter } from "./activity-center";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const dashboard = await getManagerDashboardData(supabase);
  const activeRows = dashboard.activityFeed.filter((item) => item.status === "new" || item.status === "in_progress");

  return (
    <ClaimManagerShell title="Notifications" backHref="/dashboard">
      <div className="space-y-4 pb-8">
        <section className="rounded-2xl border border-[#DCE7F5] bg-white px-4 py-3 shadow-[0_8px_22px_rgba(7,29,73,0.04)]">
          <h1 className="text-[20px] font-medium tracking-tight text-[#071D49]">Activity center</h1>
          <p className="mt-0.5 text-[13px] font-normal text-[#68758A]">Customer updates, support replies, document uploads and handled activity.</p>
        </section>
        <ActivityCenter activeRows={activeRows} recentRows={dashboard.activityFeed} />
      </div>
    </ClaimManagerShell>
  );
}
