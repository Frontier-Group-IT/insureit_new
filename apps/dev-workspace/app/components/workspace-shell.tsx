import DeveloperIdentityBadge from "./developer-identity";
import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  ["Home", "/"],
  ["Apps", "#roadmap"],
  ["Configuration", "/configuration"],
  ["Content", "#roadmap"],
  ["Assets", "#roadmap"],
  ["Features", "#roadmap"],
  ["Code", "#roadmap"],
  ["Releases", "#roadmap"],
  ["Database", "#roadmap"],
  ["Infrastructure", "#roadmap"],
  ["Integrations", "#roadmap"],
  ["Observability", "#roadmap"],
  ["AI Developer", "#roadmap"],
  ["Docs", "#roadmap"],
  ["Security", "#roadmap"],
  ["Audit", "#roadmap"]
] as const;

export default function WorkspaceShell({
  active,
  children
}: {
  active: "Home" | "Configuration";
  children: ReactNode;
}) {
  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <img src="https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/apps/web-portal/public/assets/brand/insureit-mark.webp" alt="InsureIT" />
          <span>DEV</span>
        </div>
        <div className="environment"><i /> DEVELOPMENT CONTROL PLANE</div>
        <nav>
          {NAV.map(([item, href], i) => (
            <Link key={item} className={item === active ? "active" : ""} href={href}>
              <span>{String(i + 1).padStart(2, "0")}</span>{item}
            </Link>
          ))}
        </nav>
        <div className="side-foot"><b>Phase 2</b><span>Guarded control-plane foundation</span></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><small>INSUREIT / ENGINEERING</small><b>{active === "Home" ? "Developer Workspace" : "Configuration Registry"}</b></div>
          <div className="top-actions"><span className="secure">● Protected workspace</span><DeveloperIdentityBadge /><a href="https://insureit.tech">insureit.tech ↗</a></div>
        </header>
        {children}
      </section>
    </main>
  );
}
