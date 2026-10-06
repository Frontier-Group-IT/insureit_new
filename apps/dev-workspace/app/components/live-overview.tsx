"use client";

import { useEffect, useState } from "react";
import type { ObservabilitySnapshot, ProviderStatus } from "../../lib/observability";

function statusClass(item: ProviderStatus) {
  return `state ${item.tone}`;
}

function shortSha(sha: string | null | undefined) {
  return sha ? sha.slice(0, 8) : "Unavailable";
}

export default function LiveOverview() {
  const [data, setData] = useState<ObservabilitySnapshot | null>(null);
  const [error, setError] = useState(false);

  async function refresh() {
    try {
      const response = await fetch("/api/observability", { cache: "no-store" });
      if (!response.ok) throw new Error("status");
      setData(await response.json());
      setError(false);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);

  if (!data) {
    return <section className="live-loading">{error ? "Live observability unavailable." : "Loading live engineering state…"}</section>;
  }

  const appRows = [data.applications.portal, data.applications.tech, data.applications.developer];
  const latest = data.repository.workflows[0];

  return (
    <>
      <section className="status-grid">
        <article><span>Main branch</span><strong>{shortSha(data.repository.sha)}</strong><small>Live GitHub commit</small></article>
        <article><span>Open PRs</span><strong>{data.repository.openPullRequests ?? "—"}</strong><small>Current repository queue</small></article>
        <article><span>Latest workflow</span><strong className={latest?.conclusion === "failure" ? "bad" : "ok"}>{latest ? (latest.status === "completed" ? latest.conclusion : latest.status) : "Unavailable"}</strong><small>{latest?.name ?? "GitHub Actions"}</small></article>
        <article><span>Last refresh</span><strong>{new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong><small>Auto-refreshes every 60 seconds</small></article>
      </section>

      <section className="two-col">
        <div className="panel">
          <div className="panel-head"><div><span>LIVE APPLICATIONS</span><h2>Production surfaces</h2></div><button className="refresh-button" onClick={refresh}>Refresh</button></div>
          <div className="system-list">
            {appRows.map((item) => <div className="system-row" key={item.name}><i className={item.tone} /><div><b>{item.name}</b><small>{item.detail}</small></div><span className={statusClass(item)}>{item.status}</span></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><span>LIVE PROVIDERS</span><h2>Infrastructure state</h2></div><small>READ ONLY</small></div>
          <div className="system-list">
            {data.providers.map((item) => <div className="system-row" key={item.name}><i className={item.tone} /><div><b>{item.name}</b><small>{item.detail}</small></div><span className={statusClass(item)}>{item.status}</span></div>)}
          </div>
        </div>
      </section>

      <section className="panel workflows">
        <div className="panel-head"><div><span>GITHUB ACTIONS</span><h2>Recent workflows</h2></div><small>{data.credentials.githubAuthenticated ? "TOKEN AUTH" : "PUBLIC READ"}</small></div>
        <div className="workflow-list">
          {data.repository.workflows.slice(0, 6).map((run) => (
            <a href={run.url} target="_blank" rel="noreferrer" className="workflow-row" key={run.id}>
              <div><b>{run.name}</b><small>{shortSha(run.sha)} · {new Date(run.createdAt).toLocaleString()}</small></div>
              <span className={`state ${run.conclusion === "failure" ? "error" : run.status !== "completed" ? "warn" : "ok"}`}>{run.status === "completed" ? run.conclusion : run.status}</span>
            </a>
          ))}
        </div>
        <div className="credential-note">
          <span>Provider depth</span>
          <p>Vercel management API: <b>{data.credentials.vercelManagement ? "configured" : "not configured"}</b> · Supabase management API: <b>{data.credentials.supabaseManagement ? "configured" : "not configured"}</b>. Missing read credentials reduce detail only; they do not enable writes.</p>
        </div>
      </section>
    </>
  );
}
