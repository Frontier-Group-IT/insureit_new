"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

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

export default function ConfigurationDraftLab() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [value, setValue] = useState("");
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
    if (!value && result.revisions?.[0] && typeof result.revisions[0].value === "string") {
      setValue(result.revisions[0].value);
    }
    setMessage(result.identity.draftWriteEligible
      ? "AAL2 verified. Preview drafts are enabled; production publishing is still disabled."
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
      setMessage(`Revision ${result.revision.revision} saved as preview only. Production was not changed.`);
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <section className="panel config-panel draft-lab">
        <div className="panel-head"><div><span>FIRST CONTROLLED CONFIG</span><h2>Preview workspace</h2></div><small>LOCKED</small></div>
        <p className="config-intro">{message}</p>
        <a className="draft-login-link" href="/login">Open Developer Sign In</a>
      </section>
    );
  }

  return (
    <section className="panel config-panel draft-lab">
      <div className="panel-head">
        <div><span>FIRST CONTROLLED CONFIG</span><h2>InsureIT Tech hero subtitle</h2></div>
        <small>PREVIEW ONLY · NO PUBLISH</small>
      </div>

      <div className="draft-security-strip">
        <div><span>Identity</span><b>{data.identity.fullName || data.identity.email || "IT Super User"}</b></div>
        <div><span>Assurance</span><b>{data.identity.assuranceLevel.toUpperCase()}</b></div>
        <div><span>Consumer</span><b>{keyDefinition?.consumer_status === "preview_only" ? "Not connected" : keyDefinition?.consumer_status}</b></div>
        <div><span>Production impact</span><b>None</b></div>
      </div>

      <div className="draft-grid">
        <div className="draft-editor">
          <label>Preview value
            <textarea value={value} maxLength={240} onChange={event => setValue(event.target.value)} placeholder="Enter proposed hero subtitle…" />
          </label>
          <div className="draft-count">{value.length}/240</div>
          <label>Change note
            <input value={note} maxLength={300} onChange={event => setNote(event.target.value)} placeholder="Why are you proposing this change?" />
          </label>
          <button
            type="button"
            disabled={busy || !data.identity.draftWriteEligible || !value.trim()}
            onClick={() => void post({ action: "draft", configKey: data.firstConfigKey, value, changeNote: note })}
          >
            {busy ? "Saving…" : data.identity.draftWriteEligible ? "Save preview draft" : "MFA/AAL2 required"}
          </button>
          <p className="draft-message">{message}</p>
        </div>

        <div className="draft-preview">
          <span>VISUAL PREVIEW</span>
          <div className="tech-preview-card">
            <small>INSUREIT / ENGINEERING</small>
            <strong>We build the technology layer behind insurance operations.</strong>
            <p>{value.trim() || "Your proposed supporting copy appears here."}</p>
          </div>
          <small>This preview is local to the Developer Workspace. It does not change insureit.tech.</small>
        </div>
      </div>

      <div className="revision-history">
        <div className="panel-head"><div><span>APPEND-ONLY HISTORY</span><h2>Preview revisions</h2></div><small>{data.revisions.length} SHOWN</small></div>
        {data.revisions.length === 0 ? <p className="config-intro">No preview revisions exist yet.</p> : data.revisions.map(revision => (
          <div className="revision-row" key={revision.id}>
            <div><b>r{revision.revision} · {revision.state === "rollback_draft" ? "Rollback preview" : "Draft"}</b><small>{new Date(revision.created_at).toLocaleString()}</small><p>{typeof revision.value === "string" ? revision.value : JSON.stringify(revision.value)}</p></div>
            <div>
              <span className="state muted">{revision.state}</span>
              <button
                type="button"
                disabled={busy || !data.identity.draftWriteEligible}
                onClick={() => void post({ action: "rollback_preview", configKey: data.firstConfigKey, sourceRevisionId: revision.id, changeNote: `Rollback preview from r${revision.revision}` })}
              >Preview rollback</button>
            </div>
          </div>
        ))}
      </div>

      <div className="audit-preview">
        <span>AUDIT EVIDENCE</span>
        <p>{data.audit.length} immutable audit event{data.audit.length === 1 ? "" : "s"} recorded for this key.</p>
      </div>
    </section>
  );
}
