import Link from "next/link";

const tabs = [
  { href: "/partner/reports", label: "Overview" },
  { href: "/partner/reports/business", label: "Business" },
  { href: "/partner/reports/portfolio", label: "Portfolio" },
  { href: "/partner/reports/operations", label: "Operations" },
] as const;

export function PartnerReportTabs({ active }: { active: typeof tabs[number]["label"] }) {
  return (
    <nav aria-label="Reports sections" className="flex max-w-full gap-1 overflow-x-auto border-b border-[#DEE6F1]">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} prefetch={false} aria-current={tab.label === active ? "page" : undefined}
          className={`shrink-0 border-b-2 px-4 py-3 text-[13px] font-semibold transition ${tab.label === active ? "border-[#2469CB] text-[#175BB2]" : "border-transparent text-[#647795] hover:text-[#1B4B90]"}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
