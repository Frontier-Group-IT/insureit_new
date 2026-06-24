import type { ReactNode } from "react";
import Link from "next/link";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";

type Props = {
  title: string;
  backHref?: string;
  children: ReactNode;
};

export async function ClaimManagerShell({ title, backHref = "/dashboard", children }: Props) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);

  return (
    <div className="min-h-screen bg-[#eef4fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:px-8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={backHref} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-2xl font-black text-[#071D49] shadow-sm" aria-label="Back">
              ‹
            </Link>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-white pr-2">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#EAF3FF] text-2xl font-black text-[#071D49] shadow-inner">II</div>
              <div className="leading-none">
                <p className="text-[26px] font-black tracking-tight text-[#071D49]">InsureIT</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#174EA6]">Claim Desk</p>
              </div>
            </div>
            <h1 className="hidden truncate text-[28px] font-black text-[#071D49] md:block">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative grid h-11 w-11 place-items-center rounded-full bg-[#F4F8FF] text-xl shadow-sm" type="button" aria-label="Notifications">
              🔔
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#E5484D] ring-2 ring-white" />
            </button>
            <UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} />
          </div>
        </div>
        <div className="mx-auto mt-3 block max-w-[1440px] md:hidden">
          <h1 className="truncate text-2xl font-black text-[#071D49]">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-5 lg:px-8 lg:py-7">{children}</main>
      <nav className="sticky bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 text-center text-xs font-black text-slate-500">
          <Link href="/dashboard" className="rounded-xl px-2 py-2 text-[#174EA6]">⌂<span className="mt-1 block">Home</span></Link>
          <Link href="/claims" className="rounded-xl px-2 py-2">▦<span className="mt-1 block">Claims</span></Link>
          <Link href="/timeline" className="rounded-xl px-2 py-2">◴<span className="mt-1 block">Timeline</span></Link>
          <Link href="/profile" className="rounded-xl px-2 py-2">◉<span className="mt-1 block">Profile</span></Link>
        </div>
      </nav>
    </div>
  );
}
