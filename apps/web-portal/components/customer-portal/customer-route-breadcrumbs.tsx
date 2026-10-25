"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Compass } from "lucide-react";

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
  const items: { label: string; href?: string }[] = [{ label: "Dashboard", href: "/customer/home" }];
  if (!segments.length) return [{ label: "Dashboard" }];
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
  const startClaim = pathname === "/customer/start-claim";
  const router = useRouter();
  const items = startClaim ? [{label:"Home",href:"/customer/home"},{label:"Start a Claim"}] : routeItems(pathname);
  const visibleItems = items.length > 4 ? [items[0], { label: "…" }, ...items.slice(-2)] : items;
  const pillClass = "relative inline-flex h-9 max-w-[220px] min-w-0 items-center rounded-xl border border-[#E2E8F0] bg-[#F2F6FC] px-3 text-xs font-semibold text-[#203F64] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-[3px] before:rounded-r-full before:bg-[#2F91FF]/85 sm:px-4 sm:text-[13px]";

  if (startClaim) return <nav aria-label="Customer page path" className="flex min-w-0 items-center gap-3 text-[13px] font-semibold sm:text-[14px]"><Link href="/customer/home" className="inline-flex items-center gap-2 text-[#677391] hover:text-[#633BF5]"><span className="text-[17px]" aria-hidden="true">⌂</span> Home</Link><ChevronRight className="h-4 w-4 text-[#7E87A4]" aria-hidden="true"/><span aria-current="page" className="truncate text-[#633BF5]">Start a Claim</span></nav>;

  return (
    <div data-customer-route-breadcrumbs="true" className="flex min-w-0 items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) router.back();
          else router.push("/customer/home");
        }}
        aria-label="Go back"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] text-[#35557C] transition hover:bg-[#EDF3FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5A96E8]/20"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <span className="hidden h-7 w-px bg-[#D5DDE8] sm:block" aria-hidden="true" />
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#E2E8F0] bg-[#F7F9FC] text-[#456486]" aria-hidden="true">
        <Compass className="h-4 w-4" />
      </span>
      <nav aria-label="Customer page path" className="flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-2">
        {visibleItems.map((item, index) => {
          const current = index === visibleItems.length - 1;
          return (
            <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {index > 0 ? (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F2F6FC] text-[#7C8FA8]" aria-hidden="true">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {item.href && !current ? (
                <Link href={item.href} prefetch={false} className={`${pillClass} transition hover:bg-[#E7F0FC]`}>
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
