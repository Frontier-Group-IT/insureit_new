"use client";

import { useActionState, useState } from "react";
import { resetUserTemporaryPassword, type PasswordResetState } from "./password-actions";

const initialState: PasswordResetState = { ok: false, message: "", temporaryPassword: null };

export function AdminPasswordReset({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(resetUserTemporaryPassword.bind(null, userId), initialState);
  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-semibold text-slate-900">IT Super User · Temporary password</p>
      <p className="text-[11px] text-slate-600">Issues a unique password for account verification. Never use a shared portal-wide password.</p></div>
      <button type="button" onClick={() => setExpanded(v => !v)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold">{expanded ? "Close" : "Reset password"}</button>
    </div>
    {expanded && <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium">Type RESET to confirm <input aria-label="Confirm password reset" name="confirm" autoComplete="off" required className="ml-2 rounded border px-2 py-1.5" /></label>
      <button type="submit" disabled={pending} className="rounded bg-[#17365D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Resetting…" : "Issue temporary password"}</button>
    </form>}
    {state.message && <p role="status" className="mt-2 text-xs text-slate-800">{state.message}</p>}
    {state.temporaryPassword && <div className="mt-2 rounded border border-amber-300 bg-white p-2"><p className="text-[10px] font-semibold">Copy now — shown only after reset</p><code className="break-all text-sm">{state.temporaryPassword}</code><button type="button" onClick={() => navigator.clipboard.writeText(state.temporaryPassword!)} className="ml-3 text-xs font-semibold underline">Copy</button></div>}
  </section>;
}
