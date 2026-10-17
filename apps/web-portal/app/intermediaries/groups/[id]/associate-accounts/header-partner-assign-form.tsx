"use client";
import {useRef,useState} from "react";
import {Plus,X} from "lucide-react";
import {assignBusinessGroupMembers} from "../../business-group-actions";
import {FormSubmitButton} from "@/components/form-submit-button";

type Choice={id:string;display_name:string;partner_code:string};
export function GroupHeaderPartnerAssignForm({groupId,choices}:{groupId:string;choices:Choice[]}) {
 const [selected,setSelected]=useState("");
 const dialog=useRef<HTMLDialogElement>(null);
 const close=()=>dialog.current?.close();
 return <>
   <button type="button" onClick={()=>dialog.current?.showModal()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#17365D] px-3 text-[11px] font-semibold text-white hover:bg-[#234B7C]"><Plus className="h-4 w-4"/>Add Partner</button>
   <dialog ref={dialog} aria-labelledby="add-group-partner-title" className="w-[min(94vw,520px)] rounded-2xl border border-[#DCE5EF] bg-white p-0 shadow-2xl backdrop:bg-[#071D3D]/55">
   <div className="flex items-center justify-between border-b border-[#E7ECF3] px-5 py-4"><h2 id="add-group-partner-title" className="text-[15px] font-semibold text-[#17365D]">Add Partner to Group</h2><button type="button" onClick={close} aria-label="Close Add Partner" className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA]"><X className="h-4 w-4"/></button></div>
   <form action={assignBusinessGroupMembers} className="space-y-4 p-5">
   <input type="hidden" name="group_id" value={groupId}/>
   <input type="hidden" name="return_group_id" value={groupId}/>
   <label className="block text-[11px] font-semibold text-[#64748B]" htmlFor="group-header-partner-choice">Select ungrouped Partner</label>
   <select id="group-header-partner-choice" name="partner_id" required value={selected} onChange={e=>setSelected(e.target.value)} className="h-10 w-full rounded-lg border border-[#D7E0EA] bg-white px-3 text-[11px] text-[#17365D]">
     <option value="">Select ungrouped Partner</option>
     {choices.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.partner_code}</option>)}
   </select>
   <div className="flex justify-end gap-2"><button type="button" onClick={close} className="h-9 rounded-lg border border-[#D7E0EA] px-4 text-[11px]">Cancel</button><FormSubmitButton disabled={!selected} label="Add to Group" pendingLabel="Adding…" className="h-9 rounded-lg bg-[#17365D] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"/></div>
   </form>
   </dialog>
 </>;
}
