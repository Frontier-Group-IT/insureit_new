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
    <div className="min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <PartnerNavigation />

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-[#D8E1EC] bg-white/92 backdrop-blur-xl">
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

        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
          <div className="mx-auto w-full max-w-[1480px] animate-portal-enter">{children}</div>
        </main>
      </div>

      <PartnerBottomNavigation />
    </div>
  );
}
