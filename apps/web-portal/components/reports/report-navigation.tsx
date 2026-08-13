"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { visibleReportFamilies, reportFamilyForPath, type ReportFamilyKey } from "@/lib/reports/navigation";

type Props = { canViewGovernance: boolean };

export function ReportNavigation({ canViewGovernance }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const families = visibleReportFamilies(canViewGovernance);
  const activeFamily = reportFamilyForPath(pathname);
  const activeDestinations = families.find((family) => family.key === activeFamily)?.destinations ?? [];
  const activeDestination = [...families.flatMap((family) => family.destinations)]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const mobileValue = pathname === "/reports" ? "/reports" : activeDestination?.href ?? "/reports";

  return (
    <div className="reports-nav-shell mb-4 print:hidden">
      <style>{`.reports-r1-content header nav{display:none!important}`}</style>
      <div className="portal-card overflow-hidden">
        <div className="hidden items-center gap-1 border-b border-[#e6ebf2] px-3 py-2 md:flex">
          <Link href="/reports" className={familyClass(pathname === "/reports")}>Overview</Link>
          {families.map((family) => (
            <Link key={family.key} href={family.destinations[0]?.href ?? "/reports"} className={familyClass(activeFamily === family.key)}>
              {family.label}
            </Link>
          ))}
        </div>

        <div className="p-3 md:hidden">
          <label className="block">
            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.08em] text-[#7b8799]">Reports</span>
            <select
              value={mobileValue}
              onChange={(event) => router.push(event.target.value)}
              className="h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-[11px] font-semibold text-[#26364f] outline-none focus:border-[#7788bd] focus:ring-2 focus:ring-[#dfe5ff]"
            >
              <option value="/reports">Overview</option>
              {families.map((family) => (
                <optgroup key={family.key} label={family.label}>
                  {family.destinations.map((destination) => <option key={destination.href} value={destination.href}>{destination.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {activeFamily ? (
          <div className="hidden items-center gap-1 overflow-x-auto px-3 py-2 md:flex">
            {activeDestinations.map((destination) => (
              <Link key={destination.href} href={destination.href} className={reportClass(activeDestination?.href === destination.href)}>
                {destination.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function familyClass(active: boolean) {
  return `whitespace-nowrap rounded-md px-3 py-2 text-[10.5px] font-bold transition ${active ? "bg-[#172a5c] text-white" : "text-[#536176] hover:bg-[#f2f5f9] hover:text-[#1f355f]"}`;
}

function reportClass(active: boolean) {
  return `whitespace-nowrap border-b-2 px-3 py-2 text-[10px] font-bold transition ${active ? "border-[#3156b8] text-[#1f3e7a]" : "border-transparent text-[#66748a] hover:text-[#263b69]"}`;
}

export type { ReportFamilyKey };
