"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { reportWorkspaceForPath, reportWorkspaces } from "@/lib/reports/navigation";

type Props = { canViewGovernance: boolean; role?: string | null };

export function ReportNavigation({ canViewGovernance: _canViewGovernance, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const backofficeRestricted = role === "backoffice_executive";
  const visibleWorkspaces = reportWorkspaces
    .filter((workspace) => !backofficeRestricted || ["business", "portfolio", "operations"].includes(workspace.key))
    .map((workspace) => backofficeRestricted && workspace.key === "business"
      ? {
          ...workspace,
          routes: workspace.routes.filter((route) => route === "/reports/business"),
          sections: workspace.sections?.filter((section) => section.href === "/reports/business"),
        }
      : workspace);
  const activeKey = reportWorkspaceForPath(pathname) ?? visibleWorkspaces[0]?.key ?? "business";
  const activeWorkspace = visibleWorkspaces.find((workspace) => workspace.key === activeKey) ?? visibleWorkspaces[0];
  const activeSection = activeWorkspace?.sections
    ?.slice()
    .sort((a, b) => b.href.length - a.href.length)
    .find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`));

  return (
    <div className="reports-nav-shell mb-4 print:hidden">
      <style>{`.reports-r1-content header nav{display:none!important}`}</style>
      <div className="reports-v2-nav">
        <div className="reports-v2-nav__desktop">
          {visibleWorkspaces.map((workspace) => (
            <Link key={workspace.key} href={workspace.href} className={workspaceClass(activeKey === workspace.key)}>
              {workspace.label}
            </Link>
          ))}
        </div>

        <div className="reports-v2-nav__mobile">
          <label>
            <span>Reporting area</span>
            <select value={activeWorkspace?.href ?? "/reports/business"} onChange={(event) => router.push(event.target.value)}>
              {visibleWorkspaces.map((workspace) => <option key={workspace.key} value={workspace.href}>{workspace.label}</option>)}
            </select>
          </label>
        </div>

        {activeWorkspace?.sections?.length ? (
          <div className="reports-v2-subnav" aria-label={`${activeWorkspace.label} report sections`}>
            {activeWorkspace.sections.map((section) => (
              <Link key={section.href} href={section.href} className={sectionClass(activeSection?.href === section.href)}>
                {section.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function workspaceClass(active: boolean) {
  return `reports-v2-nav__item ${active ? "reports-v2-nav__item--active" : ""}`;
}

function sectionClass(active: boolean) {
  return `reports-v2-subnav__item ${active ? "reports-v2-subnav__item--active" : ""}`;
}
