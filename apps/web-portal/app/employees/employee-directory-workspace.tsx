"use client";

import { useEffect, useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { setEmployeeStatus } from "./actions";
import { EmployeeEditForm, EmployeePortalInviteForm, type EmployeeRow, type PortalRoleOption } from "./employee-forms";

type ManagerOption = Pick<EmployeeRow, "id" | "employee_code" | "full_name">;

export function EmployeeDirectoryWorkspace({ employees, managers, portalRoles, canManage, canManagePortalAccess, initialQuery, initialStatus, loadError }: { employees: EmployeeRow[]; managers: ManagerOption[]; portalRoles: PortalRoleOption[]; canManage: boolean; canManagePortalAccess: boolean; initialQuery: string; initialStatus: string; loadError: string | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => employees.filter((employee) => {
    const matchesStatus = !status || employee.employment_status === status;
    const haystack = [employee.employee_code, employee.full_name, employee.phone, employee.email, employee.department, employee.designation, employee.vertical, employee.location].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && (!normalized || haystack.includes(normalized));
  }), [employees, normalized, status]);
  const activeCount = filtered.filter((employee) => employee.employment_status === "active").length;
  const portalCount = filtered.filter((employee) => employee.portal_status === "active").length;

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const nextUrl = `/employees${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, status]);

  return (
    <section className="rounded-lg border border-[#D7E6F5] bg-white p-4 shadow-[0_3px_12px_rgba(7,29,73,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#071D49]">Employee records</h2>
          <div className="grid grid-cols-3 gap-2 text-center"><Summary value={filtered.length} label="Listed" /><Summary value={activeCount} label="Active" /><Summary value={portalCount} label="Portal active" /></div>
        </div>
        <form onSubmit={(event) => event.preventDefault()} className="flex flex-wrap gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees" className="h-9 w-56 rounded-md border border-[#CBD8E8] bg-[#F8FBFF] px-3 text-[11px]" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-[#CBD8E8] bg-white px-3 text-[11px]"><option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </form>
      </div>
      {loadError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">{loadError}</p> : filtered.length ? <EmployeeTable employees={filtered} managers={managers} portalRoles={portalRoles} canManage={canManage} canManagePortalAccess={canManagePortalAccess} /> : <div className="mt-4 rounded-md border border-dashed border-[#CBD8E8] bg-[#F8FBFF] p-8 text-center text-[11px] text-[#667085]">No employees match these filters.</div>}
    </section>
  );
}

function EmployeeTable({ employees, managers, portalRoles, canManage, canManagePortalAccess }: { employees: EmployeeRow[]; managers: ManagerOption[]; portalRoles: PortalRoleOption[]; canManage: boolean; canManagePortalAccess: boolean }) {
  const showActions = canManage || canManagePortalAccess;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-y border-[#E7EEF6] bg-[#F8FBFF] text-[9px] font-bold uppercase tracking-[0.06em] text-[#667085]"><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Function</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Manager</th><th className="px-3 py-2">Access</th>{showActions ? <th className="px-3 py-2 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[#EDF2F7]">{employees.map((employee) => {
    const manager = managers.find((item) => item.id === employee.reporting_manager_id);
    const nextStatus = employee.employment_status === "active" ? "inactive" : "active";
    const statusAction = setEmployeeStatus.bind(null, employee.id, nextStatus);
    const accessClass = employee.portal_status === "active" ? "bg-[#EAF8F2] text-[#087A55]" : employee.portal_status === "invited" ? "bg-[#FFF6E5] text-[#9A6700]" : "bg-[#F1F4F8] text-[#667085]";
    const accessLabel = employee.portal_status === "active" ? "Portal active" : employee.portal_status === "invited" ? "Invite pending" : "Directory only";
    return <tr key={employee.id} className="align-top text-[11px] text-[#344054]"><td className="px-3 py-3"><p className="font-semibold text-[#071D49]">{employee.full_name}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.employee_code} - {employee.email ?? employee.phone ?? "No contact"}</p></td><td className="px-3 py-3"><p>{employee.designation}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.department}{employee.vertical ? ` - ${employee.vertical}` : ""}</p></td><td className="px-3 py-3">{employee.location ?? "-"}</td><td className="px-3 py-3">{manager?.full_name ?? employee.reporting_manager_employee_code ?? "-"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${accessClass}`}>{accessLabel}</span>{employee.portal_role ? <p className="mt-1 text-[9px] text-[#667085]">{employee.portal_role.replaceAll("_", " ")}</p> : null}</td>{showActions ? <td className="px-3 py-3 text-right"><details className="relative inline-block text-left"><summary className="cursor-pointer list-none rounded-md border border-[#CBD8E8] px-3 py-1.5 text-[10px] font-semibold text-[#071D49]">Manage</summary><div className="absolute right-0 z-20 mt-2 w-[680px] max-w-[calc(100vw-300px)] rounded-lg border border-[#CBD8E8] bg-white p-4 text-left shadow-[0_18px_45px_rgba(7,29,73,0.16)]">{canManage ? <EmployeeEditForm employee={employee} managers={managers} /> : null}{canManagePortalAccess && employee.portal_status !== "active" ? <div className={canManage ? "mt-3 border-t border-[#E7EEF6] pt-3" : ""}><EmployeePortalInviteForm employee={employee} portalRoles={portalRoles} /></div> : null}{canManage ? <form action={statusAction} className="mt-3 border-t border-[#E7EEF6] pt-3"><FormSubmitButton label={nextStatus === "inactive" ? "Deactivate employee" : "Reactivate employee"} pendingLabel={nextStatus === "inactive" ? "Deactivating" : "Reactivating"} className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD8E8] px-4 text-[10px] font-semibold text-[#344054]" /></form> : null}</div></details></td> : null}</tr>;
  })}</tbody></table></div>;
}

function Summary({ value, label }: { value: number; label: string }) {
  return <div className="min-w-14 rounded-md border border-[#D7E6F5] bg-[#F8FBFF] px-2.5 py-2"><p className="text-[15px] font-bold text-[#071D49]">{value}</p><p className="text-[8px] font-semibold uppercase tracking-[0.05em] text-[#667085]">{label}</p></div>;
}
