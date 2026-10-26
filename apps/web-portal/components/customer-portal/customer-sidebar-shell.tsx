"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelTop } from "lucide-react";
import { CustomerNavigation } from "@/components/customer-portal/customer-navigation";
import { CustomerTopNavigation } from "@/components/customer-portal/customer-top-navigation";

export const customerNavigationPreferenceKey = "insureit:customer-navigation-layout";
export const customerNavigationPreferenceEvent = "insureit:customer-navigation-layout-change";
type NavigationLayout = "top" | "sidebar";

export function CustomerSidebarShell({ children, headerActions, breadcrumbs }: { children: ReactNode; headerActions: ReactNode; breadcrumbs: ReactNode }) {
  const [layout, setLayout] = useState<NavigationLayout>("sidebar");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setLayout(window.localStorage.getItem(customerNavigationPreferenceKey) === "top" ? "top" : "sidebar");
      setCollapsed(window.localStorage.getItem("insureit:customer-sidebar-collapsed") === "1");
    } catch { /* default to sidebar */ }
    const onToggle = (event: Event) => {
      const custom = event as CustomEvent<{ collapsed: boolean }>;
      setCollapsed(custom.detail.collapsed);
    };
    window.addEventListener("insureit:customer-sidebar-toggle", onToggle);
    const onLayoutChange = (event: Event) => {
      const next = (event as CustomEvent<{ layout?: NavigationLayout }>).detail?.layout;
      if (next === "top" || next === "sidebar") setLayout(next);
    };
    window.addEventListener(customerNavigationPreferenceEvent, onLayoutChange);
    return () => {
      window.removeEventListener("insureit:customer-sidebar-toggle", onToggle);
      window.removeEventListener(customerNavigationPreferenceEvent, onLayoutChange);
    };
  }, []);

  function switchLayout(next: NavigationLayout) {
    setLayout(next);
    try { window.localStorage.setItem(customerNavigationPreferenceKey, next); } catch { /* preference stays for this session */ }
  }

  const sidebar = layout === "sidebar";
  return (
    <>
      <CustomerNavigation mode={layout} />
      <div data-customer-nav-layout={layout} className={`customer-navigation-content transition-[padding] duration-200 ease-out ${sidebar ? collapsed ? "lg:pl-16" : "lg:pl-[248px]" : ""}`}>
        <header className={`sticky top-0 z-40 border-b ${sidebar ? "border-[#E5EAF2] bg-white shadow-[0_4px_18px_rgba(18,40,75,0.06)]" : "border-[#5942A2] bg-[#49369A] shadow-[0_4px_18px_rgba(38,21,92,0.17)]"}`}>
          <div className={`flex min-h-[66px] items-center justify-between gap-2 px-3 sm:px-5 lg:px-7 ${!sidebar ? "gap-3" : ""}`}>
            {sidebar ? (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button type="button" onClick={() => switchLayout("top")} title="Switch to top header navigation" aria-label="Switch to top header navigation" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#344563] hover:bg-[#EDF3FF]">
                    <PanelTop className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">{breadcrumbs}</div>
                </div>
              </>
            ) : (
              <CustomerTopNavigation onSwitchToSidebar={() => switchLayout("sidebar")} />
            )}
            <div className={sidebar ? "shrink-0" : "shrink-0 rounded-xl bg-white px-1 py-0.5"}>
              {headerActions}
            </div>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
