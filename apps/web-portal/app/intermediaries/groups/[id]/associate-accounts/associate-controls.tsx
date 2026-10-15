"use client";
import { useState } from "react";
import { manageGroupAssociate,updateGroupAssociate } from "./actions";
type Associate={id:string;name:string;phone_number:string;email:string;designation:string;address:string|null;city:string|null;state:string|null;postal_code:string|null;status:string};
export function AssociateControls({groupId,associate}:{groupId:string;associate:Associate}){
 const [editing,setEditing]=useState(false);
 const [pendingDelete,setPendingDelete]=useState(false);
 return <div className="flex items-center gap-2">
  <button type="button" className="rounded border px-2 py-1" onClick={()=>setEditing(true)}>Edit</button>
  <form action={manageGroupAssociate} onSubmit={e=>{if(pendingDelete&&!window.confirm(`Permanently delete ${associate.name}'s account?`))e.preventDefault()}}>
   <input type="hidden" name="group_id" value={groupId}/><input type="hidden" name="associate_id" value={associate.id}/>
   <select className="rounded border p-1" name="operation" onChange={e=>setPendingDelete(e.target.value==="delete")}>
    <option value="resend">Resend Link</option>
    <option value={associate.status==="disabled"?"enable":"disable"}>{associate.status==="disabled"?"Enable":"Disable"}</option>
    <option value="delete">Delete</option>
   </select>
   <button className="ml-1 rounded border px-2 py-1">Apply</button>
  </form>
  {editing?<div role="dialog" aria-modal="true" aria-label="Edit Group Associate" className="fixed inset-0 z-[300] grid place-items-center bg-slate-950/40 p-4">
   <form action={updateGroupAssociate} className="w-full max-w-xl space-y-3 rounded-2xl bg-white p-6 shadow-xl">
    <h3 className="text-lg font-semibold">Edit Group Associate</h3><p className="text-xs text-slate-600">{associate.email} · Group Administrator</p>
    <input type="hidden" name="group_id" value={groupId}/><input type="hidden" name="associate_id" value={associate.id}/>
    {([["name","Name",associate.name],["phone","Phone",associate.phone_number],["designation","Designation",associate.designation],["address","Address",associate.address??""],["city","City",associate.city??""],["state","State",associate.state??""],["postal_code","PIN",associate.postal_code??""]] as const).map(([name,label,value])=>
     <label key={name} className="block text-xs">{label}<input className="mt-1 h-9 w-full rounded-lg border p-2" name={name} defaultValue={value} required={["name","phone","designation"].includes(name)}/></label>)}
    <div className="flex justify-end gap-2"><button type="button" className="rounded border px-4 py-2" onClick={()=>setEditing(false)}>Cancel</button><button className="rounded bg-[#17365D] px-4 py-2 text-white">Save Changes</button></div>
   </form>
  </div>:null}
 </div>;
}
