const products = [
  { name: "Operations Portal", path: "apps/web-portal", detail: "Next.js 15 · React 19 · MUI · Supabase", status: "Production" },
  { name: "Customer App", path: "apps/mobile-app", detail: "Expo 54 · React Native 0.81 · OTA", status: "0.3.0" },
  { name: "Partner App", path: "apps/partner-app", detail: "Expo 54 · React Native 0.81 · OTA", status: "0.2.0" },
  { name: "InsureIT Tech", path: "apps/tech-site", detail: "Public engineering identity", status: "Production" }
];

const systems = [
  ["GitHub", "Repository + CI", "Connected"],
  ["Vercel", "Portal + Tech deployments", "Connected"],
  ["Supabase", "Database · Auth · Storage", "Healthy"],
  ["Expo", "Customer + Partner releases", "Controlled"],
  ["Document AI", "Policy OCR", "Mapped"],
  ["Voice AI", "Sarvam + private-agent program", "Isolated"]
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
        <nav>{nav.map((item, i) => <a key={item} className={i === 0 ? "active" : ""} href={i === 0 ? "/" : "#roadmap"}><span>{String(i + 1).padStart(2, "0")}</span>{item}</a>)}</nav>
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
              <p>This first release establishes the private home for applications, releases, infrastructure, configuration and future controlled actions. Infrastructure writes are intentionally disabled in this phase.</p>
            </div>
            <div className="mode-card">
              <span>OPERATING MODE</span>
              <strong>Read only</strong>
              <p>Observe first. Write actions will be introduced only through typed, permission-aware workflows with audit and rollback.</p>
            </div>
          </section>

          <section className="status-grid">
            <article><span>Applications</span><strong>4</strong><small>Known product surfaces</small></article>
            <article><span>Production portal</span><strong className="ok">Healthy</strong><small>portal.insureit.in</small></article>
            <article><span>Database</span><strong className="ok">Healthy</strong><small>Supabase · ap-northeast-2</small></article>
            <article><span>Release policy</span><strong>Guarded</strong><small>Checks before merge · no auto APK</small></article>
          </section>

          <section className="two-col">
            <div className="panel">
              <div className="panel-head"><div><span>APPLICATIONS</span><h2>Product surfaces</h2></div><small>MONOREPO</small></div>
              <div className="app-list">{products.map((p) => <div className="app-row" key={p.name}><div className="app-icon">{p.name.slice(0, 1)}</div><div><b>{p.name}</b><code>{p.path}</code><small>{p.detail}</small></div><span>{p.status}</span></div>)}</div>
            </div>
            <div className="panel">
              <div className="panel-head"><div><span>INFRASTRUCTURE</span><h2>Connected systems</h2></div><small>READ ONLY</small></div>
              <div className="system-list">{systems.map(([name,detail,status]) => <div className="system-row" key={name}><i /><div><b>{name}</b><small>{detail}</small></div><span>{status}</span></div>)}</div>
            </div>
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

          <footer><span>InsureIT Engineering Control Plane</span><span>Phase 0 / 1 · foundation</span></footer>
        </div>
      </section>
    </main>
  );
}
