"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { partnerMobileItems } from "./partner-navigation";

export function PartnerBottomNavigation() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-[80] grid grid-cols-5 rounded-[22px] border border-[#273454] bg-[#111A35] p-1.5 shadow-[0_22px_60px_rgba(15,24,52,.42)] md:hidden"
      aria-label="Partner mobile quick navigation"
    >
      {partnerMobileItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/partner" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[10px] font-bold ${
              active ? "bg-white text-[#17213e]" : "text-[#D7DDF0]"
            }`}
          >
            <Icon className={`h-[19px] w-[19px] ${active ? "text-[#6759ff]" : "text-[#F4F7FF]"}`} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
