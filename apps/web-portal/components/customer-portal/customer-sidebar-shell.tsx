"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CustomerNavigation } from "@/components/customer-portal/customer-navigation";

export function CustomerSidebarShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("insureit:customer-sidebar-collapsed") === "1"); } catch { /* expanded fallback */ }
    const onToggle = (event: Event) => {
      const custom = event as CustomEvent<{ collapsed: boolean }>;
      setCollapsed(custom.detail.collapsed);
    };
    window.addEventListener("insureit:customer-sidebar-toggle", onToggle);
    return () => window.removeEventListener("insureit:customer-sidebar-toggle", onToggle);
  }, []);
  return (
    <>
      <CustomerNavigation />
      <div className={`transition-[padding] duration-200 ease-out ${collapsed ? "lg:pl-16" : "lg:pl-[248px]"}`}>{children}</div>
    </>
  );
}
