"use client";

import { useState } from "react";
import { PermanentDeleteButton } from "@/components/permanent-delete-button";
import { editSuperBranch, resendSuperBranchLink, setSuperBranchLoginStatus } from "./super-actions";

type Branch = { id: string; branch_name: string; email: string | null; phone: string | null; invitation_status: string; login_disabled: boolean; contact_name: string | null; address: string | null };
export function BranchActionMenu({ branch }: { branch: Branch }) {
  const [open,setOpen] = useState(false);
  const [edit,setEdit] = useState(false);
  const [confirmDisable,setConfirmDisable] = useState(false);
  const button = "block w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-100";
  return <div className="relative inline-block text-left">
    <button type="button" aria-label={`Actions for ${branch.branch_name}`} aria-expanded={open} onClick={()=>setOpen(!open)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">•••</button>
    {open && <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
      <button className={button} onClick={()=>{setEdit(true);setOpen(false)}}>✎ Edit</button>
      <form action={resendSuperBranchLink}><input type="hidden" name="entity_id" value={branch.id}/><button disabled={branch.login_disabled} className={button+" disabled:opacity-40"}>✉ Resend Link</button></form>
      <button className={button} onClick={()=>{setConfirmDisable(true);setOpen(false)}}>{branch.login_disabled?"Enable":"Disable"}</button>
      <div className="border-t border-slate-100 p-1"><PermanentDeleteButton kind="branch" id={branch.id} name={branch.branch_name} compact /></div>
    </div>}
    {confirmDisable && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 text-left shadow-xl">
        <h3 className="font-bold">{branch.login_disabled?"Enable":"Disable"} branch login?</h3>
        <p className="mt-2 text-sm text-slate-600">The branch and its business history will be preserved.</p>
        <form action={setSuperBranchLoginStatus} className="mt-4 flex justify-end gap-2">
          <input type="hidden" name="entity_id" value={branch.id}/>
          <input type="hidden" name="next_status" value={branch.login_disabled?"active":"disabled"}/>
          <button type="button" onClick={()=>setConfirmDisable(false)} className="rounded border px-3 py-2 text-xs">Cancel</button>
          <button className="rounded bg-slate-900 px-3 py-2 text-xs text-white">Confirm</button>
        </form>
      </div>
    </div>}
    {edit && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 text-left shadow-xl">
        <h3 className="mb-4 text-base font-bold">Edit Branch</h3>
        <form action={editSuperBranch} className="grid gap-3">
          <input type="hidden" name="entity_id" value={branch.id}/>
          <label className="grid gap-1 text-xs">Branch Name<input className="rounded border p-2" name="branch_name" required defaultValue={branch.branch_name}/></label>
          <label className="grid gap-1 text-xs">Phone<input className="rounded border p-2" name="phone" required defaultValue={branch.phone||""}/></label>
          <label className="grid gap-1 text-xs">Email (change through Login Access)<input className="rounded border bg-slate-50 p-2" readOnly value={branch.email||""}/></label>
          <label className="grid gap-1 text-xs">Contact Name<input className="rounded border p-2" name="contact_name" required defaultValue={branch.contact_name||""}/></label>
          <label className="grid gap-1 text-xs">Address<textarea className="rounded border p-2" name="address" required defaultValue={branch.address||""}/></label>
          <div className="flex justify-end gap-2"><button type="button" className="rounded border px-3 py-2 text-xs" onClick={()=>setEdit(false)}>Cancel</button><button className="rounded bg-slate-900 px-3 py-2 text-xs text-white">Save changes</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
