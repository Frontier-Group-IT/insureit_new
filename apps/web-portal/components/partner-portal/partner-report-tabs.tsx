import Link from "next/link";

const tabs = [
  { href: "/partner/reports", label: "Overview" },
  { href: "/partner/reports/business", label: "Business" },
  { href: "/partner/reports/portfolio", label: "Portfolio" },
  { href: "/partner/reports/operations", label: "Operations" },
] as const;

export function PartnerReportTabs({ active }: { active: typeof tabs[number]["label"] }) {
  return (
    <nav aria-label="Reports sections" className="reports-reference-tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} prefetch={false} aria-current={tab.label === active ? "page" : undefined}
          className={`reports-reference-tab ${tab.label === active ? "reports-reference-tab--active" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
