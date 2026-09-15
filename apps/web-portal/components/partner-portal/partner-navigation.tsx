"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PartnerCustomIcon, type PartnerCustomIconName } from "./partner-custom-icon";

type PartnerNavItem = {
  href: string;
  label: string;
  icon: PartnerCustomIconName;
};

const primaryItems: PartnerNavItem[] = [
  { href: "/partner", label: "Home", icon: "home" },
  { href: "/partner/business", label: "My Business", icon: "business" },
  { href: "/partner/customers", label: "Customers", icon: "customers" },
  { href: "/partner/policies", label: "Policies", icon: "policies" },
  { href: "/partner/renewals", label: "Renewals", icon: "renewals" },
  { href: "/partner/claims", label: "Claims", icon: "claims" },
  { href: "/partner/policy-intakes", label: "Policy Intake", icon: "policy-intake" },
];

const secondaryItems: PartnerNavItem[] = [
  { href: "/partner/payout", label: "Payout", icon: "payout" },
  { href: "/partner/network", label: "Network", icon: "network" },
  { href: "/partner/search", label: "Search", icon: "search" },
  { href: "/partner/activity", label: "Activity", icon: "activity" },
];

const accountItems: PartnerNavItem[] = [
  { href: "/partner/account", label: "Account", icon: "account" },
  { href: "/partner/support", label: "Support", icon: "support" },
];

function isActive(pathname: string, href: string) {
  if (href === "/partner") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item }: { item: PartnerNavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[12px] font-bold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active
          ? "bg-white text-[#141d3b] shadow-[0_3px_12px_rgba(5,18,45,0.12)]"
          : "text-white/88 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200 ${
          active ? "bg-[#EAF1FF]" : "group-hover:bg-white/8"
        }`}
      >
        <PartnerCustomIcon name={item.icon} size={22} className="h-[22px] w-[22px]" />
      </span>
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function RenewalsNav({ item }: { item: PartnerNavItem }) {
  const pathname = usePathname();
  const renewalsActive = pathname === "/partner/renewals" || pathname.startsWith("/partner/renewals/");
  const [open, setOpen] = useState(renewalsActive);

  useEffect(() => {
    if (renewalsActive) setOpen(true);
  }, [renewalsActive]);

  const internalActive = pathname === "/partner/renewals";
  const externalActive = pathname.startsWith("/partner/renewals/external");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`group flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[12px] font-bold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
          renewalsActive
            ? "bg-white text-[#141d3b] shadow-[0_3px_12px_rgba(5,18,45,0.12)]"
            : "text-white/88 hover:bg-white/8 hover:text-white"
        }`}
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200 ${renewalsActive ? "bg-[#EAF1FF]" : "group-hover:bg-white/8"}`}>
          <PartnerCustomIcon name={item.icon} size={22} className="h-[22px] w-[22px]" />
        </span>
        <span className="flex-1">Renewals</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="ml-[29px] mt-1.5 border-l border-white/35 pl-4">
          <div className="space-y-1">
            <Link
              href="/partner/renewals"
              prefetch={false}
              className={`block rounded-lg px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
                internalActive ? "bg-white/14 text-white" : "text-white/72 hover:bg-white/8 hover:text-white"
              }`}
            >
              Internal Renewal
            </Link>
            <Link
              href="/partner/renewals/external"
              prefetch={false}
              className={`block rounded-lg px-3 py-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
                externalActive ? "bg-white/14 text-white" : "text-white/72 hover:bg-white/8 hover:text-white"
              }`}
            >
              External Renewal
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavGroup({ label, items }: { label: string; items: PartnerNavItem[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
      <div className="space-y-1.5">
        {items.map((item) => item.href === "/partner/renewals" ? <RenewalsNav key={item.href} item={item} /> : <NavLink key={item.href} item={item} />)}
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
  { href: "/partner/account", label: "More", icon: "account" },
] satisfies PartnerNavItem[];
