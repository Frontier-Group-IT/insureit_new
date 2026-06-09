import type { ReactNode } from "react";
import Link from "next/link";
import { navItems } from "./data";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-navy-900 text-white lg:block">
        <div className="px-6 py-6">
          <div className="text-2xl font-bold tracking-tight">ClaimBridge CV</div>
          <p className="mt-2 text-sm text-navy-100">Commercial vehicle claim assistance</p>
        </div>
        <nav className="space-y-1 px-4">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-success">Admin Portal</p>
              <h1 className="text-xl font-semibold text-navy-900">ClaimBridge CV</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">Secure workspace</span>
              <div className="h-10 w-10 rounded-full bg-navy-700 text-center text-sm font-bold leading-10 text-white">CB</div>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
            {navItems.map(([label, href]) => (
              <Link key={href} href={href} className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                {label}
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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-soft ${className}`}>{children}</section>;
}
