import type { ReactNode } from "react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { getPartnerWebSession } from "@/lib/partner-web";
import { PartnerNavigation } from "./partner-navigation";
import { PartnerMobileNavigation } from "./partner-mobile-navigation";
import { PartnerBottomNavigation } from "./partner-bottom-navigation";
import { PartnerBreadcrumbs } from "./partner-breadcrumbs";

export async function PartnerPortalShell({ title, children, headerVariant = "default" }: { title: string; children: ReactNode; headerVariant?: "default" | "breadcrumb" }) {
  const accessToken = await getServerAccessToken();
  const [{ user, profile }] = await Promise.all([
    getAuthenticatedProfile(accessToken),
    getPartnerWebSession(),
  ]);

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <PartnerNavigation />

      <div className="lg:pl-[268px]">
        <header
          data-partner-header-variant={headerVariant}
          className="sticky top-0 z-40 border-b border-[#C9D8E8] bg-[linear-gradient(90deg,#DCEBFA_0%,#EEF5FC_48%,#F7FAFD_100%)]"
        >
          <div className="flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <PartnerMobileNavigation />
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#526C91]/60 to-transparent sm:block lg:hidden" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <PartnerBreadcrumbs title={title} />
              </div>
            </div>
            <div className="shrink-0 border-l border-[#526C91]/35 pl-2 sm:pl-4">
              <UserMenu
                profile={profile}
                user={user ? { id: user.id, email: user.email } : null}
                homeHref="/partner"
              />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-66px)] px-3 pb-24 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:px-7 lg:py-6">
          <div className="mx-auto w-full max-w-[1480px] animate-portal-enter">{children}</div>
        </main>
      </div>

      <PartnerBottomNavigation />
    </div>
  );
}
