import type { ReactNode } from "react";
import Link from "next/link";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
  activeNav?: "dashboard" | "claims" | "tasks" | "reports" | "more";
};

const logoUrl = "https://raw.githubusercontent.com/antnish1/insureit_new/main/apps/mobile-app/assets/brand/insureit-stitch-logo.png";

export async function ClaimManagerShell({ title, backHref = "/dashboard", children, activeNav = "claims" }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);

  return (
    <div className="min-h-screen bg-[#F7FAFE] text-[#071D49]">
      <header className="sticky top-0 z-30 border-b border-[#DFE7F2] bg-white shadow-[0_2px_12px_rgba(7,29,73,0.04)]">
        <div className="mx-auto flex h-[106px] max-w-[1560px] items-center justify-between px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-6">
            <Link href={backHref} className="flex h-12 w-12 shrink-0 items-center justify-center text-[44px] font-light leading-none text-[#071D49] transition hover:-translate-x-0.5" aria-label="Back">
              ‹
            </Link>
            <div className="flex shrink-0 items-center pr-2">
              <img src={logoUrl} alt="InsureIT" className="h-[82px] w-[300px] object-contain object-left" />
            </div>
            <div className="hidden h-[66px] w-px bg-[#D7DEE9] md:block" />
            <h1 className="hidden truncate text-[26px] font-black tracking-tight text-[#071D49] md:block">{title}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-8">
            <button className="group flex flex-col items-center gap-1 text-[#071D49]" type="button" aria-label="Notifications">
              <span className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[32px] shadow-[0_0_0_1px_rgba(7,29,73,0.08)] transition group-hover:bg-[#F1F6FF]">
                ♡
                <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full bg-[#E21D35] text-sm font-black text-white ring-2 ring-white">5</span>
              </span>
              <span className="text-sm font-semibold text-[#1E2A44]">Notifications</span>
            </button>
            <div className="flex flex-col items-center gap-1 text-sm font-semibold text-[#1E2A44]">
              <UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} />
              <span>Profile</span>
            </div>
          </div>
        </div>
        <div className="mx-auto block max-w-[1560px] px-6 pb-4 md:hidden">
          <h1 className="truncate text-2xl font-black text-[#071D49]">{title}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[1560px] px-6 py-5 lg:px-8">{children}</main>

      <nav className="sticky bottom-0 z-20 border-t border-[#DFE7F2] bg-white shadow-[0_-12px_30px_rgba(7,29,73,0.06)]">
        <div className="mx-auto grid h-[78px] max-w-[1320px] grid-cols-5 items-center text-center text-[13px] font-bold text-[#1E2A44]">
          <BottomNavItem href="/dashboard" icon="▦" label="Dashboard" active={activeNav === "dashboard"} />
          <BottomNavItem href="/claims" icon="♢" label="Claims" active={activeNav === "claims"} />
          <BottomNavItem href="/tasks" icon="▤" label="Tasks" active={activeNav === "tasks"} />
          <BottomNavItem href="/reports" icon="▥" label="Reports" active={activeNav === "reports"} />
          <BottomNavItem href="#" icon="•••" label="More" active={activeNav === "more"} />
        </div>
      </nav>
    </div>
  );
}

function BottomNavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex h-full flex-col items-center justify-center gap-1 transition ${active ? "text-[#003A83]" : "text-[#1E2A44]/80 hover:text-[#003A83]"}`}>
      <span className="text-[28px] leading-none">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
