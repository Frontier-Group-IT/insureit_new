"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = [
  { href: "/reports", label: "Overview", match: (p: string) => p === "/reports" },
  { href: "/reports/business", label: "Business", match: (p: string) => p.startsWith("/reports/business") },
  { href: "/reports/renewals", label: "Portfolio", match: (p: string) => p.startsWith("/reports/renewals") },
  { href: "/reports/operations", label: "Operations", match: (p: string) => p.startsWith("/reports/operations") },
];

export function ReportWorkspaceNavigation() {
  const pathname = usePathname() || "/reports";

  return (
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
  );
}
