"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare2, Gauge, Menu, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import {
  MOBILE_NAVIGATION_EVENT,
  permits,
  sectionForPath,
  type SectionKey,
} from "@/components/claim-manager/app-navigation";
import { isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import type { Capability } from "@/lib/roles";
import type { PermissionAccess } from "@/lib/permission-management";

type QuickItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  capability: Capability;
  section?: SectionKey;
  exact?: boolean;
};

const standardCandidates: QuickItem[] = [
  { href: "/dashboard", label: "Home", icon: Gauge, capability: "view_dashboard", exact: true },
  { href: "/claims", label: "Claims", icon: ShieldCheck, capability: "view_claims", section: "claims" },
  { href: "/intermediaries", label: "Intermediary", icon: Sparkles, capability: "view_intermediaries", section: "distribution" },
  { href: "/customers", label: "Customers", icon: UsersRound, capability: "view_customers", section: "master-data" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2, capability: "view_tasks", section: "tasks" },
];

const intermediaryCandidates: QuickItem[] = [
  { href: "/intermediaries", label: "Overview", icon: Sparkles, capability: "view_intermediaries", exact: true },
  { href: "/intermediaries/partner", label: "Partners", icon: UsersRound, capability: "view_intermediaries", exact: true },
  { href: "/intermediaries/posp", label: "POSP", icon: UsersRound, capability: "view_intermediaries", exact: true },
  { href: "/intermediaries/misp", label: "MISP", icon: UsersRound, capability: "view_intermediaries", exact: true },
];

export function MobileBottomNavigation({
  role: _role,
  permissionAccess,
}: {
  role: string | null | undefined;
  permissionAccess: Partial<Record<Capability, PermissionAccess>>;
}) {
  const pathname = usePathname();
  const routeSection = sectionForPath(pathname);
  const candidates = isIntermediaryOnlyLaunch ? intermediaryCandidates : standardCandidates;
  const primaryItems = candidates.filter((item) => permits(permissionAccess, item.capability)).slice(0, 4);

  function isActive(item: QuickItem) {
    if (item.section) return routeSection === item.section;
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const anyPrimaryActive = primaryItems.some(isActive);
  const moreActive = !anyPrimaryActive;

  function openMore() {
    window.dispatchEvent(new Event(MOBILE_NAVIGATION_EVENT));
  }

  return (
    <nav
      className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-[80] grid rounded-[22px] border border-[#273454] bg-[#0B1430]/[0.98] p-1.5 shadow-[0_22px_60px_rgba(15,24,52,.42)] backdrop-blur-xl md:hidden"
      style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1},minmax(0,1fr))` }}
      aria-label="Mobile quick navigation"
    >
      {primaryItems.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[9.5px] font-bold ${
              active ? "bg-white/[0.10] text-white" : "text-[#C8D0E6]"
            }`}
          >
            {active ? <span className="absolute top-1 h-[3px] w-5 rounded-full bg-gradient-to-r from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
            <Icon className={`h-[19px] w-[19px] ${active ? "text-[#B5AEFF]" : "text-[#EEF2FF]"}`} />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={openMore}
        aria-current={moreActive ? "page" : undefined}
        aria-label="Open all navigation"
        className={`relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[9.5px] font-bold ${
          moreActive ? "bg-white/[0.10] text-white" : "text-[#C8D0E6]"
        }`}
      >
        {moreActive ? <span className="absolute top-1 h-[3px] w-5 rounded-full bg-gradient-to-r from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
        <Menu className={`h-[19px] w-[19px] ${moreActive ? "text-[#B5AEFF]" : "text-[#EEF2FF]"}`} />
        <span>More</span>
      </button>
    </nav>
  );
}
