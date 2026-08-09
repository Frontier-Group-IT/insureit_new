import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { internalLaunchHome, isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { UserMenu } from "@/components/user-menu";
import { HistoryBackButton } from "@/components/history-back-button";
import { AppNavigation } from "@/components/claim-manager/app-navigation";
import { MobileNavigation } from "@/components/claim-manager/mobile-navigation";
import { MobileBottomNavigation } from "@/components/claim-manager/mobile-bottom-navigation";
import { HeaderRouteRail } from "@/components/claim-manager/header-route-rail";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
  activeNav?: "dashboard" | "claims" | "master-data" | "distribution" | "tasks" | "reports" | "none";
};

export async function ClaimManagerShell({ title, backHref = internalLaunchHome, children, activeNav = "claims" }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);
  const role = profile?.role;
  const permissionAccess = await getEffectivePermissionAccessMap(profile);
  const canViewNotifications = (permissionAccess.view_notifications ?? "none") !== "none";

  return (
    <div className="min-h-screen text-[#10213D]">
      <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[268px] bg-[#111A35] lg:block" />}>
        <AppNavigation activeNav={activeNav} role={role} permissionAccess={permissionAccess} />
      </Suspense>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-[#476184]/35 bg-[linear-gradient(110deg,rgba(188,203,224,0.88),rgba(203,215,232,0.82),rgba(230,236,245,0.72))] shadow-[0_12px_36px_rgba(18,40,75,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[linear-gradient(110deg,rgba(167,187,215,0.74),rgba(198,212,231,0.68),rgba(226,234,245,0.60))]">
          <div className="flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <MobileNavigation role={role} permissionAccess={permissionAccess} />
              <div className="hidden sm:block"><HistoryBackButton fallbackHref={backHref} /></div>
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#526C91]/60 to-transparent sm:block" />
              <div className="min-w-0 flex-1"><HeaderRouteRail title={title} /></div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!isIntermediaryOnlyLaunch && canViewNotifications ? <Link href="/notifications" prefetch={false} aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/55 bg-white/52 text-[#183456] shadow-[0_8px_24px_rgba(28,39,68,.10)] backdrop-blur-xl hover:border-[#7D91B4] hover:text-[#6759ff]">
                <Bell className="h-[18px] w-[18px]" />
              </Link> : null}

              <div className="border-l border-[#526C91]/35 pl-1.5 sm:pl-2"><UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} /></div>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-66px)] overflow-hidden px-2.5 pb-24 pt-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><div className="absolute -right-28 top-8 h-72 w-72 rounded-full bg-[#6759ff]/7 blur-3xl" /><div className="absolute left-[12%] top-[38%] h-64 w-64 rounded-full bg-[#17c7c9]/6 blur-3xl" /></div>
          <div className="relative animate-portal-enter">{children}</div>
        </main>
      </div>

      <MobileBottomNavigation role={role} permissionAccess={permissionAccess} />
    </div>
  );
}
