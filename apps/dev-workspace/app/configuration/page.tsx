import WorkspaceShell from "../components/workspace-shell";
import { ACTION_CONTRACTS } from "../../lib/control-plane/contracts";
import { CONFIGURATION_CANDIDATES, CONFIGURATION_READINESS } from "../../lib/control-plane/configuration";
import { getWorkspaceSessionBoundary } from "../../lib/control-plane/session";

export const metadata = {
  title: "Configuration Registry · InsureIT Developer Workspace",
  robots: { index: false, follow: false }
};

const apps = ["portal", "partner", "customer", "tech"] as const;

export default function ConfigurationPage() {
  const session = getWorkspaceSessionBoundary();

  return (
    <WorkspaceShell active="Configuration">
      <div className="configuration-page">
        <header className="configuration-header">
          <div>
            <span className="eyebrow">PHASE 2 / CONFIGURATION FOUNDATION</span>
            <h1>Configuration Registry</h1>
            <p>Define which small changes can eventually be managed without editing source code. These entries remain proposals only; none are live production settings.</p>
          </div>
          <div className="mode-card"><span>SECURITY MODE</span><strong>Read only</strong><p>No editing, publishing, approval, rollback, database migration or release action is enabled.</p></div>
        </header>

        <section className="config-stats">
          <article><span>Candidate keys</span><strong>{CONFIGURATION_CANDIDATES.length}</strong><small>Awaiting per-app integration</small></article>
          <article><span>Live keys</span><strong>{CONFIGURATION_READINESS.connectedProductionKeys}</strong><small>No app consumes registry yet</small></article>
          <article><span>Capabilities</span><strong>{session.capabilities.length}</strong><small>App identity not configured</small></article>
          <article><span>Publish controls</span><strong>Disabled</strong><small>Action Gateway deny-all</small></article>
        </section>

        <section className="panel config-panel security-boundary">
          <div className="panel-head"><div><span>SESSION BOUNDARY</span><h2>Infrastructure protection is not application authorization.</h2></div><small>CAPABILITIES: 0</small></div>
          <div className="boundary-grid">
            <div><span>Infrastructure gate</span><b>Vercel Authentication</b><small>Active deployment-level protection</small></div>
            <div><span>App identity</span><b>Not configured</b><small>No developer principal is trusted yet</small></div>
            <div><span>MFA</span><b>Required before writes</b><small>Not implemented in app layer</small></div>
            <div><span>Mutation policy</span><b>Deny all</b><small>{session.reason}</small></div>
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-head"><div><span>CANDIDATE SCHEMA</span><h2>Managed settings blueprint</h2></div><small>NO PRODUCTION WRITES</small></div>
          {apps.map(app => <div className="config-app" key={app}>
            <h3>{app === "tech" ? "InsureIT Tech" : app === "portal" ? "Operations Portal" : app === "partner" ? "Partner App" : "Customer App"}</h3>
            {CONFIGURATION_CANDIDATES.filter(item => item.app === app).map(item => (
              <div className="config-item" key={item.key}>
                <div className="config-definition"><b>{item.label}</b><code>{item.key}</code><p>{item.description}</p><small>Validation: {item.validation}</small></div>
                <div className="config-right"><span className="state warn">Proposed</span><small>{item.type}</small><strong>Not connected</strong></div>
              </div>
            ))}
          </div>)}
        </section>

        <section className="panel config-panel">
          <div className="panel-head"><div><span>ACTION GATEWAY</span><h2>Permission and risk contracts</h2></div><small>DENY BY DEFAULT</small></div>
          <p className="config-intro">Each future mutation must pass authenticated identity, capability checks, audit logging, approval requirements and rollback planning before execution.</p>
          <div className="contract-list">
            {ACTION_CONTRACTS.map(item => <div className="contract-item" key={item.kind}><code>{item.kind}</code><span>{item.capability}</span><span className="state muted">{item.risk}</span><b>Disabled</b></div>)}
          </div>
        </section>

        <section className="panel config-panel">
          <div className="panel-head"><div><span>ACTIVATION PREREQUISITES</span><h2>Before the first editable field</h2></div></div>
          <p className="config-intro">Next: application-level developer identity + MFA, persistent versioned registry with strict authorization, immutable audit evidence, preview and rollback. Then integrate exactly one low-risk key into a consuming application before publishing is allowed.</p>
        </section>
      </div>
    </WorkspaceShell>
  );
}
