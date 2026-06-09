import type { ReactNode } from "react";
import Link from "next/link";
import { navItems } from "./data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-76 border-r border-white/10 bg-navy-900 text-white shadow-2xl lg:block">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-black text-navy-900">CB</div>
            <div>
              <div className="text-2xl font-bold tracking-tight">ClaimBridge CV</div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-green-300">Claims command center</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
            <p className="text-xs text-navy-100">Today&apos;s settlement pipeline</p>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-2xl font-bold">₹18.4L</span>
              <span className="rounded-full bg-green-400/20 px-2 py-1 text-xs font-semibold text-green-200">+12%</span>
            </div>
          </div>
        </div>
        <nav className="space-y-1 px-4 py-5">
          {navItems.map(([label, href, icon]) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-xs text-green-200 group-hover:bg-green-400/20">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="rounded-2xl bg-white/10 p-4 text-sm ring-1 ring-white/10">
            <p className="font-semibold text-white">Secure document vault</p>
            <p className="mt-1 text-xs leading-5 text-navy-100">Private Supabase storage for claim files and evidence.</p>
          </div>
        </div>
      </aside>
      <div className="lg:pl-76">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-success">Admin Portal</p>
              <h1 className="text-xl font-semibold text-navy-900">Commercial vehicle claim operations</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-green-200 sm:inline-flex">RLS protected</span>
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 sm:inline-flex">Live workspace</span>
              <div className="h-10 w-10 rounded-full bg-navy-700 text-center text-sm font-bold leading-10 text-white">CB</div>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map(([label, href, icon]) => (
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

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">ClaimBridge CV</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 md:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}
