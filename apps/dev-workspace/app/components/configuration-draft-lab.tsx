"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

const CURRENT_PUBLIC_SUBTITLE = "InsureIT Tech is the engineering identity behind our operations portal, customer experience, partner experience and workflow automation systems.";

type RegistryResponse = {
  mode: string;
  firstConfigKey: string;
  identity: {
    fullName: string | null;
    email: string | null;
    assuranceLevel: "aal1" | "aal2" | "unknown";
    capabilities: string[];
    draftWriteEligible: boolean;
  };
  registry: Array<{
    key: string;
    label: string;
    description: string;
    validation: Record<string, unknown>;
    preview_enabled: boolean;
    consumer_status: string;
  }>;
  revisions: Array<{
    id: string;
    revision: number;
    value: unknown;
    state: string;
    change_note: string | null;
    source_revision_id: string | null;
    created_at: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    revision_id: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  publishEnabled: false;
  productionConsumerConnected: false;
};

function shortId(id: string) {
  return id.slice(0, 8);
}

function actionLabel(action: string) {
  return action === "rollback_preview_created" ? "Rollback preview created" : "Preview draft created";
}

export default function ConfigurationDraftLab() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [value, setValue] = useState(CURRENT_PUBLIC_SUBTITLE);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Loading protected registry…");
  const [busy, setBusy] = useState(false);

  async function token() {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) {
      setMessage("Sign in with an IT Super User account to open the registry.");
      setData(null);
      return;
    }

    const response = await fetch("/api/control-plane/registry", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Registry could not be loaded.");
      setData(null);
      return;
    }

    setData(result);
    if (result.revisions?.[0] && typeof result.revisions[0].value === "string") {
      setValue(result.revisions[0].value);
    }
    setMessage(result.identity.draftWriteEligible
      ? "AAL2 verified. Preview drafts are enabled; production publishing remains disabled."
      : "Read access verified. MFA/AAL2 is required before saving a preview draft.");
  }

  useEffect(() => { void load(); }, []);

  const keyDefinition = useMemo(() => data?.registry.find(item => item.key === data.firstConfigKey), [data]);

  async function post(body: Record<string, unknown>) {
    const accessToken = await token();
    if (!accessToken) {
      setMessage("Developer sign-in is required.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/control-plane/registry", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Preview action failed.");
        return;
      }

      setMessage(`Revision ${result.revision.revision} saved. Immutable audit evidence was recorded; production was not changed.`);
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section className="panel config-panel draft-lab refined-draft-lab">
        <div className="panel-head refined-panel-head">
          <div><span>FIRST CONTROLLED CONFIG</span><h2>Preview workspace</h2><p>Sign in to load the protected, versioned configuration registry.</p></div>
          <small className="status-pill locked">Locked</small>
        </div>
        <a className="primary-action-link" href="/login">Open Developer Sign In</a>
      </section>
    );
  }

  return (
    <section className="panel config-panel draft-lab refined-draft-lab">
      <div className="panel-head refined-panel-head">
        <div>
          <span>FIRST CONTROLLED CONFIG</span>
          <h2>InsureIT Tech hero subtitle</h2>
          <p>Draft and compare a safe copy change without touching the public site.</p>
        </div>
        <div className="panel-head-actions">
          <span className="status-pill verified">AAL2 verified</span>
          <span className="status-pill locked">Publish locked</span>
        </div>
      </div>

      <div className="draft-security-strip refined-security-strip">
        <div><span>Developer</span><b>{data.identity.fullName || data.identity.email || "IT Super User"}</b><small>Protected identity</small></div>
        <div><span>Assurance</span><b>{data.identity.assuranceLevel.toUpperCase()}</b><small>MFA-backed session</small></div>
        <div><span>Registry state</span><b>{data.revisions.length ? `${data.revisions.length} revision${data.revisions.length === 1 ? "" : "s"}` : "No revisions yet"}</b><small>Append-only history</small></div>
        <div><span>Production impact</span><b>None</b><small>Consumer disconnected</small></div>
      </div>

      <div className="draft-grid refined-draft-grid">
        <div className="draft-editor refined-draft-editor">
          <div className="editor-heading">
            <div><span>EDIT DRAFT</span><h3>Supporting copy</h3></div>
            <span className="draft-count">{value.length}/240</span>
          </div>

          <label>
            <span>Hero subtitle</span>
            <textarea
              value={value}
              maxLength={240}
              onChange={event => setValue(event.target.value)}
              placeholder="Enter proposed hero subtitle…"
            />
            <small>This is prefilled from the current public site when no registry revision exists.</small>
          </label>

          <label>
            <span>Change note</span>
            <input
              value={note}
              maxLength={300}
              onChange={event => setNote(event.target.value)}
              placeholder="Describe why this change is being proposed…"
            />
          </label>

          <div className="draft-action-row">
            <button
              type="button"
              className="primary-draft-button"
              disabled={busy || !data.identity.draftWriteEligible || !value.trim()}
              onClick={() => void post({ action: "draft", configKey: data.firstConfigKey, value, changeNote: note })}
            >
              {busy ? "Saving revision…" : data.identity.draftWriteEligible ? "Save preview revision" : "MFA/AAL2 required"}
            </button>
            <span>No autosave · production unchanged</span>
          </div>

          <div className="draft-message-box">
            <i />
            <p>{message}</p>
          </div>
        </div>

        <div className="draft-preview refined-draft-preview">
          <div className="editor-heading">
            <div><span>LIVE PREVIEW</span><h3>Public hero context</h3></div>
            <span className="preview-only-tag">Workspace only</span>
          </div>

          <div className="tech-preview-card refined-tech-preview">
            <div className="preview-brand-row">
              <img src="https://raw.githubusercontent.com/Frontier-Group-IT/insureit_new/main/apps/mobile-app/assets/brand/insureit-app-icon-ice.png" alt="" />
              <div><b>InsureIT</b><span>TECH</span></div>
            </div>
            <small>INSUREIT / ENGINEERING</small>
            <strong>We build the technology layer behind <em>insurance operations.</em></strong>
            <p>{value.trim() || "Your proposed supporting copy appears here."}</p>
            <div className="preview-actions"><span>Explore engineering →</span><span>Open production portal ↗</span></div>
          </div>
          <div className="preview-safety-note"><i /> This preview never writes to <b>insureit.tech</b>.</div>
        </div>
      </div>

      <div className="history-audit-grid">
        <section className="revision-history refined-history">
          <div className="panel-head refined-panel-head compact">
            <div><span>APPEND-ONLY HISTORY</span><h2>Preview revisions</h2></div>
            <small>{data.revisions.length} revisions</small>
          </div>

          {data.revisions.length === 0 ? (
            <div className="empty-history">
              <span>01</span>
              <div><b>No preview revisions yet</b><p>Save the first revision above. It will appear here permanently with its audit evidence.</p></div>
            </div>
          ) : data.revisions.map((revision, index) => (
            <article className="revision-row refined-revision-row" key={revision.id}>
              <div className="revision-index">{String(data.revisions.length - index).padStart(2, "0")}</div>
              <div className="revision-copy">
                <div className="revision-title-row">
                  <b>Revision {revision.revision}</b>
                  <span className={`status-pill ${revision.state === "rollback_draft" ? "warning" : "verified"}`}>
                    {revision.state === "rollback_draft" ? "Rollback preview" : "Draft"}
                  </span>
                </div>
                <p>{typeof revision.value === "string" ? revision.value : JSON.stringify(revision.value)}</p>
                <small>{revision.change_note || "No change note"} · {new Date(revision.created_at).toLocaleString()}</small>
              </div>
              <div className="revision-actions">
                <button type="button" onClick={() => setValue(typeof revision.value === "string" ? revision.value : "")}>Preview</button>
                <button
                  type="button"
                  disabled={busy || !data.identity.draftWriteEligible}
                  onClick={() => void post({
                    action: "rollback_preview",
                    configKey: data.firstConfigKey,
                    sourceRevisionId: revision.id,
                    changeNote: `Rollback preview from r${revision.revision}`
                  })}
                >Rollback as new draft</button>
              </div>
            </article>
          ))}
        </section>

        <section className="audit-preview refined-audit">
          <div className="panel-head refined-panel-head compact">
            <div><span>AUDIT EVIDENCE</span><h2>Immutable events</h2></div>
            <small>{data.audit.length} events</small>
          </div>
          {data.audit.length === 0 ? (
            <div className="empty-audit"><i /> No audit events yet. The first saved preview revision creates one automatically.</div>
          ) : (
            <div className="audit-list">
              {data.audit.slice(0, 8).map(event => (
                <div className="audit-row" key={event.id}>
                  <i />
                  <div>
                    <b>{actionLabel(event.action)}</b>
                    <span>Revision {shortId(event.revision_id)} · {new Date(event.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="audit-integrity-note"><span>✓</span><p>Audit rows and configuration revisions cannot be updated or deleted by the application.</p></div>
        </section>
      </div>
    </section>
  );
}
