"use client";

import { useEffect, useMemo, useState } from "react";
import { setProfileActive, updateProfileRecord } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { StatusBadge } from "@/components/ui";
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

export function UserManagementWorkspace({ users, managers, initialQuery, initialRole, initialStatus, loadError }: { users: ProfileRow[]; managers: { id: string; full_name: string; role: string }[]; initialQuery: string; initialRole: string; initialStatus: string; loadError: string | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [role, setRole] = useState(initialRole);
  const [status, setStatus] = useState(initialStatus);
  const normalized = query.trim().toLowerCase();
  const employeeRoles = appRoles.filter((item) => item !== "customer");
  const filtered = useMemo(() => users.filter((user) => {
    const matchesRole = !role || user.role === role;
    const matchesStatus = status === "active" ? user.is_active : status === "inactive" ? !user.is_active : true;
    const haystack = [user.full_name, user.email, user.phone, user.employee_code, user.department, user.designation, user.role].filter(Boolean).join(" ").toLowerCase();
    return matchesRole && matchesStatus && (!normalized || haystack.includes(normalized));
  }), [normalized, role, status, users]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    const nextUrl = `/users${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, role, status]);

  return <>
    <form onSubmit={(event) => event.preventDefault()} className="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-4">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone, employee code" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" />
      <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All roles</option>{employeeRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
    </form>
    {loadError ? <ClientDataError message={loadError} /> : filtered.length ? <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/72"><table className="w-full min-w-[900px] text-left text-[11.5px]"><thead className="border-b border-[#E7E8F3] bg-[#F7F8FF]/95 uppercase tracking-[0.08em] text-[#77809A]"><tr><th className="px-4 py-3 text-[9px]">User</th><th className="px-4 py-3 text-[9px]">Role</th><th className="px-4 py-3 text-[9px]">Phone</th><th className="px-4 py-3 text-[9px]">Reports</th><th className="px-4 py-3 text-[9px]">Status</th><th className="px-4 py-3 text-[9px]">Edit</th></tr></thead><tbody className="divide-y divide-[#EEF0F6] bg-white/75">{filtered.map((user) => <tr key={user.id} className="hover:bg-[#F6F4FF]"><td className="px-4 py-3.5"><p className="font-semibold text-navy-900">{user.full_name}</p><p className="text-xs text-slate-500">{user.email ?? user.employee_code ?? user.id}</p></td><td className="px-4 py-3.5">{roleLabels[user.role] ?? user.role}</td><td className="px-4 py-3.5">{user.phone ?? "-"}</td><td className="px-4 py-3.5">{user.direct_reports?.[0]?.count ?? 0}</td><td className="px-4 py-3.5"><StatusBadge status={user.is_active ? "Active" : "Closed"} /></td><td className="px-4 py-3.5"><InlineEditForm user={user} managers={managers} /></td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-[#CFCBFF] bg-white p-8 text-center"><p className="text-[13px] font-semibold text-[#303550]">No users found</p></div>}
  </>;
}

function InlineEditForm({ user, managers }: { user: ProfileRow; managers: { id: string; full_name: string; role: string }[] }) {
  const updateAction = updateProfileRecord.bind(null, user.id);
  const toggleAction = setProfileActive.bind(null, user.id, !user.is_active);
  return <div className="min-w-72 space-y-2"><form action={updateAction} className="grid gap-2"><input name="full_name" defaultValue={user.full_name} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input name="email" defaultValue={user.email ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input name="phone" defaultValue={user.phone ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><input name="employee_code" defaultValue={user.employee_code ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><select name="role" defaultValue={user.role} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">{appRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select><select name="reporting_manager_id" defaultValue={user.reporting_manager_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="">No reporting manager</option>{managers.filter((item) => item.id !== user.id).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select><input name="department" defaultValue={user.department ?? ""} placeholder="Department" className="rounded-xl border border-slate-200 px-3 py-2 text-xs" /><select name="designation" defaultValue={user.designation ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs"><option value="">Select designation</option>{designationOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><input type="hidden" name="is_active" value={user.is_active ? "true" : "false"} /><FormSubmitButton label="Save" pendingLabel="Saving" className="inline-flex items-center justify-center rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-70" /></form><form action={toggleAction}><FormSubmitButton label={user.is_active ? "Deactivate" : "Reactivate"} pendingLabel={user.is_active ? "Deactivating" : "Reactivating"} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-navy-900 disabled:cursor-not-allowed disabled:opacity-70" /></form></div>;
}

function ClientDataError({ message }: { message: string }) {
  return <div className="rounded-2xl border border-red-100 bg-red-50/75 px-4 py-4 text-red-700"><p className="text-[13px] font-semibold">Unable to load records</p><p className="mt-1 text-[12px]">{message}</p></div>;
}
