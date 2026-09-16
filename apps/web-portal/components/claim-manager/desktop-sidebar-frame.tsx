"use client";

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "insureit:desktop-sidebar-collapsed";

export function DesktopSidebarFrame({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Ignore storage failures and keep the expanded default.
    }
  }, []);

  function persistCollapsed(next: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // The interaction still works even when persistence is unavailable.
    }
  }

  function openSidebar() {
    setCollapsed(false);
    persistCollapsed(false);
  }

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      persistCollapsed(next);
      return next;
    });
  }

  function handleCollapsedSidebarClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!collapsed) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const sidebar = event.currentTarget.querySelector(":scope > aside");
    if (!sidebar || !sidebar.contains(target)) return;

    // In collapsed mode every interaction with the rail opens the full sidebar.
    // Prevent links and parent-menu buttons from navigating/toggling until the
    // user can see the normal expanded hierarchy.
    event.preventDefault();
    event.stopPropagation();
    openSidebar();
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
            : "left-[196px] border border-white/15 bg-[#111a35]/95 shadow-[0_8px_24px_rgba(6,12,30,.24)] backdrop-blur hover:bg-[#1a2548]"
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

      <div className={`transition-[padding] duration-200 ease-out ${collapsed ? "lg:pl-16" : "lg:pl-[248px]"}`}>
        {children}
      </div>

      <style jsx global>{`
        @media (min-width: 1024px) {
          .desktop-sidebar-expanded > aside,
          .desktop-sidebar-collapsed > aside {
            transition: width 200ms ease-out, box-shadow 200ms ease-out;
          }

          .desktop-sidebar-expanded > aside {
            width: 248px !important;
          }

          .desktop-sidebar-expanded > aside > a {
            height: 64px !important;
            padding-left: 12px !important;
            padding-right: 48px !important;
          }

          .desktop-sidebar-expanded > aside > a > * {
            transform: scale(0.82);
            transform-origin: left center;
          }

          .desktop-sidebar-expanded > aside nav {
            padding: 10px 8px !important;
          }

          .desktop-sidebar-expanded > aside nav > a {
            height: 40px !important;
            margin-bottom: 6px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded > aside nav > a > span:first-child,
          .desktop-sidebar-expanded > aside nav > div > div > button > span:first-child {
            width: 28px !important;
            height: 28px !important;
            border-radius: 10px !important;
          }

          .desktop-sidebar-expanded > aside nav > p {
            margin-top: 14px !important;
            margin-bottom: 6px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .desktop-sidebar-expanded > aside nav > div > div {
            margin-top: 2px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded > aside nav > div > div:first-child {
            margin-top: 0 !important;
          }

          .desktop-sidebar-expanded > aside nav > div > div > button {
            height: 40px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded > aside nav button > .flex-1 {
            flex: 1 1 auto !important;
            min-width: 0;
            white-space: nowrap;
          }

          .desktop-sidebar-expanded > aside nav button > svg:last-child {
            flex-shrink: 0;
            margin-left: 8px;
          }

          .desktop-sidebar-expanded > aside nav > div > div > div {
            padding-bottom: 6px !important;
          }

          .desktop-sidebar-expanded > aside > div:last-child {
            padding: 8px !important;
          }

          .desktop-sidebar-expanded > aside > div:last-child > a {
            height: 40px !important;
            gap: 8px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            border-radius: 14px !important;
          }

          .desktop-sidebar-expanded > aside > div:last-child > a > span:first-child {
            width: 28px !important;
            height: 28px !important;
            border-radius: 10px !important;
          }

          .desktop-sidebar-collapsed > aside {
            width: 64px !important;
            overflow: visible !important;
            box-shadow: 10px 0 30px rgba(17, 26, 53, 0.16) !important;
          }

          .desktop-sidebar-collapsed > aside > a {
            height: 64px !important;
            width: 64px !important;
            justify-content: center !important;
            overflow: hidden !important;
            padding: 0 !important;
          }

          .desktop-sidebar-collapsed > aside > a > div {
            gap: 0 !important;
          }

          .desktop-sidebar-collapsed > aside > a > div > img {
            width: 38px !important;
            height: 38px !important;
          }

          .desktop-sidebar-collapsed > aside > a > div > div {
            display: none !important;
          }

          .desktop-sidebar-collapsed > aside nav {
            overflow: visible !important;
            padding: 10px 8px !important;
            scrollbar-width: none;
          }

          .desktop-sidebar-collapsed > aside nav::-webkit-scrollbar {
            display: none;
          }

          .desktop-sidebar-collapsed > aside nav > p {
            display: none !important;
          }

          .desktop-sidebar-collapsed > aside nav > a,
          .desktop-sidebar-collapsed > aside nav > div > div > button {
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

          .desktop-sidebar-collapsed > aside nav > a:hover,
          .desktop-sidebar-collapsed > aside nav > div > div > button:hover {
            background-color: rgba(255, 255, 255, 0.10) !important;
          }

          .desktop-sidebar-collapsed > aside nav > a > span:first-child,
          .desktop-sidebar-collapsed > aside nav > div > div > button > span:first-child {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            border-radius: 10px !important;
            margin: 0 !important;
          }

          .desktop-sidebar-collapsed > aside nav > a > .flex-1,
          .desktop-sidebar-collapsed > aside nav > div > div > button > .flex-1,
          .desktop-sidebar-collapsed > aside > div:last-child > a > .flex-1 {
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

          .desktop-sidebar-collapsed > aside nav > a:hover > .flex-1,
          .desktop-sidebar-collapsed > aside nav > a:focus-visible > .flex-1,
          .desktop-sidebar-collapsed > aside nav > div > div > button:hover > .flex-1,
          .desktop-sidebar-collapsed > aside nav > div > div > button:focus-visible > .flex-1,
          .desktop-sidebar-collapsed > aside > div:last-child > a:hover > .flex-1,
          .desktop-sidebar-collapsed > aside > div:last-child > a:focus-visible > .flex-1 {
            opacity: 1 !important;
            transform: translateY(-50%) translateX(0) !important;
          }

          .desktop-sidebar-collapsed > aside nav > a > svg:last-child,
          .desktop-sidebar-collapsed > aside nav > div > div > button > svg:last-child {
            display: none !important;
          }

          .desktop-sidebar-collapsed > aside nav > div > div {
            margin: 0 !important;
            border-radius: 12px !important;
            overflow: visible !important;
          }

          .desktop-sidebar-collapsed > aside nav > div > div > div {
            display: none !important;
          }

          .desktop-sidebar-collapsed > aside > div:last-child {
            position: relative !important;
            margin-top: auto !important;
            flex-shrink: 0 !important;
            overflow: visible !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            background: #111a35 !important;
            padding: 8px !important;
          }

          .desktop-sidebar-collapsed > aside > div:last-child > a {
            position: relative !important;
            width: 48px !important;
            height: 44px !important;
            justify-content: center !important;
            gap: 0 !important;
            padding: 0 !important;
            border-radius: 12px !important;
            overflow: visible !important;
          }

          .desktop-sidebar-collapsed > aside > div:last-child > a:hover {
            background-color: rgba(255, 255, 255, 0.10) !important;
          }

          .desktop-sidebar-collapsed > aside > div:last-child > a > span:first-child {
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
