"use client";

import { useState } from "react";

type Item = { id: string; auth_user_id: string; actor_kind: string; actor_id: string; intermediary_id: string | null; status: string; requested_at: string; updated_at: string; completed_at: string | null; resolution_note: string | null };
type Preflight = { safe_to_auto_delete: boolean; profile_dependencies: unknown[]; partner_portal_accounts: unknown[]; associate_accounts: unknown[]; profile: unknown; group_associate_account_count: number; learning_attempt_count: number; auth_delete_cascade_risks: string[]; required_checks: string[] };
export function PartnerDeletionQueue({ initial }: { initial: Item[] }) {
  const [items,setItems] = useState(initial);
  const [selected,setSelected] = useState<string | null>(null);
  const [preflight,setPreflight] = useState<Preflight | null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [note,setNote] = useState("");
  const inspect = async (id: string) => {
    setSelected(id); setPreflight(null); setMessage(""); setBusy(true);
    try {
      const r = await fetch(`/api/admin/partner-deletion-requests/preflight?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Preflight unavailable");
      setPreflight(d as Preflight);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Preflight unavailable"); }
    finally { setBusy(false); }
  };
  const act = async (id: string, action: "start_review" | "decline") => {
    if (action === "decline" && (!note.trim() || !window.confirm("Decline this request? Include a clear documented reason."))) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/admin/partner-deletion-requests", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to update request");
      setItems(old => old.map(x => x.id === id ? { ...x, status: d.request.status, updated_at: d.request.updated_at, resolution_note: action === "decline" ? note : x.resolution_note } : x));
      setMessage("Request status updated. No identity data was deleted.");
    } catch(e) { setMessage(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3">
    {message && <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{message}</p>}
    {items.length === 0 && <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">No Partner deletion requests recorded.</p>}
    {items.map(x => <section key={x.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{x.actor_kind === "employee" ? "Employee" : "Partner / Associate"} · {x.status.replaceAll("_"," ")}</p>
          <p className="mt-1 break-all text-xs text-slate-500">Request {x.id}</p>
          <p className="text-xs text-slate-500">Submitted {new Date(x.requested_at).toLocaleString("en-IN")}</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void inspect(x.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">Inspect dependencies</button>
      </div>
      {selected === x.id && <div className="space-y-3 border-t border-slate-200 pt-3">
        {preflight && <>
          <p className="text-sm font-semibold text-red-700">Automatic deletion is not authorized</p>
          <p className="text-xs text-slate-500">Auth ID: {x.auth_user_id}</p>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">Protected references: {preflight.profile_dependencies.length}</div>
            <div className="rounded-lg bg-slate-50 p-3">Partner logins: {preflight.partner_portal_accounts.length}</div>
            <div className="rounded-lg bg-slate-50 p-3">Associate logins: {preflight.associate_accounts.length}</div>
          </div>
          <p className="text-xs font-semibold text-red-700">Auth deletion can cascade to: {preflight.auth_delete_cascade_risks.join(", ")}</p>
          <p className="text-xs text-slate-600">Group associate logins: {preflight.group_associate_account_count}; learning attempts: {preflight.learning_attempt_count}. Do not run generic Auth deletion.</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">{preflight.required_checks.map(c => <li key={c}>{c}</li>)}</ul>
          {x.status === "requested" && <button type="button" disabled={busy} onClick={() => void act(x.id,"start_review")} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Start review</button>}
          {x.status === "under_review" && <div className="space-y-2">
            <label className="block text-xs font-medium">Reason if request cannot be fulfilled as asked</label>
            <textarea aria-label="Decline reason" value={note} onChange={e => setNote(e.target.value)} maxLength={500} className="w-full rounded-lg border border-slate-300 p-2 text-sm" rows={2}/>
            <button type="button" disabled={busy || note.trim().length < 10} onClick={() => void act(x.id,"decline")} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Decline with explanation</button>
          </div>}
        </>}
      </div>}
    </section>)}
  </div>;
}
