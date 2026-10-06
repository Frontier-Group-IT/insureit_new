import DeveloperIdentityBadge from "./developer-identity";
import Link from "next/link";
import type { ReactNode } from "react";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      ["Home", "/", "⌂"],
      ["Configuration", "/configuration", "⚙"]
    ]
  },
  {
    label: "Build",
    items: [
      ["Apps", "/#roadmap", "▦"],
      ["Content", "/#roadmap", "T"],
      ["Assets", "/#roadmap", "◇"],
      ["Features", "/#roadmap", "✦"],
      ["Code", "/#roadmap", "</>"],
      ["Releases", "/#roadmap", "↗"]
    ]
  },
  {
    label: "Platform",
    items: [
      ["Database", "/#roadmap", "DB"],
      ["Infrastructure", "/#roadmap", "◎"],
      ["Integrations", "/#roadmap", "∞"],
      ["Observability", "/#roadmap", "◌"]
    ]
  },
  {
    label: "Governance",
    items: [
      ["AI Developer", "/#roadmap", "AI"],
      ["Docs", "/#roadmap", "≡"],
      ["Security", "/#roadmap", "⌾"],
      ["Audit", "/#roadmap", "✓"]
    ]
  }
] as const;

const APP_ICON = "https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/apps/mobile-app/assets/brand/insureit-app-icon-ice.png";

export default function WorkspaceShell({
  active,
  children
}: {
  active: "Home" | "Configuration";
  children: ReactNode;
}) {
  return (
    <main className="workspace refined-workspace">
      <aside className="sidebar refined-sidebar">
        <Link href="/" className="workspace-brand" aria-label="InsureIT Developer Workspace">
          <img src={APP_ICON} alt="" />
          <div>
            <strong>InsureIT</strong>
            <span>Developer Workspace</span>
          </div>
        </Link>

        <div className="workspace-env">
          <span className="env-dot" />
          <div><b>Protected control plane</b><small>Production-aware · guarded</small></div>
        </div>

        <nav className="workspace-nav" aria-label="Developer Workspace navigation">
          {GROUPS.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(([item, href, icon]) => (
                <Link key={item} className={item === active ? "active" : ""} href={href}>
                  <span className="nav-icon">{icon}</span>
                  <span className="nav-label">{item}</span>
                  {item !== "Home" && item !== "Configuration" ? <small>Soon</small> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="side-foot refined-side-foot">
          <div><span className="side-status-dot" /><b>Phase 2B active</b></div>
          <small>Versioned preview registry · AAL2 guarded</small>
        </div>
      </aside>

      <section className="content refined-content">
        <header className="topbar refined-topbar">
          <div className="topbar-title">
            <small>INSUREIT / ENGINEERING CONTROL PLANE</small>
            <b>{active === "Home" ? "Developer Workspace" : "Configuration Registry"}</b>
          </div>
          <div className="top-actions refined-top-actions">
            <span className="protected-chip"><i /> Protected</span>
            <DeveloperIdentityBadge />
            <a className="public-site-link" href="https://insureit.tech">insureit.tech <span>↗</span></a>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
