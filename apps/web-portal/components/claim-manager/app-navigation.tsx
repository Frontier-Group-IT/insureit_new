"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";

type SectionKey = "claims" | "master-data" | "tasks" | "reports";
type ActiveNav = "dashboard" | SectionKey | "none";
type Item = { href: string; label: string; count?: number };

type Props = {
  activeNav: ActiveNav;
  customerCount: number;
  kycApplicationCount: number;
};

const sections: Array<{ key: SectionKey; label: string; icon: string; items: Item[] }> = [
  { key: "claims", label: "Claims", icon: "▤", items: [{ href: "/claims", label: "All Claims" }, { href: "/claims?queue=documents", label: "Documents" }, { href: "/claims?journey=spot-intimation", label: "Verification" }, { href: "/claims?journey=spot-surveyor-assigned", label: "Survey" }, { href: "/claims?journey=under-repair", label: "Repair" }, { href: "/claims?journey=payment-advice-received", label: "Settlement" }] },
  { key: "master-data", label: "Master Data", icon: "▦", items: [{ href: "/employees", label: "Employees" }, { href: "/customers", label: "Customers" }, { href: "/customers/applications", label: "KYC Applications" }, { href: "/customers/posp-misp", label: "POSP / MISP Onboarding" }, { href: "/vehicles", label: "Vehicles" }, { href: "/policies", label: "Policies" }] },
  { key: "tasks", label: "Tasks", icon: "✓", items: [{ href: "/tasks", label: "All Tasks" }, { href: "/tasks?status=open", label: "Open" }, { href: "/tasks?status=in_progress", label: "In Progress" }, { href: "/tasks?status=completed", label: "Completed" }] },
  { key: "reports", label: "Reports", icon: "▥", items: [{ href: "/reports", label: "Portfolio Overview" }] }
];

export function AppNavigation({ activeNav, customerCount, kycApplicationCount }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openSection, setOpenSection] = useState<SectionKey | null>(activeNav === "dashboard" || activeNav === "none" ? null : activeNav);

  useEffect(() => {
    if (activeNav !== "dashboard" && activeNav !== "none") setOpenSection(activeNav);
  }, [activeNav]);

  const currentQuery = searchParams.toString();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[244px] border-r border-[#D7E6F5] bg-[#F4F9FF] text-[#071D49] shadow-[8px_0_28px_rgba(7,29,73,0.06)] lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex h-[72px] items-center border-b border-[#D7E6F5] px-4" aria-label="InsureIT home">
        <BrandLockup compact />
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <Link href="/dashboard" className={`mb-1 flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-bold transition ${activeNav === "dashboard" ? "bg-[#071D49] text-white shadow-[0_8px_18px_rgba(7,29,73,0.18)]" : "text-[#344B67] hover:bg-white hover:text-[#071D49]"}`}>
          <span className="grid w-5 place-items-center text-[16px]">⌂</span><span>Dashboard</span>
        </Link>

        <p className="mb-1 mt-4 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-[#8292AA]">Workspace</p>
        <div className="space-y-1">
          {sections.map((section) => {
            const open = openSection === section.key;
            const active = activeNav === section.key;
            return (
              <div key={section.key} className={`overflow-hidden rounded-xl border transition ${active ? "border-[#CFE2FF] bg-white shadow-sm" : "border-transparent"}`}>
                <button type="button" onClick={() => setOpenSection((current) => current === section.key ? null : section.key)} className={`flex h-10 w-full items-center gap-3 px-3 text-left text-[12px] font-bold transition ${active ? "text-[#071D49]" : "text-[#344B67] hover:bg-white hover:text-[#071D49]"}`} aria-expanded={open}>
                  <span className={`grid h-6 w-6 place-items-center rounded-lg text-[15px] ${active ? "bg-[#EAF3FF] text-[#0B63CE]" : "bg-white text-[#59687A]"}`}>{section.icon}</span>
                  <span className="flex-1">{section.label}</span>
                  <span className={`text-[11px] text-[#8292AA] transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                </button>
                {open ? <div className="space-y-0.5 px-2 pb-2 pl-11">
                  {section.items.map((item) => {
                    const count = item.href === "/customers" ? customerCount : item.href === "/customers/applications" ? kycApplicationCount : item.count;
                    const itemActive = isCurrent(item.href, pathname, currentQuery);
                    return <Link key={item.href} href={item.href} className={`flex min-h-8 items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${itemActive ? "bg-[#071D49] text-white shadow-sm" : "text-[#59687A] hover:bg-[#EAF3FF] hover:text-[#071D49]"}`}>
                      <span>{item.label}</span>{typeof count === "number" ? <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-bold ${itemActive ? "bg-white/15 text-white" : "bg-white text-[#0B63CE]"}`}>{count}</span> : null}
                    </Link>;
                  })}
                </div> : null}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[#D7E6F5] p-3">
        <Link href="/settings" className="flex h-10 items-center gap-3 rounded-xl px-3 text-[12px] font-bold text-[#59687A] transition hover:bg-white hover:text-[#071D49]"><span className="grid w-5 place-items-center text-[15px]">⚙</span><span>Settings</span></Link>
      </div>
    </aside>
  );
}

function isCurrent(href: string, pathname: string, currentQuery: string) {
  const [targetPath, targetQuery = ""] = href.split("?");
  const nestedWorkspaces = ["/employees", "/customers/applications", "/customers/posp-misp"];
  const nestedMatch = !targetQuery
    && nestedWorkspaces.includes(targetPath)
    && (pathname === targetPath || pathname.startsWith(`${targetPath}/`));
  if (pathname !== targetPath && !nestedMatch) return false;
  if (!targetQuery) {
    return nestedMatch || !currentQuery;
  }
  const expected = new URLSearchParams(targetQuery);
  const current = new URLSearchParams(currentQuery);
  return Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
}
