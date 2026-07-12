"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type SectionKey = "claims" | "master-data" | "tasks" | "reports";
type ActiveNav = "dashboard" | SectionKey | "none";
type Item = { href: string; label: string; count?: number };

type Props = {
  activeNav: ActiveNav;
  customerCount: number;
};

const sections: Array<{ key: SectionKey; label: string; icon: string; items: Item[] }> = [
  {
    key: "claims",
    label: "Claims",
    icon: "▤",
    items: [
      { href: "/claims", label: "All Claims" },
      { href: "/claims?stage=documents", label: "Documents" },
      { href: "/claims?stage=verification", label: "Verification" },
      { href: "/claims?stage=survey", label: "Survey" },
      { href: "/claims?stage=repair", label: "Repair" },
      { href: "/claims?stage=settlement", label: "Settlement" }
    ]
  },
  {
    key: "master-data",
    label: "Master Data",
    icon: "▦",
    items: [
      { href: "/customers", label: "Customers" },
      { href: "/vehicles", label: "Vehicles" },
      { href: "/policies", label: "Policies" }
    ]
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "✓",
    items: [
      { href: "/tasks", label: "My Tasks" },
      { href: "/tasks?view=team", label: "Team Tasks" },
      { href: "/tasks?status=completed", label: "Completed" }
    ]
  },
  {
    key: "reports",
    label: "Reports",
    icon: "▥",
    items: [
      { href: "/reports", label: "Overview" },
      { href: "/reports?view=claims", label: "Claims Reports" },
      { href: "/reports?view=operations", label: "Operations" }
    ]
  }
];

export function AppNavigation({ activeNav, customerCount }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openSection, setOpenSection] = useState<SectionKey | null>(activeNav === "dashboard" || activeNav === "none" ? null : activeNav);

  useEffect(() => {
    if (activeNav !== "dashboard" && activeNav !== "none") setOpenSection(activeNav);
  }, [activeNav]);

  const currentQuery = searchParams.toString();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[244px] border-r border-[#262B55] bg-[#15183B] text-white lg:flex lg:flex-col">
      <Link href="/dashboard" className="flex h-14 items-center gap-3 border-b border-white/10 px-4" aria-label="InsureIt home">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7067E8] text-[11px] font-bold tracking-wide shadow-[0_5px_16px_rgba(74,65,190,0.3)]">IT</span>
        <div><p className="text-[13px] font-semibold tracking-wide">INSUREIT</p><p className="text-[9px] text-white/50">Operations workspace</p></div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <Link href="/dashboard" className={`mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-[12px] font-semibold transition ${activeNav === "dashboard" ? "bg-[#7067E8] text-white shadow-[0_5px_16px_rgba(74,65,190,0.3)]" : "text-white/72 hover:bg-white/10 hover:text-white"}`}>
          <span className="grid w-5 place-items-center text-[16px]">⌂</span><span>Dashboard</span>
        </Link>

        <p className="mb-1 mt-4 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">Workspace</p>
        <div className="space-y-1">
          {sections.map((section) => {
            const open = openSection === section.key;
            const active = activeNav === section.key;
            return (
              <div key={section.key} className={`overflow-hidden rounded-lg border transition ${active ? "border-white/12 bg-white/[0.06]" : "border-transparent"}`}>
                <button type="button" onClick={() => setOpenSection((current) => current === section.key ? null : section.key)} className={`flex h-10 w-full items-center gap-3 px-3 text-left text-[12px] font-semibold transition ${active ? "text-white" : "text-white/72 hover:bg-white/10 hover:text-white"}`} aria-expanded={open}>
                  <span className={`grid h-6 w-6 place-items-center rounded-md text-[15px] ${active ? "bg-[#7067E8]" : "bg-white/[0.06]"}`}>{section.icon}</span>
                  <span className="flex-1">{section.label}</span>
                  <span className={`text-[11px] text-white/45 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                </button>
                {open ? <div className="space-y-0.5 px-2 pb-2 pl-11">
                  {section.items.map((item) => {
                    const count = item.href === "/customers" ? customerCount : item.count;
                    const itemActive = isCurrent(item.href, pathname, currentQuery);
                    return <Link key={item.href} href={item.href} className={`flex min-h-8 items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${itemActive ? "bg-white text-[#242653] shadow-sm" : "text-white/58 hover:bg-white/10 hover:text-white"}`}>
                      <span>{item.label}</span>{typeof count === "number" ? <span className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold ${itemActive ? "bg-[#EEF2FF] text-[#4F46E5]" : "bg-white/10 text-white/70"}`}>{count}</span> : null}
                    </Link>;
                  })}
                </div> : null}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link href="/settings" className="flex h-10 items-center gap-3 rounded-lg px-3 text-[12px] font-semibold text-white/68 transition hover:bg-white/10 hover:text-white"><span className="grid w-5 place-items-center text-[15px]">⚙</span><span>Settings</span></Link>
      </div>
    </aside>
  );
}

function isCurrent(href: string, pathname: string, currentQuery: string) {
  const [targetPath, targetQuery = ""] = href.split("?");
  if (pathname !== targetPath) return false;
  if (!targetQuery) return !currentQuery;
  const expected = new URLSearchParams(targetQuery);
  const current = new URLSearchParams(currentQuery);
  return Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
}
