"use client";

import { type ReactNode, useEffect, useState } from "react";
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

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // The interaction still works even when persistence is unavailable.
      }
      return next;
    });
  }

  return (
    <div className={collapsed ? "desktop-sidebar-collapsed" : "desktop-sidebar-expanded"}>
      {navigation}

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        aria-expanded={!collapsed}
        className={`group fixed top-3 z-[60] hidden h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#111a35]/95 text-white shadow-[0_8px_24px_rgba(6,12,30,.24)] backdrop-blur transition-all duration-200 hover:bg-[#1a2548] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:grid ${collapsed ? "left-3" : "left-[148px]"}`}
      >
        {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#111111] px-2.5 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 ${collapsed ? "left-full ml-2" : "right-full mr-2"}`}
        >
          {collapsed ? "Open sidebar" : "Close sidebar"}
        </span>
      </button>

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
            box-shadow: 10px 0 30px rgba(17, 26, 53, 0.16) !important;
          }

          .desktop-sidebar-collapsed aside nav {
            overflow-x: hidden !important;
            scrollbar-width: none;
          }

          .desktop-sidebar-collapsed aside nav::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
