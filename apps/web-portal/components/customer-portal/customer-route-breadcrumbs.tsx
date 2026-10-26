"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, House } from "lucide-react";

const labels: Record<string, string> = {
  home: "Home",
  vehicles: "Vehicles",
  policies: "Policies",
  renewals: "Renewals",
  claims: "Claims",
  exchange: "Exchange",
  "insurance-quote": "Insurance Quote",
  quote: "Insurance Quote",
  "e-challan": "E-Challan",
  challan: "E-Challan",
  support: "Support",
  profile: "Profile",
  settings: "Settings",
  kyc: "KYC",
  notifications: "Notifications",
  "start-claim": "Start Claim",
  "add-vehicle": "Add Vehicle",
  "add-policy": "Add Policy",
  "spot-intimation": "Spot Intimation",
  stage: "Stage",
  new: "New",
  edit: "Edit",
  documents: "Documents",
  renewal: "Renewal",
};

function routeItems(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const items: { label: string; href?: string }[] = [{ label: "Home", href: "/customer/home" }];
  if (!segments.length || (segments.length === 1 && segments[0] === "home")) return [{ label: "Home" }];
  let accumulated = "/customer";
  segments.forEach((segment, index) => {
    accumulated += `/${segment}`;
    const isLast = index === segments.length - 1;
    const isIdentifier = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d+$/.test(segment);
    const label = isIdentifier
      ? "Details"
      : labels[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    items.push({ label, href: isLast ? undefined : accumulated });
  });
  return items;
}

export function CustomerRouteBreadcrumbs() {
  const pathname = usePathname();
  const items = routeItems(pathname);
  const visibleItems = items.length > 4 ? [items[0], { label: "…" }, ...items.slice(-2)] : items;


  return (
    <nav data-customer-route-breadcrumbs="true" aria-label="Customer page path" className="flex min-w-0 items-center gap-2 overflow-hidden text-[13px] font-semibold sm:gap-3 sm:text-[14px]">
      {visibleItems.map((item, index) => {
        const current = index === visibleItems.length - 1;
        const home = index === 0;
        const content = (
          <>
            {home ? <House className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{item.label === "Start Claim" ? "Start a Claim" : item.label}</span>
          </>
        );
        return (
          <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2 sm:gap-3">
            {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-[#7E87A4]" aria-hidden="true" /> : null}
            {item.href && !current ? (
              <Link href={item.href} prefetch={false} className="inline-flex min-w-0 items-center gap-2 text-[#677391] transition hover:text-[#633BF5]">{content}</Link>
            ) : (
              <span aria-current={current ? "page" : undefined} className={`inline-flex min-w-0 items-center gap-2 ${current ? "text-[#633BF5]" : "text-[#677391]"}`}>{content}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
