import Link from "next/link";
import { ACTION_CONTRACTS } from "../../lib/control-plane/contracts";
import { CONFIGURATION_CANDIDATES, CONFIGURATION_READINESS } from "../../lib/control-plane/configuration";

export const metadata = {
  title: "Configuration Registry · InsureIT Developer Workspace",
  robots: { index: false, follow: false }
};

const apps = ["portal", "partner", "customer", "tech"] as const;

export default function ConfigurationPage() {
  return (
    <main className="configuration-page">
      <header className="configuration-header">
        <div>
          <Link href="/" className="back-link">← Developer Home</Link>
          <span className="eyebrow">PHASE 2 / DESIGN REGISTRY</span>
          <h1>Configuration Registry</h1>
          <p>Define which small changes can eventually be managed without editing source code. These entries are <b>proposals only</b>, not live production settings.</p>
        </div>
        <div className="mode-card"><span>SECURITY MODE</span><strong>Read only</strong><p>No editing, publishing, approval, rollback, database migration or release action is enabled.</p></div>
      </header>

      <section className="config-stats">
        <article><span>Candidate keys</span><strong>{CONFIGURATION_CANDIDATES.length}</strong><small>Awaiting per-app integration</small></article>
        <article><span>Live keys</span><strong>{CONFIGURATION_READINESS.connectedProductionKeys}</strong><small>No app consumes registry yet</small></article>
        <article><span>Published revisions</span><strong>{CONFIGURATION_READINESS.publishedRevisions}</strong><small>Audit ledger not installed</small></article>
        <article><span>Publish controls</span><strong>Disabled</strong><small>Action Gateway not enabled</small></article>
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
        <p className="config-intro">Each future mutation must pass authentication, capability checks, audit logging, approval requirements and rollback planning before execution.</p>
        <div className="contract-list">
          {ACTION_CONTRACTS.map(item => <div className="contract-item" key={item.kind}><code>{item.kind}</code><span>{item.capability}</span><span className="state muted">{item.risk}</span><b>Disabled</b></div>)}
        </div>
      </section>

      <section className="panel config-panel">
        <div className="panel-head"><div><span>ACTIVATION PREREQUISITES</span><h2>Before the first editable field</h2></div></div>
        <p className="config-intro">Next: implement developer-specific identity + MFA, a server-side policy evaluator, persistent versioned registry with strict RLS, immutable audit evidence, preview and rollback. Integrate one low-risk key into the consuming app before publishing is allowed.</p>
      </section>
    </main>
  );
}
