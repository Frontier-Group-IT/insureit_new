"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckSquare2, Gauge, Menu, ShieldCheck, UsersRound } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/claims", label: "Claims", icon: ShieldCheck },
  { href: "/customers", label: "Customers", icon: UsersRound },
  { href: "/tasks", label: "Tasks", icon: CheckSquare2 },
  { href: "/settings", label: "More", icon: Menu },
];

export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 rounded-[22px] border border-white/70 bg-[#111a35]/94 p-1.5 text-white shadow-[0_22px_60px_rgba(15,24,52,.34)] backdrop-blur-2xl md:hidden" aria-label="Mobile quick navigation">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[16px] px-1 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#8b7fff]/40 ${active ? "bg-white text-[#17213e] shadow-[0_8px_20px_rgba(0,0,0,.2)]" : "text-white/62"}`}>
            <Icon className={`h-[19px] w-[19px] ${active ? "text-[#6759ff]" : "text-white/70"}`} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
