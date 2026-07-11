import type { ReactNode } from "react";
import Link from "next/link";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { navItems } from "./data";
import { HeaderTitle } from "./header-title";
import { UserMenu } from "./user-menu";
import { canManageMasterData, canManageUsers, canViewOrganizationTree } from "@/lib/roles";

const masterDataLabels = new Set(["Customers", "Vehicles", "Policies"]);

export async function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const accessToken = await getServerAccessToken();
  const { user, profile } = await getAuthenticatedProfile(accessToken);
  const visibleNavItems = navItems.filter(([label]) => {
    if (masterDataLabels.has(label)) return canManageMasterData(profile?.role);
    if (label === "Users") return canManageUsers(profile?.role);
    if (label === "Organization") return canViewOrganizationTree(profile?.role);
    return true;
  });
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-76 border-r border-white/10 bg-navy-900 text-white shadow-2xl lg:block">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black text-navy-900">II</div>
            <div>
              <div className="text-2xl font-bold tracking-tight">InsureIt</div>
            </div>
          </div>
        </div>
        <nav className="space-y-1 px-4 py-5">
          {visibleNavItems.map(([label, href, icon]) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs text-green-200 group-hover:bg-green-400/20">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-76">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <HeaderTitle title={title} />
            <UserMenu profile={profile} user={user ? { id: user.id, email: user.email } : null} />
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleNavItems.map(([label, href, icon]) => (
              <Link key={href} href={href} className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                <span className="mr-1 text-green-700">{icon}</span>{label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ action }: { title: string; description?: string; action?: ReactNode }) {
  return action ? <div className="mb-6 flex justify-end">{action}</div> : null;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}
