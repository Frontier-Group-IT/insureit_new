import type { ReactNode } from "react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { getPartnerWebSession } from "@/lib/partner-web";
import { PartnerNavigation } from "./partner-navigation";
import { PartnerMobileNavigation } from "./partner-mobile-navigation";
import { PartnerBottomNavigation } from "./partner-bottom-navigation";

export async function PartnerPortalShell({ title, children, headerVariant = "default" }: { title: string; children: ReactNode; headerVariant?: "default" | "breadcrumb" }) {
  const accessToken = await getServerAccessToken();
  const [{ user, profile }, partnerSession] = await Promise.all([
    getAuthenticatedProfile(accessToken),
    getPartnerWebSession(),
  ]);

  const displayName = partnerSession.identity.display_name;
  const breadcrumbHeader = headerVariant === "breadcrumb";

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#10213D]">
      <PartnerNavigation />

      <div className="lg:pl-[268px]">
        <header className={breadcrumbHeader ? "sticky top-0 z-40 border-b border-[#D8E1EC] bg-[linear-gradient(90deg,#EEF7FF_0%,#FFFFFF_22%,#FFFFFF_100%)]" : "sticky top-0 z-40 border-b border-[#D8E1EC] bg-white/92 backdrop-blur-xl"}>
          <div className={breadcrumbHeader ? "flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6" : "flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6"}>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <PartnerMobileNavigation />
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#526C91]/60 to-transparent sm:block lg:hidden" />
              <div className="min-w-0 flex-1">
                <p className={breadcrumbHeader ? "text-[9px] font-black uppercase tracking-[0.16em] text-[#637795]" : "text-[9px] font-black uppercase tracking-[0.16em] text-[#637795]"}>Partner Workspace</p>
                <div className={breadcrumbHeader ? "flex min-w-0 items-center gap-2.5" : "flex min-w-0 items-center gap-2"}>
                  <h1 className={breadcrumbHeader ? "truncate text-[16px] font-extrabold tracking-[-0.01em] text-[#0F2A4D] sm:text-[18px]" : "truncate text-[15px] font-extrabold tracking-[-0.01em] text-[#152746] sm:text-[17px]"}>{title}</h1>
                  {breadcrumbHeader ? (
                    <>
                      <span className="hidden text-[15px] font-semibold text-[#7D8DA4] sm:inline">›</span>
                      <span className="hidden text-[12px] font-medium text-[#637795] sm:inline">{displayName}</span>
                    </>
                  ) : (
                    <span className="hidden text-[11px] font-semibold text-[#637795] sm:inline">• {displayName}</span>
                  )}
                </div>
              </div>
            </div>
            <div className={breadcrumbHeader ? "border-l border-[#526C91]/35 pl-3 sm:pl-4" : "border-l border-[#526C91]/35 pl-1.5 sm:pl-2"}>
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
