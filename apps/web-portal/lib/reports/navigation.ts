export type ReportFamilyKey = "executive" | "business" | "portfolio" | "operations" | "controls";

export type ReportDestination = {
  key: string;
  label: string;
  href: string;
  family: ReportFamilyKey;
  governanceOnly?: boolean;
};

export type ReportFamily = {
  key: ReportFamilyKey;
  label: string;
  destinations: ReportDestination[];
};

export const reportFamilies: ReportFamily[] = [
  {
    key: "executive",
    label: "Executive",
    destinations: [
      { key: "management-pack", label: "Management Pack", href: "/reports/management-pack", family: "executive" },
      { key: "archive", label: "Month-End Archive", href: "/reports/management-pack/archive", family: "executive" },
    ],
  },
  {
    key: "business",
    label: "Business",
    destinations: [
      { key: "business-performance", label: "Business Performance", href: "/reports/business", family: "business" },
      { key: "distribution", label: "Distribution", href: "/reports/distribution", family: "business" },
      { key: "finance", label: "Finance", href: "/reports/finance", family: "business" },
    ],
  },
  {
    key: "portfolio",
    label: "Portfolio & Service",
    destinations: [
      { key: "renewals", label: "Renewals", href: "/reports/renewals", family: "portfolio" },
      { key: "claims", label: "Claims", href: "/reports/claims", family: "portfolio" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    destinations: [
      { key: "operations-compliance", label: "Compliance & Operations", href: "/reports/operations", family: "operations" },
    ],
  },
  {
    key: "controls",
    label: "Controls",
    destinations: [
      { key: "readiness", label: "Readiness", href: "/reports/readiness", family: "controls" },
      { key: "governance", label: "Governance", href: "/reports/governance", family: "controls", governanceOnly: true },
    ],
  },
];

export function visibleReportFamilies(canViewGovernance: boolean): ReportFamily[] {
  return reportFamilies
    .map((family) => ({
      ...family,
      destinations: family.destinations.filter((destination) => !destination.governanceOnly || canViewGovernance),
    }))
    .filter((family) => family.destinations.length > 0);
}

export function reportFamilyForPath(pathname: string): ReportFamilyKey | null {
  for (const family of reportFamilies) {
    if (family.destinations.some((destination) => pathname === destination.href || pathname.startsWith(`${destination.href}/`))) {
      return family.key;
    }
  }
  return null;
}
