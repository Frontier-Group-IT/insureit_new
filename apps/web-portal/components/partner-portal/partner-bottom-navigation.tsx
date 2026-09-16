"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PartnerCustomIcon } from "./partner-custom-icon";
import { partnerMobileItems } from "./partner-navigation";

export function PartnerBottomNavigation({ hideAccount = false }: { hideAccount?: boolean }) {
  const pathname = usePathname();
  const items = hideAccount
    ? partnerMobileItems.map((item) => item.href === "/partner/account"
      ? { ...item, href: "/partner/support", label: "More", icon: "support" as const }
      : item)
    : partnerMobileItems;

  return (
    <nav
      className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-[80] grid grid-cols-5 rounded-[18px] border border-[#273454] bg-[#111A35] p-1.5 shadow-[0_22px_60px_rgba(15,24,52,.42)] md:hidden"
      aria-label="Partner mobile quick navigation"
    >
      {items.map((item) => {
        const active = item.href === "/partner" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              active ? "bg-white text-[#17213e]" : "text-[#D7DDF0]"
            }`}
          >
            <PartnerCustomIcon name={item.icon} size={22} className="h-[22px] w-[22px]" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
