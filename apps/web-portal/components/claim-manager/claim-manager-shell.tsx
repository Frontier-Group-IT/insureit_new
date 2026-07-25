import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Bell, Command, Search, Sparkles } from "lucide-react";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { HistoryBackButton } from "@/components/history-back-button";
import { AppNavigation } from "@/components/claim-manager/app-navigation";
import { BrandLockup } from "@/components/brand-lockup";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
  activeNav?: "dashboard" | "claims" | "master-data" | "tasks" | "reports" | "none";
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
        <header className="sticky top-0 z-40 border-b border-white/70 bg-white/76 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/68">
          <div className="flex h-[66px] items-center justify-between gap-4 px-3 sm:px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <HistoryBackButton fallbackHref={backHref} />
              <div className="hidden sm:block lg:hidden"><BrandLockup compact /></div>
              <div className="hidden h-7 w-px bg-gradient-to-b from-transparent via-[#ccd4e2] to-transparent sm:block" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate font-[var(--font-display)] text-[17px] font-semibold tracking-[-0.035em] text-[#12203B]">{title}</h1>
                  <span className="hidden rounded-full border border-[#dcd8ff] bg-[#f1efff] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#6759ff] xl:inline-flex">Live</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="group relative hidden xl:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8793A8] group-focus-within:text-[#6759ff]" />
                <input
                  aria-label="Global search"
                  placeholder="Search records..."
                  className="h-9 w-64 rounded-xl border border-[#dbe2ec] bg-white/82 py-1 pl-9 pr-14 text-[11px] text-[#10213D] shadow-[0_8px_24px_rgba(28,39,68,.05)]"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md border border-[#dfe4ec] bg-[#f7f9fc] px-1.5 py-0.5 text-[8px] font-bold text-[#7b879a]"><Command className="h-2.5 w-2.5" />K</span>
              </label>

              <Link href="/customers/posp-misp" className="hidden h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] px-3.5 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(103,89,255,.24)] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(103,89,255,.3)] md:inline-flex">
                <Sparkles className="h-3.5 w-3.5" /> Quick onboard
              </Link>

              <Link href="/notifications" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-xl border border-[#dbe2ec] bg-white/90 text-[#263956] shadow-[0_8px_24px_rgba(28,39,68,.05)] hover:-translate-y-0.5 hover:border-[#c9c2ff] hover:text-[#6759ff]">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff6f61] ring-2 ring-white" />
              </Link>

              <div className="ml-1 border-l border-[#dde3ec] pl-2">
                <UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} />
              </div>
            </div>
          </div>
        </header>

        <main className="relative min-h-[calc(100vh-66px)] overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-28 top-8 h-72 w-72 rounded-full bg-[#6759ff]/7 blur-3xl" />
            <div className="absolute left-[12%] top-[38%] h-64 w-64 rounded-full bg-[#17c7c9]/6 blur-3xl" />
          </div>
          <div className="relative animate-portal-enter">{children}</div>
        </main>
      </div>
    </div>
  );
}
