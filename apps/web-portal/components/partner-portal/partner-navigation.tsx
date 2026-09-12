"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeIndianRupee,
  BriefcaseBusiness,
  ClipboardList,
  FileInput,
  Gauge,
  LifeBuoy,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";

type PartnerNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconShellClass?: string;
  iconClass?: string;
};

const primaryItems: PartnerNavItem[] = [
  { href: "/partner", label: "Home", icon: Gauge, iconShellClass: "bg-[#EAF2FF]", iconClass: "text-[#2F6BFF]" },
  { href: "/partner/business", label: "My Business", icon: BriefcaseBusiness, iconShellClass: "bg-[#F0ECFF]", iconClass: "text-[#7656E8]" },
  { href: "/partner/customers", label: "Customers", icon: UsersRound, iconShellClass: "bg-[#E7F8F4]", iconClass: "text-[#18A884]" },
  { href: "/partner/policies", label: "Policies", icon: ShieldCheck, iconShellClass: "bg-[#EEF4FF]", iconClass: "text-[#386DDC]" },
  { href: "/partner/renewals", label: "Renewals", icon: RefreshCw, iconShellClass: "bg-[#F2ECFF]", iconClass: "text-[#8A5BE8]" },
  { href: "/partner/claims", label: "Claims", icon: ClipboardList, iconShellClass: "bg-[#FFF0F4]", iconClass: "text-[#E34D7A]" },
  { href: "/partner/policy-intakes", label: "Policy Intake", icon: FileInput, iconShellClass: "bg-[#FFF4E7]", iconClass: "text-[#E9902D]" },
];

const secondaryItems: PartnerNavItem[] = [
  { href: "/partner/payout", label: "Payout", icon: BadgeIndianRupee, iconShellClass: "bg-[#FFF5DF]", iconClass: "text-[#D89000]" },
  { href: "/partner/network", label: "Network", icon: Network, iconShellClass: "bg-[#EAF2FF]", iconClass: "text-[#2F6BFF]" },
  { href: "/partner/search", label: "Search", icon: Search, iconShellClass: "bg-[#E9F8FC]", iconClass: "text-[#2396B5]" },
  { href: "/partner/activity", label: "Activity", icon: Activity, iconShellClass: "bg-[#EAF8EF]", iconClass: "text-[#2D9A62]" },
];

const accountItems: PartnerNavItem[] = [
  { href: "/partner/account", label: "Account", icon: UserRound, iconShellClass: "bg-[#F1ECFF]", iconClass: "text-[#7656E8]" },
  { href: "/partner/support", label: "Support", icon: LifeBuoy, iconShellClass: "bg-[#EAF6FF]", iconClass: "text-[#2A83C7]" },
];

function isActive(pathname: string, href: string) {
  if (href === "/partner") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item }: { item: PartnerNavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition-all duration-200 ease-out hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active ? "bg-white text-[#141d3b]" : "text-white/88 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl shadow-[0_2px_8px_rgba(6,20,48,0.12)] ${item.iconShellClass ?? "bg-[#EAF2FF]"}`}>
        <Icon className={`h-4 w-4 ${item.iconClass ?? "text-[#2F6BFF]"}`} />
      </span>
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function NavGroup({ label, items }: { label: string; items: PartnerNavItem[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
      <div className="space-y-1.5">
        {items.map((item) => <NavLink key={item.href} item={item} />)}
      </div>
    </div>
  );
}

export function PartnerNavigation() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[268px] overflow-hidden border-r border-white/10 bg-[#111a35] text-white shadow-[20px_0_60px_rgba(17,26,53,0.22)] lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-14 h-52 w-52 rounded-full bg-[#6759ff]/25 blur-3xl" />
        <div className="absolute -right-20 bottom-20 h-56 w-56 rounded-full bg-[#17c7c9]/15 blur-3xl" />
        <div className="portal-noise absolute inset-0 opacity-20" />
      </div>
      <Link href="/partner" className="relative flex h-[78px] items-center border-b border-white/10 px-5" aria-label="INSUREIT Partner home">
        <BrandLockup compact inverse />
      </Link>
      <nav className="relative flex-1 overflow-y-auto px-3.5 py-4" aria-label="Partner workspace navigation">
        <NavGroup label="Partner Workspace" items={primaryItems} />
        <NavGroup label="Commercial" items={secondaryItems} />
        <NavGroup label="Account" items={accountItems} />
      </nav>
    </aside>
  );
}

export const partnerMobileItems = [
  primaryItems[0],
  primaryItems[3],
  primaryItems[4],
  primaryItems[5],
  { href: "/partner/account", label: "More", icon: UserRound },
] satisfies PartnerNavItem[];
