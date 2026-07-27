import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Bell, Sparkles } from "lucide-react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { HistoryBackButton } from "@/components/history-back-button";
import { AppNavigation } from "@/components/claim-manager/app-navigation";
import { MobileNavigation } from "@/components/claim-manager/mobile-navigation";
import { MobileBottomNavigation } from "@/components/claim-manager/mobile-bottom-navigation";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
  activeNav?: "dashboard" | "claims" | "master-data" | "distribution" | "tasks" | "reports" | "none";
};

export async function ClaimManagerShell({ title, backHref = "/dashboard", children, activeNav = "claims" }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);

  return (
    <div className="min-h-screen text-[#10213D]">
      <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[268px] bg-[#111A35] lg:block" />}>
        <AppNavigation activeNav={activeNav} />
      </Suspense>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-40 border-b border-[#8FA4C3]/30 bg-[linear-gradient(110deg,rgba(231,238,249,0.86),rgba(219,229,245,0.74),rgba(255,255,255,0.66))] shadow-[0_12px_34px_rgba(23,43,78,0.08)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[linear-gradient(110deg,rgba(231,238,249,0.72),rgba(219,229,245,0.62),rgba(255,255,255,0.56))]">
          <div className="flex min-h-[66px] items-center justify-between gap-2 px-2.5 py-2 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <MobileNavigation />
              <div className="hidden sm:block"><HistoryBackButton fallbackHref={backHref} /></div>
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#7F94B3]/55 to-transparent sm:block" />
              <div className="min-w-0"><h1 className="truncate font-[var(--font-display)] text-[15px] font-semibold tracking-[-0.035em] text-[#102A52] sm:text-[18px]">{title}</h1></div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Link href="/customers/posp-misp" aria-label="Quick onboard" title="Quick onboard" className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] px-2.5 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(103,89,255,.24)] hover:-translate-y-0.5 sm:px-3.5 sm:text-[11px]"><Sparkles className="h-3.5 w-3.5" /><span className="hidden sm:inline">Quick onboard</span><span className="sm:hidden">Onboard</span></Link>

              <Link href="/notifications" aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/65 bg-white/62 text-[#263956] shadow-[0_8px_24px_rgba(28,39,68,.07)] backdrop-blur-xl hover:border-[#9FAEE0] hover:text-[#6759ff]">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#ff6f61] ring-2 ring-white" />
              </Link>

              <div className="border-l border-[#90A2BD]/35 pl-1.5 sm:pl-2"><UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} /></div>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-66px)] overflow-hidden px-2.5 pb-24 pt-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><div className="absolute -right-28 top-8 h-72 w-72 rounded-full bg-[#6759ff]/7 blur-3xl" /><div className="absolute left-[12%] top-[38%] h-64 w-64 rounded-full bg-[#17c7c9]/6 blur-3xl" /></div>
          <div className="relative animate-portal-enter">{children}</div>
        </main>
      </div>

      <MobileBottomNavigation />
    </div>
  );
}
