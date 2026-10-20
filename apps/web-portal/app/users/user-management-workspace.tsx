"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createProfileRecord, setProfileActive, updateProfileRecord } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/ui";
import { PermanentDeleteButton } from "@/components/permanent-delete-button";
import { AdminPasswordReset } from "./admin-password-reset";
import { appRoles, designationOptions, roleLabels } from "@/lib/roles";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: keyof typeof roleLabels;
  phone: string | null;
  employee_code: string | null;
  reporting_manager_id: string | null;
  department: string | null;
  designation: string | null;
  is_active: boolean;
  direct_reports: { count: number }[];
};


const inputClass = "h-9 w-full rounded-lg border border-[#DCE4EF] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#17365D]";
function Field({label,name,defaultValue,type="text",required=false}: {label:string;name:string;defaultValue?:string;type?:string;required?:boolean}) {
 return <label className="grid gap-1 text-[10px] font-semibold text-[#475569]">{label}<input name={name} defaultValue={defaultValue} type={type} required={required} className={inputClass}/></label>;
}
function Selection({label,name,children,defaultValue,required=false}: {label:string;name:string;children:ReactNode;defaultValue?:string;required?:boolean}) {
 return <label className="grid gap-1 text-[10px] font-semibold text-[#475569]">{label}<select name={name} defaultValue={defaultValue} required={required} className={inputClass}>{children}</select></label>;
}
function Dialog({title,children,onClose}: {title:string;children:ReactNode;onClose:()=>void}) {
 useEffect(()=>{
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  return ()=>{document.body.style.overflow=previous;};
 },[]);
 return createPortal(
  <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[#071D49]/55 p-3 sm:p-5" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
   <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[calc(100dvh-24px)] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-[#DCE4EF] bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-40px)]">
    <div className="mb-4 flex items-center justify-between border-b border-[#E8EEF5] pb-3"><h2 className="text-[16px] font-bold text-[#17203A]">{title}</h2><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg border border-[#DCE4EF] px-3 py-1 text-sm">×</button></div>
    {children}
   </section>
  </div>,
  document.body
 );
}

export function UserManagementWorkspace({users,managers,canPermanentDelete,initialQuery,initialRole,initialStatus,loadError}: {users:ProfileRow[];managers:{id:string;full_name:string;role:string}[];canPermanentDelete:boolean;initialQuery:string;initialRole:string;initialStatus:string;loadError:string|null}) {
 const [query,setQuery]=useState(initialQuery);
 const [role,setRole]=useState(initialRole);
 const [status,setStatus]=useState(initialStatus);
 const [createOpen,setCreateOpen]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null);
 const editingUser=users.find(u=>u.id===editingId);
 const employeeRoles=appRoles.filter(r=>r!=="customer");
 const filtered=useMemo(()=>users.filter(u=>{
  const haystack=[u.full_name,u.email,u.phone,u.employee_code,u.department,u.designation,u.role].filter(Boolean).join(" ").toLowerCase();
  return (!role||u.role===role)&&(!status||(status==="active"?u.is_active:!u.is_active))&&haystack.includes(query.trim().toLowerCase());
 }),[users,query,role,status]);
 const active=users.filter(u=>u.is_active).length;
 const roleCount=new Set(users.map(u=>u.role)).size;
 useEffect(()=>{
  const p=new URLSearchParams();
  if(query.trim())p.set("q",query.trim());
  if(role)p.set("role",role);
  if(status)p.set("status",status);
  const url=`/users${p.size?"?"+p.toString():""}`;
  if(window.location.pathname+window.location.search!==url)window.history.replaceState(null,"",url);
 },[query,role,status]);
 return <>
  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
   {([{label:"Total Users",value:users.length,filter:""},{label:"Active",value:active,filter:"active"},{label:"Inactive",value:users.length-active,filter:"inactive"},{label:"Roles",value:roleCount,filter:"roles"}] as const).map(m=><button key={m.label} type="button" onClick={()=>{if(m.filter==="roles"){setRole("");setStatus("");}else {setStatus(s=>s===m.filter?"":m.filter);}}} className={`rounded-xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 ${status===m.filter&&m.filter!=="roles"?"border-[#17365D] bg-[#E9F1FB]":"border-[#DCE4EF] bg-white"}`}><p className="text-[10px] font-semibold text-[#64748B]">{m.label}</p><p className="mt-1 text-[21px] font-bold text-[#17365D]">{m.value}</p></button>)}
  </div>
  <section className="rounded-2xl border border-[#DCE4EF] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,.04)]">
   <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EEF5] pb-3">
    <div className="flex items-center gap-2"><h2 className="text-[14px] font-bold text-[#17203A]">User Register</h2><span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[9px] font-bold text-[#64748B]">{filtered.length}</span></div>
    <button type="button" onClick={()=>setCreateOpen(true)} className="rounded-lg bg-[#17365D] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#102C4D]">+ Create User</button>
   </div>
   <div className="my-3 grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
    <input aria-label="Search users" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, email, phone, employee code" className={inputClass}/>
    <select aria-label="Filter by role" value={role} onChange={e=>setRole(e.target.value)} className={inputClass}><option value="">All roles</option>{employeeRoles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</select>
    <select aria-label="Filter by status" value={status} onChange={e=>setStatus(e.target.value)} className={inputClass}><option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
   </div>
   {loadError?<div className="rounded-lg border border-red-200 p-4 text-xs text-red-700">{loadError}</div>:filtered.length?<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[9px] uppercase text-[#64748B]"><tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2 text-center">Reports</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{filtered.map(u=><tr key={u.id} className="hover:bg-[#F7FAFD]"><td className="px-3 py-2.5"><div className="font-bold text-[#17365D]">{u.full_name}</div><div className="text-[9px] text-[#64748B]">{u.email??u.employee_code??u.id}</div></td><td className="px-3 py-2.5">{roleLabels[u.role]??u.role}</td><td className="px-3 py-2.5">{u.phone??"—"}</td><td className="px-3 py-2.5 text-center">{u.direct_reports?.[0]?.count??0}</td><td className="px-3 py-2.5"><StatusBadge status={u.is_active?"Active":"Closed"}/></td><td className="px-3 py-2.5 text-right"><button type="button" onClick={()=>setEditingId(u.id)} className="rounded-lg border border-[#DCE4EF] px-3 py-1.5 font-semibold text-[#17365D] hover:bg-[#EEF4FA]">Manage</button></td></tr>)}</tbody></table></div>:<div className="p-6 text-center text-xs text-[#64748B]">No users found</div>}
  </section>
  {createOpen&&<Dialog title="Create User" onClose={()=>setCreateOpen(false)}><form action={createProfileRecord} className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
   <Field label="Email" name="email" type="email" required/><Field label="Temporary password" name="password" type="password" required/><Field label="Full name" name="full_name" required/>
   <Field label="Phone" name="phone"/><Field label="Employee code" name="employee_code"/>
   <Selection label="Role" name="role" required><option value="">Select</option>{employeeRoles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</Selection>
   <Selection label="Reporting manager" name="reporting_manager_id"><option value="">Select</option>{managers.map(m=><option key={m.id} value={m.id}>{m.full_name} ({roleLabels[m.role as keyof typeof roleLabels]??m.role})</option>)}</Selection>
   <Field label="Department" name="department"/><Selection label="Designation" name="designation"><option value="">Select</option>{designationOptions.map(d=><option key={d} value={d}>{d}</option>)}</Selection>
   <div className="flex justify-end gap-2 sm:col-span-2 md:col-span-3"><button type="button" onClick={()=>setCreateOpen(false)} className="rounded-lg border border-[#DCE4EF] px-4 py-2 text-xs">Cancel</button><FormSubmitButton label="Create profile" pendingLabel="Creating" className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"/></div>
  </form></Dialog>}
  {editingUser&&<Dialog title={`Manage User — ${editingUser.full_name}`} onClose={()=>setEditingId(null)}><ManageUser key={editingUser.id} user={editingUser} managers={managers} canPermanentDelete={canPermanentDelete} onClose={()=>setEditingId(null)}/></Dialog>}
 </>;
}
function ManageUser({user,managers,canPermanentDelete,onClose}:{user:ProfileRow;managers:{id:string;full_name:string;role:string}[];canPermanentDelete:boolean;onClose:()=>void}) {
 const updateAction=updateProfileRecord.bind(null,user.id);
 const toggleAction=setProfileActive.bind(null,user.id,!user.is_active);
 return <div className="space-y-4">
  <form action={updateAction} className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
   <Field name="full_name" label="Full name" defaultValue={user.full_name}/><Field name="email" label="Email" defaultValue={user.email??""}/><Field name="phone" label="Phone" defaultValue={user.phone??""}/>
   <Field name="employee_code" label="Employee code" defaultValue={user.employee_code??""}/>
   <Selection name="role" label="Role" defaultValue={user.role}>{appRoles.map(r=><option key={r} value={r}>{roleLabels[r]}</option>)}</Selection>
   <Selection name="reporting_manager_id" label="Reporting manager" defaultValue={user.reporting_manager_id??""}><option value="">No reporting manager</option>{managers.filter(m=>m.id!==user.id).map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</Selection>
   <Field name="department" label="Department" defaultValue={user.department??""}/>
   <Selection name="designation" label="Designation" defaultValue={user.designation??""}><option value="">Select designation</option>{designationOptions.map(d=><option key={d} value={d}>{d}</option>)}</Selection>
   <input type="hidden" name="is_active" value={user.is_active?"true":"false"}/>
   <div className="flex justify-end gap-2 sm:col-span-2 md:col-span-3"><button type="button" onClick={onClose} className="rounded-lg border border-[#DCE4EF] px-4 py-2 text-xs">Cancel</button><FormSubmitButton label="Save" pendingLabel="Saving" className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"/></div>
  </form>
  {canPermanentDelete && <AdminPasswordReset userId={user.id} />}
  <div className="flex flex-wrap items-center gap-2 border-t border-[#E8EEF5] pt-3"><form action={toggleAction}><FormSubmitButton label={user.is_active?"Deactivate":"Reactivate"} pendingLabel="Updating" className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-bold text-[#17365D]"/></form>{canPermanentDelete&&<PermanentDeleteButton kind="user" id={user.id} name={user.full_name}/>}</div>
 </div>;
}
