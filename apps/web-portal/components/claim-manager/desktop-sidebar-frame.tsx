"use client";

import Link from "next/link";
import {
  isValidElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import {
  type NavigationSection,
  visibleNavigationSections,
} from "@/components/claim-manager/app-navigation";
import type { PermissionAccess } from "@/lib/permission-management";
import type { Capability } from "@/lib/roles";

const STORAGE_KEY = "insureit:desktop-sidebar-collapsed";

type PermissionAccessMap = Partial<Record<Capability, PermissionAccess>>;
type NavigationElementProps = {
  role?: string | null;
  permissionAccess?: PermissionAccessMap;
  accountsAccess?: boolean;
};

type FlyoutTarget = { type: "section"; key: string } | { type: "settings" } | null;

export function DesktopSidebarFrame({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [flyoutTarget, setFlyoutTarget] = useState<FlyoutTarget>(null);
  const [flyoutTop, setFlyoutTop] = useState(84);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  const navigationProps = isValidElement<NavigationElementProps>(navigation) ? navigation.props : null;
  const visibleSections = useMemo(
    () =>
      navigationProps
        ? visibleNavigationSections(
            navigationProps.role,
            navigationProps.permissionAccess ?? {},
            navigationProps.accountsAccess ?? true,
          )
        : [],
    [navigationProps],
  );

  const flyoutSection =
    flyoutTarget?.type === "section"
      ? visibleSections.find((section) => section.key === flyoutTarget.key) ?? null
      : null;

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Ignore storage failures and keep the expanded default.
    }
  }, []);

  useEffect(() => {
    if (!collapsed || !flyoutTarget) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (flyoutRef.current?.contains(target)) return;
      const aside = document.querySelector("aside");
      if (aside?.contains(target)) return;
      setFlyoutTarget(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlyoutTarget(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [collapsed, flyoutTarget]);

  function persistCollapsed(next: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // The interaction still works even when persistence is unavailable.
    }
  }

  function openSidebar() {
    setCollapsed(false);
    setFlyoutTarget(null);
    persistCollapsed(false);
  }

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      if (!next) setFlyoutTarget(null);
      persistCollapsed(next);
      return next;
    });
  }

  function openFlyout(target: FlyoutTarget, trigger: HTMLElement) {
    if (!target) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = 520;
    const maxTop = Math.max(76, window.innerHeight - estimatedHeight - 16);
    setFlyoutTop(Math.min(Math.max(rect.top - 6, 76), maxTop));
    setFlyoutTarget((current) => {
      if (!current) return target;
      if (current.type !== target.type) return target;
      if (current.type === "settings" && target.type === "settings") return null;
      if (current.type === "section" && target.type === "section" && current.key === target.key) return null;
      return target;
    });
  }

  function handleCollapsedSidebarClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!collapsed) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-collapsed-flyout]")) return;

    const aside = target.closest("aside");
    if (!aside) return;

    const topLogoLink = target.closest('a[aria-label="InsureIt home"]');
    if (topLogoLink) {
      event.preventDefault();
      event.stopPropagation();
      openSidebar();
      return;
    }

    const settingsLink = target.closest('a[href="/settings"]');
    if (settingsLink) {
      event.preventDefault();
      event.stopPropagation();
      openFlyout({ type: "settings" }, settingsLink as HTMLElement);
      return;
    }

    const sectionButton = target.closest("aside nav button");
    if (sectionButton) {
      const buttonText = sectionButton.textContent?.trim() ?? "";
      const section = visibleSections.find((candidate) => buttonText.includes(candidate.label));
      if (section) {
        event.preventDefault();
        event.stopPropagation();
        openFlyout({ type: "section", key: section.key }, sectionButton as HTMLElement);
        return;
      }
    }

    if (!target.closest("a,button")) {
      event.preventDefault();
      openSidebar();
    }
  }

  function closeFlyout() {
    setFlyoutTarget(null);
  }

  return (
    <div
      className={collapsed ? "desktop-sidebar-collapsed" : "desktop-sidebar-expanded"}
      onClickCapture={handleCollapsedSidebarClick}
    >
      {navigation}

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        aria-expanded={!collapsed}
        className={`group fixed top-3 z-[60] hidden h-10 w-10 place-items-center rounded-xl text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:grid ${
          collapsed
            ? "left-3 border border-transparent bg-transparent shadow-none hover:border-white/10 hover:bg-[#1a2548] hover:shadow-[0_8px_24px_rgba(6,12,30,.24)]"
            : "left-[148px] border border-white/15 bg-[#111a35]/95 shadow-[0_8px_24px_rgba(6,12,30,.24)] backdrop-blur hover:bg-[#1a2548]"
        }`}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-[18px] w-[18px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
        ) : (
          <PanelLeftClose className="h-[18px] w-[18px]" />
        )}
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#111111] px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${collapsed ? "left-full ml-2" : "right-full mr-2"}`}
        >
          {collapsed ? "Open sidebar" : "Close sidebar"}
        </span>
      </button>

      {collapsed && flyoutTarget ? (
        <div
          ref={flyoutRef}
          data-collapsed-flyout
          className="fixed left-[72px] z-[80] hidden w-[320px] max-h-[calc(100vh-96px)] overflow-y-auto rounded-[20px] border border-[#E5E7EB] bg-white p-3 text-[#111827] shadow-[0_22px_70px_rgba(15,23,42,.20)] lg:block"
          style={{ top: flyoutTop }}
        >
          {flyoutSection ? (
            <CollapsedSectionFlyout section={flyoutSection} onNavigate={closeFlyout} />
          ) : flyoutTarget.type === "settings" ? (
            <div>
              <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#F3F4F6] text-[#334155]">
                  <Settings className="h-4 w-4" />
                </span>
                <div className="text-[14px] font-semibold text-[#111827]">Settings</div>
              </div>
              <Link
                href="/settings"
                onClick={closeFlyout}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#334155] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`transition-[padding] duration-200 ease-out ${collapsed ? "lg:pl-16" : "lg:pl-[200px]"}`}>
        {children}
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) {
          .desktop-sidebar-expanded aside,
          .desktop-sidebar-collapsed aside {
            transition: width 200ms ease-out, box-shadow 200ms ease-out;
          }

          .desktop-sidebar-expanded aside {
            width: 200px !important;
          }

          .desktop-sidebar-expanded aside > a {
            height: 64px !important;
            padding-left: 12px !important;
            padding-right: 48px !important;
          }

          .desktop-sidebar-expanded aside > a > * {
            transform: scale(0.82);
            transform-origin: left center;
          }

          .desktop-sidebar-expanded aside nav {
            padding: 10px 8px !important;
          }

          .desktop-sidebar-expanded aside nav > a {
            height: 40px !important;
            margin-bottom: 6px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded aside nav > a > span:first-child,
          .desktop-sidebar-expanded aside nav > div > div > button > span:first-child {
            width: 28px !important;
            height: 28px !important;
            border-radius: 10px !important;
          }

          .desktop-sidebar-expanded aside nav > p {
            margin-top: 14px !important;
            margin-bottom: 6px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .desktop-sidebar-expanded aside nav > div > div {
            margin-top: 2px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded aside nav > div > div:first-child {
            margin-top: 0 !important;
          }

          .desktop-sidebar-expanded aside nav > div > div > button {
            height: 40px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded aside nav button > .flex-1 {
            flex: 0 1 auto !important;
            min-width: 0;
            white-space: nowrap;
          }

          .desktop-sidebar-expanded aside nav button > svg:last-child {
            flex-shrink: 0;
            margin-left: 2px;
          }

          .desktop-sidebar-expanded aside nav > div > div > div {
            padding-bottom: 6px !important;
          }

          .desktop-sidebar-expanded aside > div:last-child {
            padding: 8px !important;
          }

          .desktop-sidebar-expanded aside > div:last-child > a {
            height: 40px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded aside > div:last-child > a > span:first-child {
            width: 28px !important;
            height: 28px !important;
            border-radius: 10px !important;
          }

          .desktop-sidebar-collapsed aside {
            width: 64px !important;
            overflow: visible !important;
            box-shadow: 10px 0 30px rgba(17, 26, 53, 0.16) !important;
          }

          .desktop-sidebar-collapsed aside > a {
            height: 64px !important;
            width: 64px !important;
            justify-content: center !important;
            overflow: hidden !important;
            padding: 0 !important;
          }

          .desktop-sidebar-collapsed aside > a > div {
            gap: 0 !important;
          }

          .desktop-sidebar-collapsed aside > a > div > img {
            width: 38px !important;
            height: 38px !important;
          }

          .desktop-sidebar-collapsed aside > a > div > div {
            display: none !important;
          }

          .desktop-sidebar-collapsed aside nav {
            overflow: visible !important;
            padding: 10px 8px !important;
            scrollbar-width: none;
          }

          .desktop-sidebar-collapsed aside nav::-webkit-scrollbar {
            display: none;
          }

          .desktop-sidebar-collapsed aside nav > p {
            display: none !important;
          }

          .desktop-sidebar-collapsed aside nav > a,
          .desktop-sidebar-collapsed aside nav > div > div > button {
            position: relative !important;
            width: 48px !important;
            height: 44px !important;
            min-height: 44px !important;
            justify-content: center !important;
            gap: 0 !important;
            margin: 0 0 6px 0 !important;
            padding: 0 !important;
            border-radius: 12px !important;
            overflow: visible !important;
          }

          .desktop-sidebar-collapsed aside nav > a:hover,
          .desktop-sidebar-collapsed aside nav > div > div > button:hover {
            background-color: rgba(255, 255, 255, 0.10) !important;
          }

          .desktop-sidebar-collapsed aside nav > a > span:first-child,
          .desktop-sidebar-collapsed aside nav > div > div > button > span:first-child {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            border-radius: 10px !important;
            margin: 0 !important;
          }

          .desktop-sidebar-collapsed aside nav > a > .flex-1,
          .desktop-sidebar-collapsed aside nav > div > div > button > .flex-1,
          .desktop-sidebar-collapsed aside > div:last-child > a > .flex-1 {
            position: absolute !important;
            left: 56px !important;
            top: 50% !important;
            z-index: 90 !important;
            width: max-content !important;
            max-width: 220px !important;
            transform: translateY(-50%) translateX(-4px) !important;
            border-radius: 9px !important;
            background: #111111 !important;
            padding: 7px 10px !important;
            color: white !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            line-height: 1 !important;
            white-space: nowrap !important;
            opacity: 0 !important;
            pointer-events: none !important;
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28) !important;
            transition: opacity 120ms ease-out, transform 120ms ease-out !important;
          }

          .desktop-sidebar-collapsed aside nav > a:hover > .flex-1,
          .desktop-sidebar-collapsed aside nav > a:focus-visible > .flex-1,
          .desktop-sidebar-collapsed aside nav > div > div > button:hover > .flex-1,
          .desktop-sidebar-collapsed aside nav > div > div > button:focus-visible > .flex-1,
          .desktop-sidebar-collapsed aside > div:last-child > a:hover > .flex-1,
          .desktop-sidebar-collapsed aside > div:last-child > a:focus-visible > .flex-1 {
            opacity: 1 !important;
            transform: translateY(-50%) translateX(0) !important;
          }

          .desktop-sidebar-collapsed aside nav > a > svg:last-child,
          .desktop-sidebar-collapsed aside nav > div > div > button > svg:last-child {
            display: none !important;
          }

          .desktop-sidebar-collapsed aside nav > div > div {
            margin: 0 !important;
            border-radius: 12px !important;
            overflow: visible !important;
          }

          .desktop-sidebar-collapsed aside nav > div > div > div {
            display: none !important;
          }

          .desktop-sidebar-collapsed aside > div:last-child {
            position: relative !important;
            margin-top: auto !important;
            flex-shrink: 0 !important;
            overflow: visible !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            background: #111a35 !important;
            padding: 8px !important;
          }

          .desktop-sidebar-collapsed aside > div:last-child > a {
            position: relative !important;
            width: 48px !important;
            height: 44px !important;
            justify-content: center !important;
            gap: 0 !important;
            padding: 0 !important;
            border-radius: 12px !important;
            overflow: visible !important;
          }

          .desktop-sidebar-collapsed aside > div:last-child > a:hover {
            background-color: rgba(255, 255, 255, 0.10) !important;
          }

          .desktop-sidebar-collapsed aside > div:last-child > a > span:first-child {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            border-radius: 10px !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function CollapsedSectionFlyout({ section, onNavigate }: { section: NavigationSection; onNavigate: () => void }) {
  const SectionIcon = section.icon;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
        <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${section.tint} text-white`}>
          <SectionIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-[14px] font-semibold text-[#111827]">{section.label}</div>
      </div>

      <div className="space-y-1">
        {section.items.map((node) => {
          if (node.kind === "group") {
            const GroupIcon = node.icon;
            return (
              <div key={node.key} className="rounded-xl border border-[#EEF0F3] bg-[#FAFBFC] p-2">
                <div className="flex items-center gap-2 px-1 py-1.5 text-[12px] font-semibold text-[#475569]">
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">{node.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-[#94A3B8]" />
                </div>
                <div className="mt-1 space-y-0.5 border-l border-[#DDE3EA] pl-3">
                  {node.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link
                        key={`${item.href}:${item.label}`}
                        href={item.href}
                        onClick={onNavigate}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium text-[#334155] transition-colors hover:bg-white hover:text-[#0F172A]"
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
                        <span className="min-w-0 flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const ItemIcon = node.icon;
          return (
            <Link
              key={`${node.href}:${node.label}`}
              href={node.href}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#334155] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              <ItemIcon className="h-4 w-4 shrink-0 text-[#64748B]" />
              <span className="min-w-0 flex-1">{node.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
