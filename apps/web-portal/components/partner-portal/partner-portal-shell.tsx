import type { ReactNode } from "react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { getPartnerWebSession } from "@/lib/partner-web";
import { PartnerNavigation } from "./partner-navigation";
import { PartnerMobileNavigation } from "./partner-mobile-navigation";
import { PartnerBottomNavigation } from "./partner-bottom-navigation";

export async function PartnerPortalShell({ title, children }: { title: string; children: ReactNode }) {
  const accessToken = await getServerAccessToken();
  const [{ user, profile }, partnerSession] = await Promise.all([
    getAuthenticatedProfile(accessToken),
    getPartnerWebSession(),
  ]);

  const displayName = partnerSession.identity.display_name;

  return (
    <div className="min-h-screen text-[#10213D]">
      <PartnerNavigation />

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-[#476184]/35 bg-[linear-gradient(110deg,rgba(188,203,224,0.88),rgba(203,215,232,0.82),rgba(230,236,245,0.72))] shadow-[0_12px_36px_rgba(18,40,75,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[linear-gradient(110deg,rgba(167,187,215,0.74),rgba(198,212,231,0.68),rgba(226,234,245,0.60))]">
          <div className="flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <PartnerMobileNavigation />
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#526C91]/60 to-transparent sm:block lg:hidden" />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#637795]">Partner Workspace</p>
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-[#152746] sm:text-[17px]">{title}</h1>
                  <span className="hidden text-[11px] font-semibold text-[#637795] sm:inline">• {displayName}</span>
                </div>
              </div>
            </div>
            <div className="border-l border-[#526C91]/35 pl-1.5 sm:pl-2">
              <UserMenu
                profile={profile}
                user={user ? { id: user.id, email: user.email } : null}
                homeHref="/partner"
              />
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-66px)] overflow-hidden px-2.5 pb-24 pt-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -right-28 top-8 h-72 w-72 rounded-full bg-[#6759ff]/7 blur-3xl" />
            <div className="absolute left-[12%] top-[38%] h-64 w-64 rounded-full bg-[#17c7c9]/6 blur-3xl" />
          </div>
          <div className="relative animate-portal-enter">{children}</div>
        </main>
      </div>

      <PartnerBottomNavigation />
    </div>
  );
}
