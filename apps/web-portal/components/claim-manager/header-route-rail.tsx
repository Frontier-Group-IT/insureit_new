"use client";

import Link from "next/link";
import { ChevronRight, Compass, MoreHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";

type RouteItem = {
  label: string;
  href?: string;
};

const segmentLabels: Record<string, string> = {
  intermediaries: "Intermediatory",
  partners: "Partners",
  partner: "Partners",
  posp: "POSP",
  misp: "MISP",
  applications: "Applications",
  onboarding: "Onboarding",
  import: "Import batches",
  customers: "Customer data",
  claims: "Claims",
  dashboard: "Dashboard",
  employees: "Employees",
  vehicles: "Vehicles",
  policies: "Policies",
  reports: "Reports",
  settings: "Settings",
  notifications: "Notifications",
};

const explicitRoutes: Array<{ match: RegExp; items: RouteItem[] }> = [
  {
    match: /^\/intermediaries\/misp\/?$/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "MISP", href: "/intermediaries/misp" },
      { label: "MISP register" },
    ],
  },
  {
    match: /^\/intermediaries\/posp\/?$/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "POSP", href: "/intermediaries/posp" },
      { label: "POSP register" },
    ],
  },
  {
    match: /^\/intermediaries\/(partner|partners)\/?$/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Partners", href: "/intermediaries/partner" },
      { label: "Partner register" },
    ],
  },
  {
    match: /^\/intermediaries\/?$/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Overview" },
    ],
  },
  {
    match: /^\/customers\/posp-misp\/new/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Onboarding", href: "/customers/posp-misp" },
      { label: "New application" },
    ],
  },
  {
    match: /^\/intermediaries\/applications\/[^/]+/,
    items: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Applications", href: "/customers/posp-misp" },
      { label: "Application review" },
    ],
  },
];

function titleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildRoute(pathname: string, title: string): RouteItem[] {
  const explicit = explicitRoutes.find((route) => route.match.test(pathname));
  if (explicit) return explicit.items;

  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return [{ label: title || "Dashboard" }];

  const visibleSegments = segments.filter((segment) => !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment));
  let accumulated = "";
  const items: RouteItem[] = visibleSegments.map((segment, index) => {
    accumulated += `/${segment}`;
    const isLast = index === visibleSegments.length - 1;
    return {
      label: segmentLabels[segment] ?? titleCase(segment),
      href: isLast ? undefined : accumulated,
    };
  });

  if (items.length && title && items.at(-1)?.label.toLowerCase() !== title.toLowerCase()) {
    items.push({ label: title });
  }
  return items;
}

export function HeaderRouteRail({ title }: { title: string }) {
  const pathname = usePathname();
  const items = buildRoute(pathname, title);
  const compactItems: RouteItem[] = items.length > 4 ? [items[0], { label: "…" }, ...items.slice(-2)] : items;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 overflow-hidden">
        <li className="hidden shrink-0 sm:block" aria-hidden="true">
          <span className="grid h-7 w-7 place-items-center rounded-xl border border-white/60 bg-white/45 text-[#536B91] shadow-[0_6px_18px_rgba(28,39,68,.08)] backdrop-blur-xl">
            <Compass className="h-3.5 w-3.5" />
          </span>
        </li>
        {compactItems.map((item, index) => {
          const current = index === compactItems.length - 1;
          const isEllipsis = item.label === "…";
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span className="relative mx-0.5 flex w-4 shrink-0 items-center justify-center text-[#8090A8]" aria-hidden="true">
                  <span className="absolute h-px w-3 bg-gradient-to-r from-[#9BAAC0]/25 via-[#7488A7]/70 to-[#9BAAC0]/25" />
                  <ChevronRight className="relative h-3 w-3 rounded-full bg-[#D5E0EE] p-[1px] text-[#49617F]" />
                </span>
              ) : null}
              {isEllipsis ? (
                <span className="grid h-7 w-8 shrink-0 place-items-center rounded-lg border border-white/45 bg-white/30 text-[#70829D]">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </span>
              ) : item.href && !current ? (
                <Link
                  href={item.href}
                  prefetch={false}
                  className="group relative shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-[#536783] transition hover:bg-white/55 hover:text-[#4338CA]"
                >
                  <span className="relative z-10">{item.label}</span>
                  <span className="absolute inset-x-2 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-[#6759FF] to-[#17C7C9] transition group-hover:scale-x-100" />
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="relative min-w-0 max-w-[260px] truncate rounded-xl border border-white/75 bg-white/72 px-3 py-1.5 text-[11px] font-bold tracking-[-0.015em] text-[#102B53] shadow-[0_7px_22px_rgba(32,52,91,.10)] backdrop-blur-xl"
                >
                  <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-[#6759FF] to-[#17C7C9]" aria-hidden="true" />
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
