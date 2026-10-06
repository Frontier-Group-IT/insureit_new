import WorkspaceShell from "../components/workspace-shell";
import ConfigurationDraftLab from "../components/configuration-draft-lab";
import { ACTION_CONTRACTS } from "../../lib/control-plane/contracts";
import { CONFIGURATION_CANDIDATES, CONFIGURATION_READINESS } from "../../lib/control-plane/configuration";

export const metadata = {
  title: "Configuration Registry · InsureIT Developer Workspace",
  robots: { index: false, follow: false }
};

const apps = ["portal", "partner", "customer", "tech"] as const;

export default function ConfigurationPage() {
  return (
    <WorkspaceShell active="Configuration">
      <div className="configuration-page">
        <header className="configuration-header">
          <div>
            <span className="eyebrow">PHASE 2B / VERSIONED REGISTRY</span>
            <h1>Configuration Registry</h1>
            <p>Small changes can now be drafted inside a protected, versioned registry. Drafts are append-only and audited. No live InsureIT application consumes these values yet, so production publishing remains disabled.</p>
          </div>
          <div className="mode-card"><span>SECURITY MODE</span><strong>Draft preview</strong><p>AAL2 IT Super User can save preview revisions only. Publish, production rollback, database migration and release actions remain disabled.</p></div>
        </header>

        <section className="config-stats">
          <article><span>Registry keys</span><strong>{CONFIGURATION_CANDIDATES.length}</strong><small>Stored with strict RLS</small></article>
          <article><span>Preview-enabled</span><strong>{CONFIGURATION_READINESS.previewEnabledKeys}</strong><small>First controlled key only</small></article>
          <article><span>Published revisions</span><strong>{CONFIGURATION_READINESS.publishedRevisions}</strong><small>No production consumer connected</small></article>
          <article><span>Publish controls</span><strong>Disabled</strong><small>Production write gateway still closed</small></article>
        </section>

        <section className="panel config-panel security-boundary">
          <div className="panel-head"><div><span>SECURITY BOUNDARY</span><h2>Draft writes are isolated from production publishing.</h2></div><small>AAL2 REQUIRED</small></div>
          <div className="boundary-grid">
            <div><span>Infrastructure gate</span><b>Vercel Authentication</b><small>Deployment-level access remains protected.</small></div>
            <div><span>App identity</span><b>Protected IT Super User</b><small>Existing Supabase Auth + governed profile role.</small></div>
            <div><span>MFA</span><b>AAL2 for draft writes</b><small>RLS and API both enforce assurance level.</small></div>
            <div><span>Production mutation</span><b>Still denied</b><small>No application reads the registry and publish actions remain disabled.</small></div>
          </div>
        </section>

        <ConfigurationDraftLab />

        <section className="panel config-panel">
          <div className="panel-head"><div><span>REGISTRY CATALOGUE</span><h2>Managed settings blueprint</h2></div><small>1 PREVIEW KEY</small></div>
          {apps.map(app => <div className="config-app" key={app}>
            <h3>{app === "tech" ? "InsureIT Tech" : app === "portal" ? "Operations Portal" : app === "partner" ? "Partner App" : "Customer App"}</h3>
            {CONFIGURATION_CANDIDATES.filter(item => item.app === app).map(item => {
              const preview = item.key === "tech.site.hero_subtitle";
              return (
                <div className="config-item" key={item.key}>
                  <div className="config-definition"><b>{item.label}</b><code>{item.key}</code><p>{item.description}</p><small>Validation: {item.validation}</small></div>
                  <div className="config-right"><span className={`state ${preview ? "ok" : "warn"}`}>{preview ? "Preview enabled" : "Proposed"}</span><small>{item.type}</small><strong>{preview ? "Not connected to production" : "Not connected"}</strong></div>
                </div>
              );
            })}
          </div>)}
        </section>

        <section className="panel config-panel">
          <div className="panel-head"><div><span>ACTION GATEWAY</span><h2>Permission and risk contracts</h2></div><small>PRODUCTION DENY BY DEFAULT</small></div>
          <p className="config-intro">Only append-only preview-draft actions can currently pass the gateway. Publish, release, database and infrastructure mutations remain denied.</p>
          <div className="contract-list">
            {ACTION_CONTRACTS.map(item => {
              const previewAction = item.kind === "config.draft" || item.kind === "config.rollback_preview";
              return <div className="contract-item" key={item.kind}><code>{item.kind}</code><span>{item.capability}</span><span className={`state ${previewAction ? "ok" : "muted"}`}>{item.risk}</span><b>{previewAction ? "AAL2 preview" : "Disabled"}</b></div>;
            })}
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-head"><div><span>NEXT ACTIVATION GATE</span><h2>Before the first live consumer</h2></div></div>
          <p className="config-intro">Next we must add MFA enrollment/challenge UX, verify append-only audit and rollback-preview behavior with a real IT Super User session, then connect exactly one low-risk field to the public InsureIT Tech site behind a safe fallback. Publishing will remain a separate explicit action with revision preconditions and rollback.</p>
        </section>
      </div>
    </WorkspaceShell>
  );
}
