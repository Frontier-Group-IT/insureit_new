import WorkspaceShell from "../components/workspace-shell";
import ConfigurationDraftLab from "../components/configuration-draft-lab";
import { ACTION_CONTRACTS } from "../../lib/control-plane/contracts";
import { CONFIGURATION_CANDIDATES, CONFIGURATION_READINESS } from "../../lib/control-plane/configuration";

export const metadata = {
  title: "Configuration Registry · InsureIT Developer Workspace",
  robots: { index: false, follow: false }
};

const apps = ["portal", "partner", "customer", "tech"] as const;

const trustCards = [
  ["01", "Infrastructure gate", "Vercel Authentication", "Deployment-level access remains protected."],
  ["02", "Identity gate", "Protected IT Super User", "Existing Supabase Auth + governed protected role."],
  ["03", "MFA gate", "AAL2 required", "Preview-draft writes require a verified MFA session."],
  ["04", "Production gate", "Publish locked", "No application consumes registry values yet."]
] as const;

export default function ConfigurationPage() {
  return (
    <WorkspaceShell active="Configuration">
      <div className="configuration-page refined-configuration-page">
        <header className="configuration-header refined-configuration-header">
          <div className="configuration-hero-copy">
            <div className="hero-kicker-row">
              <span className="eyebrow">CONFIGURATION / VERSIONED REGISTRY</span>
              <span className="phase-chip">Phase 2B</span>
            </div>
            <h1>Change small things<br /><em>without touching code.</em></h1>
            <p>Draft controlled product configuration inside a protected, append-only registry. Every revision is audited, previewed and isolated from production until a separate publish path is intentionally opened.</p>
            <div className="hero-safety-line"><i /> Production publishing is disabled by design.</div>
          </div>

          <div className="mode-card refined-mode-card">
            <div className="mode-card-top"><span>OPERATING MODE</span><i /></div>
            <strong>Draft preview</strong>
            <p>AAL2 IT Super User can create versioned preview revisions. Release, database and infrastructure mutations remain outside this phase.</p>
            <div className="mode-card-meta"><span>AAL2</span><span>Append-only</span><span>No publish</span></div>
          </div>
        </header>

        <section className="config-stats refined-config-stats">
          <article><span>Registry keys</span><strong>{CONFIGURATION_CANDIDATES.length}</strong><small>Governed definitions</small></article>
          <article><span>Preview-enabled</span><strong>{CONFIGURATION_READINESS.previewEnabledKeys}</strong><small>First controlled key</small></article>
          <article><span>Published revisions</span><strong>{CONFIGURATION_READINESS.publishedRevisions}</strong><small>Production untouched</small></article>
          <article className="locked-stat"><span>Publish controls</span><strong>Locked</strong><small>Separate future gate</small></article>
        </section>

        <section className="panel config-panel security-boundary refined-security-boundary">
          <div className="panel-head refined-panel-head">
            <div><span>TRUST BOUNDARY</span><h2>Four gates separate a draft from production.</h2><p>Each layer is independent; passing MFA does not grant publishing authority.</p></div>
            <small className="status-pill verified">AAL2 ACTIVE</small>
          </div>
          <div className="boundary-grid refined-boundary-grid">
            {trustCards.map(([number, label, value, detail]) => (
              <article key={number}>
                <div className="boundary-number">{number}</div>
                <span>{label}</span>
                <b>{value}</b>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </section>

        <ConfigurationDraftLab />

        <section className="panel config-panel refined-catalogue">
          <div className="panel-head refined-panel-head">
            <div><span>REGISTRY CATALOGUE</span><h2>Managed settings blueprint</h2><p>Only one key is activated for preview drafting. Every other setting remains a design candidate.</p></div>
            <small className="status-pill warning">1 preview key</small>
          </div>

          <div className="catalogue-grid">
            {apps.map(app => (
              <article className="catalogue-app" key={app}>
                <div className="catalogue-app-head">
                  <div className="app-symbol">{app === "portal" ? "OP" : app === "partner" ? "PA" : app === "customer" ? "CA" : "IT"}</div>
                  <div>
                    <b>{app === "tech" ? "InsureIT Tech" : app === "portal" ? "Operations Portal" : app === "partner" ? "Partner App" : "Customer App"}</b>
                    <span>{CONFIGURATION_CANDIDATES.filter(item => item.app === app).length} candidate keys</span>
                  </div>
                </div>
                <div className="catalogue-items">
                  {CONFIGURATION_CANDIDATES.filter(item => item.app === app).map(item => {
                    const preview = item.key === "tech.site.hero_subtitle";
                    return (
                      <div className="catalogue-item" key={item.key}>
                        <div>
                          <b>{item.label}</b>
                          <code>{item.key}</code>
                        </div>
                        <span className={`status-pill ${preview ? "verified" : "muted"}`}>{preview ? "Preview enabled" : "Proposed"}</span>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel config-panel refined-action-gateway">
          <div className="panel-head refined-panel-head">
            <div><span>ACTION GATEWAY</span><h2>Capabilities are explicit, not implied.</h2><p>Only append-only preview actions can currently cross the gateway.</p></div>
            <small className="status-pill locked">Production deny-by-default</small>
          </div>
          <div className="contract-list refined-contract-list">
            {ACTION_CONTRACTS.map(item => {
              const previewAction = item.kind === "config.draft" || item.kind === "config.rollback_preview";
              return (
                <div className="contract-item refined-contract-item" key={item.kind}>
                  <code>{item.kind}</code>
                  <span>{item.capability}</span>
                  <span className={`risk-dot ${item.risk}`}><i />{item.risk}</span>
                  <b className={previewAction ? "contract-enabled" : ""}>{previewAction ? "AAL2 preview" : "Disabled"}</b>
                </div>
              );
            })}
          </div>
        </section>

        <section className="next-gate-card">
          <div>
            <span className="eyebrow">NEXT ACTIVATION GATE</span>
            <h2>Prove revision + audit + rollback before connecting a consumer.</h2>
            <p>The next controlled milestone is to save the first real preview revision from your AAL2 session, verify its immutable audit event, create a second revision, and test rollback-as-new-draft. Only then should the public InsureIT Tech site be connected behind a safe fallback.</p>
          </div>
          <div className="next-gate-steps">
            <span><b>01</b> First revision</span>
            <span><b>02</b> Audit proof</span>
            <span><b>03</b> Rollback preview</span>
            <span><b>04</b> Consumer design</span>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
