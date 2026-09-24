"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = [
  { href: "/reports", label: "Overview", match: (p: string) => p === "/reports" },
  { href: "/reports/business", label: "Business", match: (p: string) => ["/reports/business", "/reports/distribution", "/reports/finance"].some((x) => p.startsWith(x)) },
  { href: "/reports/renewals", label: "Portfolio", match: (p: string) => p.startsWith("/reports/renewals") },
  { href: "/reports/operations", label: "Operations", match: (p: string) => p.startsWith("/reports/operations") },
];

const BUSINESS = [
  { href: "/reports/business", label: "Performance" },
  { href: "/reports/distribution", label: "Distribution" },
  { href: "/reports/finance", label: "Finance" },
];

export function ReportWorkspaceNavigation() {
  const pathname = usePathname() || "/reports";
  const inBusiness = ["/reports/business", "/reports/distribution", "/reports/finance"].some((x) => pathname.startsWith(x));

  return (
    <>
      <nav className="reports-reference-tabs" aria-label="Report workspaces">
        {PRIMARY.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              prefetch={false}
              href={item.href}
              className={`reports-reference-tab ${active ? "reports-reference-tab--active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {inBusiness ? (
        <nav className="reports-reference-subtabs" aria-label="Business report views">
          {BUSINESS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                prefetch={false}
                href={item.href}
                className={`reports-reference-subtab ${active ? "reports-reference-subtab--active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
