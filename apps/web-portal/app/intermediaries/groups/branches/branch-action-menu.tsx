"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Send, CheckCircle2 } from "lucide-react";
import { PermanentDeleteButton } from "@/components/permanent-delete-button";
import { editSuperBranchSafely, resendSuperBranchLink, setSuperBranchLoginStatus } from "./super-actions";

type Branch = { id: string; branch_name: string; email: string | null; phone: string | null; invitation_status: string; login_disabled: boolean; contact_name: string | null; address: string | null };
export function BranchActionMenu({ branch }: { branch: Branch }) {
  const [edit,setEdit] = useState(false);
  const [editError,setEditError] = useState("");
  const [saved,setSaved] = useState(false);
  const [saving,startSaving] = useTransition();
  const router = useRouter();
  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError("");
    const data = new FormData(event.currentTarget);
    startSaving(async () => {
      try {
        const result = await editSuperBranchSafely(data);
        if (!result.ok) { setEditError(result.error || "Unable to save changes."); return; }
        setEdit(false);
        setSaved(true);
        router.refresh();
      } catch {
        setEditError("Unable to save changes. Please retry.");
      }
    });
  }
  const [confirmDisable,setConfirmDisable] = useState(false);
  const [statusPending,setStatusPending] = useState(false);
  const [statusError,setStatusError] = useState<string | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{type:"success"|"error";message:string}|null>(null);
  useEffect(() => {
    if (!resendFeedback) return;
    const handle = setTimeout(() => setResendFeedback(null), 3000);
    return () => clearTimeout(handle);
  }, [resendFeedback]);
  async function submitLoginStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (statusPending) return;
    const form = new FormData(event.currentTarget);
    setStatusPending(true);
    setStatusError(null);
    try {
      await setSuperBranchLoginStatus(form);
      setConfirmDisable(false);
      router.refresh();
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to update branch login. Please retry.");
    } finally {
      setStatusPending(false);
    }
  }
  async function submitResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resendPending) return;
    setResendPending(true);
    setResendFeedback(null);
    try {
      await resendSuperBranchLink(new FormData(event.currentTarget));
      setResendFeedback({type:"success",message:"Login link email requested successfully."});
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setResendFeedback({type:"error",message:/IT Super User permission required|Enable branch login before resending|Invalid branch ID|rate limit|too many requests/i.test(message)
        ? message
        : "Unable to send the login link. Please check branch login access or retry later."});
    } finally {
      setResendPending(false);
    }
  }
  const canChangeLoginStatus = branch.login_disabled || branch.invitation_status === "active";
  const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-35";
  return <div className="inline-flex items-center justify-center gap-2">
    <button type="button" aria-label={`Edit ${branch.branch_name}`} title="Edit" className={iconButton+" text-slate-800"} onClick={()=>{setEditError("");setSaved(false);setEdit(true);}}><Pencil className="h-4 w-4"/></button>
    <button type="button" aria-label={`${branch.login_disabled?"Enable":"Disable"} ${branch.branch_name}`} title={branch.login_disabled?"Enable":canChangeLoginStatus?"Disable":"Available only after the branch becomes Active"} disabled={!canChangeLoginStatus} className={iconButton + (branch.login_disabled ? " text-red-600 hover:bg-red-50" : "")} onClick={()=>{setStatusError(null);setConfirmDisable(true);}}>{branch.login_disabled?<CheckCircle2 className="h-4 w-4"/>:<Ban className="h-4 w-4"/>}</button>
    <form onSubmit={submitResend} className="inline-flex"><input type="hidden" name="entity_id" value={branch.id}/><button type="submit" aria-label={`Resend invitation to ${branch.branch_name}`} title={branch.login_disabled?"Enable account before resending":"Resend Link"} disabled={branch.login_disabled || resendPending} className={iconButton}>{resendPending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" aria-hidden="true"/> : <Send className="h-4 w-4"/>}</button></form>
    {resendFeedback ? <div role={resendFeedback.type==="error"?"alert":"status"} className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-lg border bg-white px-4 py-3 text-xs shadow-lg ${resendFeedback.type==="error"?"border-red-200 text-red-700":"border-green-200 text-green-700"}`}><span>{resendFeedback.message}</span><button type="button" className="ml-3 font-bold" onClick={()=>setResendFeedback(null)} aria-label="Dismiss message">×</button></div> : null}
    <PermanentDeleteButton kind="branch" id={branch.id} name={branch.branch_name} compact iconOnly />
    {confirmDisable && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 text-left shadow-xl">
        <h3 className="font-bold">{branch.login_disabled?"Enable":"Disable"} branch login?</h3>
        <p className="mt-2 text-sm text-slate-600">The branch and its business history will be preserved.</p>
        <form onSubmit={submitLoginStatus} className="mt-4 space-y-3">
          <input type="hidden" name="entity_id" value={branch.id}/>
          <input type="hidden" name="next_status" value={branch.login_disabled?"active":"disabled"}/>
          {statusError ? <p role="alert" className="text-xs text-red-700">{statusError}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={statusPending} onClick={()=>{setStatusError(null);setConfirmDisable(false);}} className="rounded border px-3 py-2 text-xs disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={statusPending} className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50">{statusPending ? "Updating…" : "Confirm"}</button>
          </div>
        </form>
      </div>
    </div>}
    {saved && <div role="status" className="fixed bottom-5 right-5 z-50 rounded-lg bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-lg">Branch saved successfully. <button type="button" className="ml-2 underline" onClick={()=>setSaved(false)}>Dismiss</button></div>}
    {edit && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 text-left shadow-xl">
        <h3 className="mb-4 text-base font-bold">Edit Branch</h3>
        <form onSubmit={submitEdit} className="grid gap-3">
          <input type="hidden" name="entity_id" value={branch.id}/>
          <label className="grid gap-1 text-xs">Branch Name<input className="rounded border p-2" name="branch_name" required defaultValue={branch.branch_name}/></label>
          <label className="grid gap-1 text-xs">Phone<input className="rounded border p-2" name="phone" required defaultValue={branch.phone||""}/></label>
          <label className="grid gap-1 text-xs">Email (change through Login Access)<input className="rounded border bg-slate-50 p-2" readOnly value={branch.email||""}/></label>
          <label className="grid gap-1 text-xs">Contact Name<input className="rounded border p-2" name="contact_name" required defaultValue={branch.contact_name||""}/></label>
          <label className="grid gap-1 text-xs">Address<textarea className="rounded border p-2" name="address" required defaultValue={branch.address||""}/></label>
          {editError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{editError}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={saving} className="rounded border px-3 py-2 text-xs" onClick={()=>setEdit(false)}>Cancel</button><button type="submit" disabled={saving} className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
