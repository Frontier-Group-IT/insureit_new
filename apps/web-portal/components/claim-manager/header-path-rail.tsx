"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Network } from "lucide-react";

type PathNode = {
  label: string;
  href?: string;
};

const routeMap: Array<{ match: RegExp; nodes: PathNode[] }> = [
  {
    match: /^\/intermediaries\/misp\/?$/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "MISP", href: "/intermediaries/misp" },
      { label: "MISP Register" },
    ],
  },
  {
    match: /^\/intermediaries\/posp\/?$/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "POSP", href: "/intermediaries/posp" },
      { label: "POSP Register" },
    ],
  },
  {
    match: /^\/intermediaries\/partner\/?$/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Partners", href: "/intermediaries/partner" },
      { label: "Partner Register" },
    ],
  },
  {
    match: /^\/intermediaries\/?$/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Overview" },
    ],
  },
  {
    match: /^\/intermediaries\/applications\/[^/]+/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Onboarding", href: "/intermediaries/applications" },
      { label: "Application Review" },
    ],
  },
  {
    match: /^\/intermediaries\/applications\/?$/,
    nodes: [
      { label: "Intermediatory", href: "/intermediaries" },
      { label: "Onboarding" },
    ],
  },
];

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function deriveNodes(pathname: string, title: string): PathNode[] {
  const configured = routeMap.find((route) => route.match.test(pathname));
  if (configured) return configured.nodes;

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^[0-9a-f-]{20,}$/i.test(segment));

  if (!segments.length) return [{ label: title }];

  return segments.map((segment, index) => ({
    label: index === segments.length - 1 ? title : titleCase(segment),
    href: index === segments.length - 1 ? undefined : `/${segments.slice(0, index + 1).join("/")}`,
  }));
}

export function HeaderPathRail({ title }: { title: string }) {
  const pathname = usePathname();
  const nodes = deriveNodes(pathname, title);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 overflow-hidden">
        <li className="hidden shrink-0 sm:block" aria-hidden="true">
          <span className="grid h-7 w-7 place-items-center rounded-xl border border-white/60 bg-white/45 text-[#5B62D6] shadow-[0_7px_18px_rgba(31,50,91,0.08)] backdrop-blur-xl">
            <Network className="h-3.5 w-3.5" />
          </span>
        </li>
        {nodes.map((node, index) => {
          const current = index === nodes.length - 1;
          return (
            <li key={`${node.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <span aria-hidden="true" className="flex shrink-0 items-center text-[#8090AA]">
                  <span className="hidden h-px w-3 bg-gradient-to-r from-[#9EAACA]/20 to-[#6E78DB]/60 sm:block" />
                  <ChevronRight className="h-3 w-3" />
                </span>
              ) : null}
              {node.href && !current ? (
                <Link
                  href={node.href}
                  className="group inline-flex h-7 min-w-0 items-center rounded-lg border border-transparent px-2 text-[10px] font-semibold text-[#60708C] transition hover:border-white/70 hover:bg-white/50 hover:text-[#263A61]"
                >
                  <span className="truncate">{node.label}</span>
                </Link>
              ) : (
                <span
                  aria-current={current ? "page" : undefined}
                  className="inline-flex h-8 min-w-0 items-center rounded-xl border border-[#9FA8FF]/55 bg-[linear-gradient(135deg,rgba(255,255,255,.82),rgba(232,235,255,.76))] px-3 text-[11px] font-bold tracking-[-0.015em] text-[#29366E] shadow-[0_8px_22px_rgba(75,82,180,0.13)] backdrop-blur-xl sm:text-[12px]"
                >
                  <span className="truncate">{node.label}</span>
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6759FF] shadow-[0_0_0_4px_rgba(103,89,255,.10)]" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
