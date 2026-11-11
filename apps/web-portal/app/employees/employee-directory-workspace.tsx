"use client";

import { useEffect, useMemo, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import Link from "next/link";
import { Plus, Search, Network, List } from "lucide-react";
import { EmployeeOrganizationTree, type DirectoryPartner } from "./employee-organization-tree";
import { EmployeeExplorerCommand } from "./employee-explorer-command";
import { setEmployeeStatus } from "./actions";
import { EmployeeEditForm, EmployeePortalInviteForm, EmployeePortalRoleForm, type EmployeeRow, type PortalRoleOption } from "./employee-forms";

type ManagerOption = Pick<EmployeeRow, "id" | "employee_code" | "full_name">;

export function EmployeeDirectoryWorkspace({ employees, partners, partnerNetworkError, managers, portalRoles, canManage, canManagePortalAccess, scopeLabel, initialQuery, initialStatus, loadError }: { employees: EmployeeRow[]; partners: DirectoryPartner[]; partnerNetworkError: boolean; managers: ManagerOption[]; portalRoles: PortalRoleOption[]; canManage: boolean; canManagePortalAccess: boolean; scopeLabel: string | null; initialQuery: string; initialStatus: string; loadError: string | null }) {
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<"tree" | "table">("tree");
  const [status, setStatus] = useState(initialStatus);
  const [focusRequest, setFocusRequest] = useState<{ employeeId: string; sequence: number } | null>(null);
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(() => employees.filter((employee) => {
    const matchesStatus = !status || employee.employment_status === status;
    const haystack = [employee.employee_code, employee.full_name, employee.phone, employee.email, employee.department, employee.designation, employee.vertical, employee.location].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && (!normalized || haystack.includes(normalized));
  }), [employees, normalized, status]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const nextUrl = `/employees${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, status]);

  const visibleEmployees = employees.filter((employee) => !status || employee.employment_status === status);

  return (
    <section className="overflow-hidden rounded-xl border border-[#D7E4F1] bg-white shadow-[0_3px_16px_rgba(7,29,73,0.05)]">
      <header className="border-b border-[#E5EDF6] px-4 py-3 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold tracking-[-0.025em] text-[#071D49]">Employee directory</h1>
            <p className="mt-0.5 text-[10px] text-[#64758C]">{scopeLabel ?? "Explore reporting lines and assigned distribution partners."}</p>
          </div>
          {canManage ? <Link href="/employees/new" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#102D57] px-3 text-[10.5px] font-semibold text-white shadow-sm transition hover:bg-[#1A477E]"><Plus className="h-3.5 w-3.5" /> Add employee</Link> : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 shrink-0 items-center rounded-md border border-[#D1DEED] bg-[#F4F8FD] p-0.5 text-[10px] font-semibold">
            <button type="button" onClick={() => setView("tree")} aria-pressed={view === "tree"} className={`inline-flex h-full items-center gap-1.5 rounded px-3 transition ${view === "tree" ? "bg-[#112F5A] text-white shadow-sm" : "text-[#456280] hover:text-[#153D6C]"}`}><Network className="h-3.5 w-3.5" />Org chart</button>
            <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} className={`inline-flex h-full items-center gap-1.5 rounded px-3 transition ${view === "table" ? "bg-[#112F5A] text-white shadow-sm" : "text-[#456280] hover:text-[#153D6C]"}`}><List className="h-3.5 w-3.5" />Table</button>
          </div>
          <label className="flex h-9 min-w-[190px] flex-1 items-center gap-2 rounded-md border border-[#D2DEEC] bg-[#FAFCFF] px-3 focus-within:border-[#6499D6] sm:max-w-[380px]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#7790AB]" />
            <input aria-label="Search employees and partners" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, partner, POSP or MISP" className="w-full min-w-0 bg-transparent text-[11px] text-[#1B3555] outline-none placeholder:text-[#8A9AAF]" />
          </label>
          <EmployeeExplorerCommand employees={visibleEmployees} partners={partners} onChoose={(employeeId) => { setQuery(""); setView("tree"); setFocusRequest((previous) => ({ employeeId, sequence: (previous?.sequence ?? 0) + 1 })); }} />
          <select aria-label="Employee status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-[#D2DEEC] bg-white px-3 text-[10.5px] text-[#284263]"><option value="">All employees</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <span className="ml-auto whitespace-nowrap text-[10px] font-medium text-[#71839B]">{visibleEmployees.length} employees{view === "tree" ? ` · ${partners.filter((partner) => visibleEmployees.some((employee) => employee.id === partner.employeeId)).length} intermediaries` : ""}</span>
        </div>
      </header>
      {loadError ? <p className="m-4 rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">{loadError}</p> : view === "tree" ? <>
        <EmployeeOrganizationTree employees={visibleEmployees} partners={partners} query={query} focusRequest={focusRequest} managers={managers} portalRoles={portalRoles} canManage={canManage} canManagePortalAccess={canManagePortalAccess} />
        {partnerNetworkError ? <p className="mx-4 mb-3 text-[10px] text-amber-700">Partner network is temporarily unavailable. Employee hierarchy is still displayed.</p> : null}
      </> : filtered.length ? <div className="px-4 pb-4"><EmployeeTable employees={filtered} managers={managers} portalRoles={portalRoles} canManage={canManage} canManagePortalAccess={canManagePortalAccess} /></div> : <div className="m-4 rounded-md border border-dashed border-[#CBD8E8] bg-[#F8FBFF] p-8 text-center text-[11px] text-[#667085]">No employees match these filters.</div>}
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
    return <tr key={employee.id} className="align-top text-[11px] text-[#344054]"><td className="px-3 py-3"><p className="font-semibold text-[#071D49]">{employee.full_name}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.employee_code} - {employee.email ?? employee.phone ?? "No contact"}</p></td><td className="px-3 py-3"><p>{employee.designation}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.department}{employee.vertical ? ` - ${employee.vertical}` : ""}</p></td><td className="px-3 py-3">{employee.location ?? "-"}</td><td className="px-3 py-3">{manager?.full_name ?? employee.reporting_manager_employee_code ?? "-"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${accessClass}`}>{accessLabel}</span>{employee.portal_role ? <p className="mt-1 text-[9px] text-[#667085]">{employee.portal_role.replaceAll("_", " ")}</p> : null}</td>{showActions ? <td className="px-3 py-3 text-right"><details className="relative inline-block text-left"><summary className="cursor-pointer list-none rounded-md border border-[#CBD8E8] px-3 py-1.5 text-[10px] font-semibold text-[#071D49]">Manage</summary><div className="absolute right-0 z-20 mt-2 w-[680px] max-w-[calc(100vw-300px)] rounded-lg border border-[#CBD8E8] bg-white p-4 text-left shadow-[0_18px_45px_rgba(7,29,73,0.16)]">{canManage ? <EmployeeEditForm employee={employee} managers={managers} /> : null}{canManagePortalAccess && employee.profile_id ? <div className={canManage ? "mt-3 border-t border-[#E7EEF6] pt-3" : ""}><EmployeePortalRoleForm employee={employee} portalRoles={portalRoles} /></div> : null}{canManagePortalAccess && !employee.profile_id ? <div className={canManage ? "mt-3 border-t border-[#E7EEF6] pt-3" : ""}><EmployeePortalInviteForm employee={employee} portalRoles={portalRoles} /></div> : null}{canManage ? <form action={statusAction} className="mt-3 border-t border-[#E7EEF6] pt-3"><FormSubmitButton label={nextStatus === "inactive" ? "Deactivate employee" : "Reactivate employee"} pendingLabel={nextStatus === "inactive" ? "Deactivating" : "Reactivating"} className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD8E8] px-4 text-[10px] font-semibold text-[#344054]" /></form> : null}</div></details></td> : null}</tr>;
  })}</tbody></table></div>;
}

