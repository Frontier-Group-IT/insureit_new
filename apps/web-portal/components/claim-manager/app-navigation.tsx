"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckSquare2,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  Gauge,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCog,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { internalLaunchHome, isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import type { Capability } from "@/lib/roles";
import type { PermissionAccess } from "@/lib/permission-management";

export type SectionKey = "claims" | "distribution" | "master-data" | "tasks" | "reports" | "development";
type ActiveNav = "dashboard" | SectionKey | "none";

type PermissionAccessMap = Partial<Record<Capability, PermissionAccess>>;

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  capability: Capability;
  minimumAccess?: Exclude<PermissionAccess, "none">;
  group?: string;
  quickAction?: boolean;
  keywords?: string[];
};

export type NavigationSection = {
  key: SectionKey;
  label: string;
  icon: LucideIcon;
  capability: Capability;
  minimumAccess?: Exclude<PermissionAccess, "none">;
  items: NavigationItem[];
};

type Props = {
  activeNav: ActiveNav;
  role: string | null | undefined;
  permissionAccess: PermissionAccessMap;
};

export const MOBILE_NAVIGATION_EVENT = "insureit:open-navigation";
const SIDEBAR_STORAGE_KEY = "insureit:shield-rail-collapsed";
const SIDEBAR_EXPANDED_WIDTH = "284px";
const SIDEBAR_COLLAPSED_WIDTH = "72px";

export const navigationSections: NavigationSection[] = [
  {
    key: "claims",
    label: "Claims",
    icon: ShieldCheck,
    capability: "view_claims",
    items: [
      { href: "/claims", label: "All Claims", icon: ClipboardList, capability: "view_claims", group: "Claims", keywords: ["register", "overview"] },
      { href: "/claims?queue=documents", label: "Documents", icon: FileCheck2, capability: "view_claims", group: "Work queues" },
      { href: "/claims?journey=spot-intimation", label: "Verification", icon: CheckSquare2, capability: "manage_claims", group: "Work queues" },
      { href: "/claims?journey=spot-surveyor-assigned", label: "Survey", icon: Gauge, capability: "manage_claims", group: "Work queues" },
      { href: "/claims?journey=under-repair", label: "Under Repair", icon: Settings, capability: "manage_claims", group: "Work queues" },
      { href: "/claims?journey=payment-advice-received", label: "Settlement", icon: BarChart3, capability: "manage_claims", group: "Work queues" },
    ],
  },
  {
    key: "distribution",
    label: "Intermediary",
    icon: Sparkles,
    capability: "view_intermediaries",
    items: [
      { href: "/intermediaries", label: "Overview", icon: Sparkles, capability: "view_intermediaries", group: "Workspace" },
      { href: "/intermediaries/partner", label: "Partners", icon: UsersRound, capability: "view_intermediaries", group: "Network" },
      { href: "/intermediaries/portal-users", label: "Portal Users", icon: UserCog, capability: "review_intermediary_application", group: "Network" },
      { href: "/intermediaries/posp", label: "POSP", icon: UsersRound, capability: "view_intermediaries", group: "Network" },
      { href: "/intermediaries/misp", label: "MISP", icon: UsersRound, capability: "view_intermediaries", group: "Network" },
      { href: "/customers/posp-misp", label: "Onboarding", icon: FileCheck2, capability: "view_intermediaries", group: "Applications", keywords: ["pending applications"] },
      { href: "/intermediaries/posp/new", label: "Add POSP", icon: UserPlus, capability: "create_intermediary_application", quickAction: true, keywords: ["create posp", "new posp"] },
      { href: "/customers/posp-misp/existing/new?partner_type=posp", label: "Add Existing POSP", icon: UserPlus, capability: "create_intermediary_application", quickAction: true, keywords: ["legacy posp"] },
      { href: "/intermediaries/misp/new", label: "Add MISP", icon: UserPlus, capability: "create_intermediary_application", quickAction: true, keywords: ["create misp", "new misp"] },
      { href: "/customers/posp-misp/existing/new?partner_type=misp", label: "Add Existing MISP", icon: UserPlus, capability: "create_intermediary_application", quickAction: true, keywords: ["legacy misp"] },
    ],
  },
  {
    key: "master-data",
    label: "Customers & Fleet",
    icon: LayoutGrid,
    capability: "view_customers",
    items: [
      { href: "/customers", label: "Customers", icon: UsersRound, capability: "view_customers", group: "Customers", keywords: ["customer register"] },
      { href: "/customers/applications", label: "Onboarding Applications", icon: FileCheck2, capability: "review_kyc", group: "Customers", keywords: ["kyc applications"] },
      { href: "/customer-kyc", label: "Customer KYC", icon: FileCheck2, capability: "view_kyc", group: "Customers" },
      { href: "/vehicles", label: "Vehicles", icon: Gauge, capability: "view_vehicles", group: "Fleet", keywords: ["vehicle register"] },
      { href: "/policies", label: "Policies", icon: ShieldCheck, capability: "view_policies", group: "Fleet", keywords: ["policy register"] },
      { href: "/master-data/vehicle-manufacturers", label: "Vehicle Manufacturers", icon: Settings, capability: "manage_master_data", group: "Administration" },
      { href: "/employees", label: "Employees", icon: UsersRound, capability: "view_employees", group: "Team", keywords: ["employee directory"] },
      { href: "/customers?choose_partner=1", label: "Add Customer", icon: Plus, capability: "manage_customers", quickAction: true },
      { href: "/vehicles/new", label: "Add Vehicle", icon: Plus, capability: "view_vehicles", minimumAccess: "edit", quickAction: true },
      { href: "/policies/new", label: "Add Policy", icon: Plus, capability: "view_policies", minimumAccess: "edit", quickAction: true },
      { href: "/master-data/vehicle-manufacturers/new", label: "Add Manufacturer", icon: Plus, capability: "manage_master_data", minimumAccess: "edit", quickAction: true },
      { href: "/employees/new", label: "Add Employee", icon: UserPlus, capability: "manage_employees", minimumAccess: "edit", quickAction: true },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: CheckSquare2,
    capability: "view_tasks",
    items: [
      { href: "/tasks", label: "All Tasks", icon: CheckSquare2, capability: "view_tasks", group: "Tasks" },
      { href: "/tasks?status=open", label: "Open", icon: ClipboardList, capability: "view_tasks", group: "Views" },
      { href: "/tasks?status=in_progress", label: "In Progress", icon: Gauge, capability: "view_tasks", group: "Views" },
      { href: "/tasks?status=overdue", label: "Overdue", icon: Gauge, capability: "view_tasks", group: "Views" },
      { href: "/tasks?status=completed", label: "Completed", icon: FileCheck2, capability: "view_tasks", group: "Views" },
    ],
  },
];

const developmentSection: NavigationSection = {
  key: "development",
  label: "Development",
  icon: FlaskConical,
  capability: "manage_system",
  items: [
    { href: "/customers/posp-misp/icall-uat", label: "iCall UAT Integration", icon: FlaskConical, capability: "manage_system", group: "Tools" },
    { href: "/customers/posp-misp/import", label: "Bulk POSP / MISP Import", icon: Upload, capability: "manage_system", group: "Tools" },
    { href: "/customers/posp-misp/import/batches", label: "Import History", icon: ClipboardList, capability: "manage_system", group: "Tools" },
  ],
};

const permissionRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };

export function permits(
  permissionAccess: PermissionAccessMap,
  capability: Capability,
  minimumAccess: Exclude<PermissionAccess, "none"> = "view",
) {
  return permissionRank[permissionAccess[capability] ?? "none"] >= permissionRank[minimumAccess];
}

function dedupeNavigationItems(items: NavigationItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.href}::${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function visibleNavigationSections(role: string | null | undefined, permissionAccess: PermissionAccessMap) {
  const source = isIntermediaryOnlyLaunch ? navigationSections.filter((section) => section.key === "distribution") : navigationSections;
  const sections = source
    .map((section) => ({
      ...section,
      items: dedupeNavigationItems(section.items.filter((item) => permits(permissionAccess, item.capability, item.minimumAccess))),
    }))
    .filter((section) => section.items.length > 0);

  return !isIntermediaryOnlyLaunch && role === "it_super_user" && permits(permissionAccess, "manage_system", "approve")
    ? [...sections, developmentSection]
    : sections;
}

function setShellSidebarWidth(collapsed: boolean) {
  const shell = document.getElementById("portal-shell-root");
  shell?.style.setProperty("--portal-sidebar-width", collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH);
}

function sectionHomeHref(section: NavigationSection) {
  return section.items.find((item) => !item.quickAction)?.href ?? section.items[0]?.href ?? internalLaunchHome;
}

function groupedItems(items: NavigationItem[]) {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const key = item.group ?? "Workspace";
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  return Array.from(groups.entries());
}

export function AppNavigation({ activeNav, role, permissionAccess }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const sections = useMemo(() => visibleNavigationSections(role, permissionAccess), [role, permissionAccess]);
  const routeSection = sectionForPath(pathname);
  const resolvedSection = routeSection ?? (activeNav !== "dashboard" && activeNav !== "none" ? activeNav : null);
  const activeSection = sections.find((section) => section.key === resolvedSection) ?? null;
  const dashboardActive = pathname === "/dashboard" || (activeNav === "dashboard" && !routeSection);
  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    setCollapsed(stored);
    setShellSidebarWidth(stored);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (collapsed) {
          setCollapsed(false);
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "0");
          setShellSidebarWidth(false);
          window.setTimeout(() => searchInputRef.current?.focus(), 80);
        } else {
          searchInputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapsed]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    setShellSidebarWidth(next);
    if (next) setSearchQuery("");
  }

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? sections
        .flatMap((section) =>
          section.items.map((item) => ({ section, item, haystack: [section.label, item.label, item.group, ...(item.keywords ?? [])].filter(Boolean).join(" ").toLowerCase() })),
        )
        .filter(({ haystack }) => haystack.includes(normalizedSearch))
        .slice(0, 14)
    : [];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 hidden overflow-hidden border-r border-white/10 bg-[#0B1430] text-white shadow-[18px_0_54px_rgba(8,18,45,0.20)] transition-[width] duration-300 ease-out lg:flex lg:flex-col"
      style={{ width: "var(--portal-sidebar-width)" }}
      aria-label="Primary workspace navigation"
    >
      <Link
        href={internalLaunchHome}
        prefetch={false}
        className="relative flex h-[76px] shrink-0 items-center overflow-hidden border-b border-white/10 px-4"
        aria-label="InsureIT home"
      >
        <div className="pointer-events-none absolute inset-0 portal-noise opacity-[0.12]" aria-hidden="true" />
        <div className={`relative overflow-hidden transition-[width] duration-200 ${collapsed ? "w-10" : "w-[210px]"}`}>
          <BrandLockup compact inverse />
        </div>
      </Link>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex w-[72px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0B1430]">
          <nav className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto px-2 py-3" aria-label="Workspaces">
            {!isIntermediaryOnlyLaunch && permits(permissionAccess, "view_dashboard") ? (
              <WorkspaceRailLink href="/dashboard" label="Dashboard" icon={Gauge} active={dashboardActive} collapsed={collapsed} />
            ) : null}

            {sections.map((section) => (
              <WorkspaceRailLink
                key={section.key}
                href={sectionHomeHref(section)}
                label={section.label}
                icon={section.icon}
                active={activeSection?.key === section.key}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className="flex shrink-0 flex-col items-center gap-1.5 border-t border-white/[0.08] px-2 py-3">
            {!isIntermediaryOnlyLaunch && permits(permissionAccess, "manage_system", "approve") ? (
              <WorkspaceRailLink href="/settings" label="Settings" icon={Settings} active={settingsActive} collapsed={collapsed} />
            ) : null}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="group relative grid h-11 w-11 place-items-center rounded-[14px] text-white/55 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45"
              aria-expanded={!collapsed}
              aria-controls="insureit-sidebar-context"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {!collapsed ? (
          <div id="insureit-sidebar-context" className="flex min-w-0 flex-1 flex-col bg-[#111B38]">
            <div className="shrink-0 px-4 pb-3 pt-4">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/42">Workspace</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold tracking-[-0.01em] text-white">
                  {dashboardActive ? "Dashboard" : settingsActive ? "Settings" : activeSection?.label ?? "Navigation"}
                </h2>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search or jump to..."
                  aria-label="Search navigation"
                  className="h-10 w-full !rounded-xl !border-white/10 !bg-white/[0.055] !pl-9 !pr-11 !text-[12px] !font-semibold !text-white placeholder:!text-white/38 focus:!border-white/25 focus:!shadow-none"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-bold text-white/38">⌘K</span>
              </div>
            </div>

            <nav className="insureit-nav-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace destinations">
              {normalizedSearch ? (
                <SearchResults results={searchResults} pathname={pathname} currentQuery={currentQuery} />
              ) : activeSection ? (
                <SectionDestinations section={activeSection} pathname={pathname} currentQuery={currentQuery} />
              ) : dashboardActive ? (
                <div className="space-y-2 pt-1">
                  <ContextLink
                    item={{ href: "/dashboard", label: "Overview", icon: Gauge, capability: "view_dashboard", group: "Dashboard" }}
                    pathname={pathname}
                    currentQuery={currentQuery}
                  />
                  <p className="px-3 pt-3 text-[10.5px] leading-5 text-white/42">Choose a workspace from the rail, or press Ctrl/⌘ K to jump directly to a page.</p>
                </div>
              ) : settingsActive ? (
                <div className="pt-1">
                  <ContextLink
                    item={{ href: "/settings", label: "Settings", icon: Settings, capability: "manage_system", group: "Administration" }}
                    pathname={pathname}
                    currentQuery={currentQuery}
                  />
                </div>
              ) : (
                <p className="px-3 pt-2 text-[10.5px] leading-5 text-white/42">Select a workspace from the rail or use search to jump to a destination.</p>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function WorkspaceRailLink({ href, label, icon: Icon, active, collapsed }: { href: string; label: string; icon: LucideIcon; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`group relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active ? "bg-white/[0.11] text-white shadow-[0_8px_22px_rgba(0,0,0,.16)]" : "text-white/58 hover:bg-white/[0.075] hover:text-white"
      }`}
    >
      {active ? <span className="absolute -left-2 top-1/2 h-7 w-[5px] -translate-y-1/2 bg-gradient-to-b from-[#7B6CFF] to-[#22C9D0] [clip-path:polygon(0_0,100%_16%,100%_84%,0_100%)]" aria-hidden="true" /> : null}
      <Icon className={`h-[19px] w-[19px] ${active ? "text-[#AFA7FF]" : ""}`} />
      {collapsed ? (
        <span className="pointer-events-none absolute left-[54px] z-[70] whitespace-nowrap rounded-lg border border-white/10 bg-[#111B38] px-2.5 py-1.5 text-[10px] font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {label}
        </span>
      ) : null}
    </Link>
  );
}

function SectionDestinations({ section, pathname, currentQuery }: { section: NavigationSection; pathname: string; currentQuery: string }) {
  const destinations = section.items.filter((item) => !item.quickAction);
  const quickActions = section.items.filter((item) => item.quickAction);

  return (
    <div className="space-y-4 pt-1">
      {groupedItems(destinations).map(([group, items]) => (
        <div key={group}>
          <p className="mb-1 px-3 text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-white/34">{group}</p>
          <div className="space-y-0.5">
            {items.map((item) => (
              <ContextLink key={item.href} item={item} pathname={pathname} currentQuery={currentQuery} />
            ))}
          </div>
        </div>
      ))}

      {quickActions.length ? (
        <div className="border-t border-white/[0.08] pt-3">
          <p className="mb-1 px-3 text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-white/34">Quick actions</p>
          <div className="space-y-0.5">
            {quickActions.map((item) => (
              <ContextLink key={item.href} item={item} pathname={pathname} currentQuery={currentQuery} quickAction />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ContextLink({ item, pathname, currentQuery, quickAction = false }: { item: NavigationItem; pathname: string; currentQuery: string; quickAction?: boolean }) {
  const active = isCurrent(item.href, pathname, currentQuery);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-[40px] items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2 text-[11.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
        active ? "bg-white/[0.105] text-white" : quickAction ? "text-white/64 hover:bg-white/[0.065] hover:text-white" : "text-white/76 hover:bg-white/[0.065] hover:text-white"
      }`}
    >
      {active ? <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-[#7B6CFF] to-[#22C9D0]" aria-hidden="true" /> : null}
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#B5AEFF]" : quickAction ? "text-white/42" : "text-white/48"}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {quickAction ? <Plus className="h-3.5 w-3.5 shrink-0 text-white/30 transition-transform group-hover:rotate-90 group-hover:text-white/65" /> : null}
    </Link>
  );
}

function SearchResults({ results, pathname, currentQuery }: { results: Array<{ section: NavigationSection; item: NavigationItem }>; pathname: string; currentQuery: string }) {
  if (!results.length) {
    return <p className="px-3 py-4 text-[10.5px] leading-5 text-white/42">No matching destination is available for your permissions.</p>;
  }

  return (
    <div className="space-y-1 pt-1">
      {results.map(({ section, item }) => (
        <div key={`${section.key}:${item.href}`}>
          <p className="px-3 pt-1 text-[8px] font-extrabold uppercase tracking-[0.14em] text-white/28">{section.label}</p>
          <ContextLink item={item} pathname={pathname} currentQuery={currentQuery} quickAction={Boolean(item.quickAction)} />
        </div>
      ))}
    </div>
  );
}

export function sectionForPath(pathname: string): SectionKey | null {
  if (pathname === "/customers/posp-misp/icall-uat") return "development";
  if (pathname === "/claims" || pathname.startsWith("/claims/")) return "claims";
  if (
    pathname === "/intermediaries" ||
    pathname.startsWith("/intermediaries/") ||
    pathname === "/customers/posp-misp" ||
    pathname.startsWith("/customers/posp-misp/")
  )
    return "distribution";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "tasks";
  if (pathname === "/reports" || pathname.startsWith("/reports/")) return "reports";
  if (
    pathname === "/master-data" ||
    pathname.startsWith("/master-data/") ||
    pathname === "/employees" ||
    pathname.startsWith("/employees/") ||
    pathname === "/customers" ||
    pathname.startsWith("/customers/") ||
    pathname === "/customer-kyc" ||
    pathname.startsWith("/customer-kyc/") ||
    pathname === "/vehicles" ||
    pathname.startsWith("/vehicles/") ||
    pathname === "/policies" ||
    pathname.startsWith("/policies/")
  )
    return "master-data";
  return null;
}

export function isCurrent(href: string, pathname: string, currentQuery: string) {
  const [targetPath, targetQuery = ""] = href.split("?");
  if (pathname !== targetPath) return false;
  if (!targetQuery) return currentQuery.length === 0;
  const expected = new URLSearchParams(targetQuery);
  const current = new URLSearchParams(currentQuery);
  return Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
}
