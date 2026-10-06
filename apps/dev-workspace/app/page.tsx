import LiveOverview from "./components/live-overview";

const products = [
  { name: "Operations Portal", path: "apps/web-portal", detail: "Next.js 15 · React 19 · MUI · Supabase", status: "Production" },
  { name: "Customer App", path: "apps/mobile-app", detail: "Expo 54 · React Native 0.81 · OTA", status: "0.3.0" },
  { name: "Partner App", path: "apps/partner-app", detail: "Expo 54 · React Native 0.81 · OTA", status: "0.2.0" },
  { name: "InsureIT Tech", path: "apps/tech-site", detail: "Public engineering identity", status: "Production" }
];

const nav = ["Home", "Apps", "Configuration", "Content", "Assets", "Features", "Code", "Releases", "Database", "Infrastructure", "Integrations", "Observability", "AI Developer", "Docs", "Security", "Audit"];

export default function DeveloperHome() {
  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <img src="https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/apps/web-portal/public/assets/brand/insureit-mark.webp" alt="InsureIT" />
          <span>DEV</span>
        </div>
        <div className="environment"><i /> DEVELOPMENT CONTROL PLANE</div>
        <nav>{nav.map((item, i) => <a key={item} className={i === 0 ? "active" : ""} href={item === "Home" ? "/" : item === "Configuration" ? "/configuration" : "#roadmap"}><span>{String(i + 1).padStart(2, "0")}</span>{item}</a>)}</nav>
        <div className="side-foot"><b>Phase 0 / 1</b><span>Read-only foundation</span></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><small>INSUREIT / ENGINEERING</small><b>Developer Workspace</b></div>
          <div className="top-actions"><span className="secure">● Protected workspace</span><a href="https://insureit.tech">insureit.tech ↗</a></div>
        </header>

        <div className="page">
          <section className="hero">
            <div>
              <span className="eyebrow">CONTROL PLANE FOUNDATION</span>
              <h1>Run InsureIT from one engineering workspace.</h1>
              <p>The workspace now reads live engineering state from safe observability adapters while remaining strictly read-only. Infrastructure writes are intentionally disabled until the Action Gateway and capability model are implemented.</p>
            </div>
            <div className="mode-card">
              <span>OPERATING MODE</span>
              <strong>Read only</strong>
              <p>Observe first. Write actions will be introduced only through typed, permission-aware workflows with audit and rollback.</p>
            </div>
          </section>

          <LiveOverview />

          <section className="panel product-inventory">
            <div className="panel-head"><div><span>MONOREPO INVENTORY</span><h2>Known product surfaces</h2></div><small>4 APPS</small></div>
            <div className="app-list">{products.map((p) => <div className="app-row" key={p.name}><div className="app-icon">{p.name.slice(0, 1)}</div><div><b>{p.name}</b><code>{p.path}</code><small>{p.detail}</small></div><span>{p.status}</span></div>)}</div>
          </section>

          <section className="panel architecture">
            <div className="panel-head"><div><span>CONTROL MODEL</span><h2>Action Gateway comes before write access.</h2></div><small>SECURITY BOUNDARY</small></div>
            <div className="flow">
              <div><b>Developer</b><small>Human intent</small></div><em>→</em>
              <div><b>Workspace</b><small>UI + AI</small></div><em>→</em>
              <div className="focus"><b>Action Gateway</b><small>Policy · risk · audit</small></div><em>→</em>
              <div><b>Providers</b><small>GitHub · Vercel · Expo · Supabase</small></div>
            </div>
          </section>

          <section className="panel roadmap" id="roadmap">
            <div className="panel-head"><div><span>IMPLEMENTATION ROADMAP</span><h2>Build capability in controlled layers.</h2></div><small>NO SHORTCUTS</small></div>
            <div className="roadmap-grid">
              {[
                ["01", "Foundation", "Private Next.js workspace, protected deployment, product inventory."],
                ["02", "Observability", "GitHub, Vercel and Supabase read-only health, releases and logs."],
                ["03", "Configuration", "Versioned settings, content, assets and feature flags with rollback."],
                ["04", "Release Center", "PR checks, merge eligibility, deployments and OTA through existing workflows."],
                ["05", "Database", "Schema browser, migration state, advisors and controlled apply/verify."],
                ["06", "AI Developer", "Natural-language operations through the same typed Action Gateway."]
              ].map(([n,t,d]) => <article key={n}><span>{n}</span><b>{t}</b><p>{d}</p></article>)}
            </div>
          </section>

          <footer><span>InsureIT Engineering Control Plane</span><span>Phase 1 · live read-only observability</span></footer>
        </div>
      </section>
    </main>
  );
}
