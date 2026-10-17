import { createGroupAssociate } from "./actions";
export function AssociateCreateForm({groupId,surface="operations",formId}:{groupId:string;surface?:"operations"|"partner";formId?:string}) {
 const input="h-9 w-full rounded-lg border border-[#D8DEE9] px-3 text-[11px] outline-none focus:border-blue-500";
 return <form id={formId} action={createGroupAssociate} className="grid gap-3 p-5 md:grid-cols-4">
 <input type="hidden" name="group_id" value={groupId}/><input type="hidden" name="portal_surface" value={surface}/>
 <label className="text-xs">Name *<input className={input} name="name" required/></label>
 <label className="text-xs">Phone Number *<input className={input} name="phone" required inputMode="tel"/></label>
 <label className="text-xs">Email *<input className={input} name="email" type="email" required/></label>
 <label className="text-xs">Designation *<input className={input} name="designation" required/></label>
 <label className="text-xs md:col-span-2">Address<input className={input} name="address"/></label>
 <label className="text-xs">City<input className={input} name="city"/></label>
 <label className="text-xs">State<input className={input} name="state"/></label>
 <label className="text-xs">PIN Code<input className={input} name="postal_code"/></label>
 <label className="text-xs">Role *<select className={input} name="role" defaultValue="" required><option value="" disabled>Select role</option><option value="group_admin" disabled>Group Administrator (Primary)</option><option value="insurance_head">Insurance Head</option><option value="claim_head">Claim Head</option><option value="bodyshop_manager">Bodyshop Manager</option></select></label>
 <div className="flex items-end justify-end md:col-span-2"><button className="h-10 rounded-xl bg-[#17365D] px-5 text-xs font-semibold text-white">Save Details</button></div>
 </form>;
}