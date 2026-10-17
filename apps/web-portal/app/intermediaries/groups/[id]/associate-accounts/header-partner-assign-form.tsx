"use client";
import {useState} from "react";
import {assignBusinessGroupMembers} from "../../business-group-actions";
import {FormSubmitButton} from "@/components/form-submit-button";

type Choice={id:string;display_name:string;partner_code:string};
export function GroupHeaderPartnerAssignForm({groupId,choices}:{groupId:string;choices:Choice[]}) {
 const [selected,setSelected]=useState("");
 return <form action={assignBusinessGroupMembers} className="flex min-w-0 items-center gap-2" onClick={e=>e.stopPropagation()}>
   <input type="hidden" name="group_id" value={groupId}/>
   <input type="hidden" name="return_group_id" value={groupId}/>
   <label className="sr-only" htmlFor="group-header-partner-choice">Add / move Partner</label>
   <select id="group-header-partner-choice" name="partner_id" required value={selected} onChange={e=>setSelected(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#D7E0EA] bg-white px-2 text-[10px] text-[#17365D] sm:w-[220px]">
     <option value="">Select ungrouped Partner</option>
     {choices.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.partner_code}</option>)}
   </select>
   <FormSubmitButton disabled={!selected} label="Add to Group" pendingLabel="Adding…" className="h-9 shrink-0 rounded-lg border border-[#D7E0EA] bg-white px-3 text-[10px] font-semibold text-[#3156B8] disabled:cursor-not-allowed disabled:opacity-45"/>
 </form>;
}
