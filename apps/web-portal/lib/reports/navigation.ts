export type ReportWorkspaceKey = "overview" | "business" | "portfolio" | "claims" | "operations";

export type ReportWorkspace = {
  key: ReportWorkspaceKey;
  label: string;
  href: string;
  routes: string[];
  sections?: Array<{ label: string; href: string }>;
};

export const reportWorkspaces: ReportWorkspace[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/reports",
    routes: ["/reports", "/reports/management-pack", "/reports/management-pack/archive"],
  },
  {
    key: "business",
    label: "Business",
    href: "/reports/business",
    routes: ["/reports/business", "/reports/distribution", "/reports/finance"],
    sections: [
      { label: "Performance", href: "/reports/business" },
      { label: "Distribution", href: "/reports/distribution" },
      { label: "Finance", href: "/reports/finance" },
    ],
  },
  {
    key: "portfolio",
    label: "Portfolio",
    href: "/reports/renewals",
    routes: ["/reports/renewals"],
  },
  {
    key: "claims",
    label: "Claims",
    href: "/reports/claims",
    routes: ["/reports/claims"],
  },
  {
    key: "operations",
    label: "Operations",
    href: "/reports/operations",
    routes: ["/reports/operations", "/reports/readiness"],
    sections: [
      { label: "Compliance", href: "/reports/operations" },
      { label: "Data Quality", href: "/reports/readiness" },
    ],
  },
];

export function reportWorkspaceForPath(pathname: string): ReportWorkspaceKey | null {
  if (pathname === "/reports") return "overview";

  const matches = reportWorkspaces
    .flatMap((workspace) => workspace.routes.map((route) => ({ workspace, route })))
    .filter(({ route }) => route !== "/reports" && (pathname === route || pathname.startsWith(`${route}/`)))
    .sort((a, b) => b.route.length - a.route.length);

  return matches[0]?.workspace.key ?? null;
}

export function reportWorkspace(key: ReportWorkspaceKey | null) {
  return reportWorkspaces.find((workspace) => workspace.key === key) ?? null;
}
