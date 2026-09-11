"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Compass } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const topLevelLabels: Record<string, string> = {
  business: "My Business",
  customers: "Customers",
  policies: "Policies",
  renewals: "Renewals",
  claims: "Claims",
  "policy-intakes": "Policy Intake",
  payout: "Payout",
  network: "Network",
  search: "Search",
  activity: "Activity",
  account: "Account",
  profile: "Profile",
  support: "Support",
};

function fallbackLabel(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBreadcrumbs(pathname: string, currentTitle: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const partnerSegments = segments[0] === "partner" ? segments.slice(1) : segments;
  const items: BreadcrumbItem[] = [{ label: "Dashboard", href: "/partner" }];

  if (partnerSegments.length === 0) {
    items.push({ label: "Home" });
    return items;
  }

  const [section, detail, ...rest] = partnerSegments;
  const sectionLabel = topLevelLabels[section] ?? fallbackLabel(section);
  const sectionHref = `/partner/${section}`;
  items.push({ label: sectionLabel, href: partnerSegments.length > 1 ? sectionHref : undefined });

  if (!detail) return items;

  if (section === "renewals" && detail === "external") {
    items.push({ label: "External Opportunities" });
    return items;
  }

  if (section === "policy-intakes" && detail === "new") {
    items.push({ label: "New Intake" });
    return items;
  }

  if (section === "account" && detail === "registration") {
    items.push({ label: "Registration" });
    return items;
  }

  const detailLabels: Record<string, string> = {
    customers: "Customer Details",
    policies: "Policy Details",
    claims: "Claim Details",
    "policy-intakes": "Intake Details",
  };

  const detailLabel = detailLabels[section] ?? (rest.length === 0 ? currentTitle : fallbackLabel(detail));
  items.push({ label: detailLabel, href: rest.length > 0 ? `${sectionHref}/${detail}` : undefined });

  if (rest.length > 0) {
    items.push({ label: currentTitle || fallbackLabel(rest[rest.length - 1]) });
  }

  return items;
}

export function PartnerBreadcrumbs({ title }: { title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = getBreadcrumbs(pathname, title);

  return (
    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2" data-partner-route-breadcrumbs="true">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Go back"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#C9D8EA] bg-[#E7F0FB] text-[#26466D] transition hover:bg-[#DCE9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7CF6]/25"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#AEC4DF] bg-white/70 text-[#355679]" aria-hidden="true">
        <Compass className="h-4 w-4" />
      </span>

      <nav aria-label="Partner page path" className="flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-2">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          const pillClass = "relative inline-flex h-9 min-w-0 items-center rounded-xl border border-[#AFC3DC] bg-[#EDF4FC] px-3 text-[12px] font-semibold text-[#183659] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full before:bg-[#2D8CFF] sm:px-4 sm:text-[13px]";

          return (
            <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {index > 0 ? (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 text-[#6F86A3]" aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {item.href && !current ? (
                <Link href={item.href} prefetch={false} className={`${pillClass} transition hover:bg-[#E3EEF9]`}>
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span className={pillClass} aria-current={current ? "page" : undefined}>
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
