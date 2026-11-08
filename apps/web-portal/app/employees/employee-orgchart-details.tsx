"use client";

import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, ChevronRight, Handshake, Mail, MapPin, Pencil, Phone, Shield, UserRound, Users, X } from "lucide-react";
import { EmployeeEditForm, EmployeePortalInviteForm, EmployeePortalRoleForm, type EmployeeRow, type PortalRoleOption } from "./employee-forms";
import type { DirectoryPartner } from "./employee-organization-tree";
import { PartnerRelationships } from "./partner-relationships";

type Tab = "profile" | "reporting" | "network" | "access";

export function EmployeeOrgchartDetails({
  employee, manager, reports, partners, managers, portalRoles, canManage, canManagePortalAccess, onClose, onFocus,
}: {
  employee: EmployeeRow | null;
  manager: EmployeeRow | undefined;
  reports: EmployeeRow[];
  partners: DirectoryPartner[];
  managers: Pick<EmployeeRow, "id" | "employee_code" | "full_name">[];
  portalRoles: PortalRoleOption[];
  canManage: boolean;
  canManagePortalAccess: boolean;
  onClose: () => void;
  onFocus: (employeeId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const employeeId = employee?.id;
  useEffect(() => { setTab("profile"); setEditing(false); }, [employeeId]);
  useEffect(() => {
    if (!employee) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [employeeId, onClose, employee]);
  if (!employee) return null;
  const canSeeAccess = canManagePortalAccess;
  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "reporting", label: "Reporting" },
    { key: "network", label: "Network" },
    ...(canSeeAccess ? [{ key: "access" as Tab, label: "Portal access" }] : []),
  ];

  return <div className="absolute inset-0 z-40 flex justify-end" data-testid="employee-details-drawer">
    <button aria-label="Close employee details" type="button" onClick={onClose} className="absolute inset-0 cursor-default bg-[#102846]/20 backdrop-blur-[1px]" />
    <aside role="dialog" aria-modal="true" aria-labelledby="orgchart-details-heading" className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[#DCE5EF] bg-white shadow-[-14px_0_35px_rgba(14,36,64,0.15)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#E5EDF6] px-5 py-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#7588A0]">Employee workspace</p><h2 id="orgchart-details-heading" className="text-[16px] font-bold text-[#112E56]">{employee.full_name}</h2></div>
        <button ref={closeRef} type="button" aria-label="Close details panel" onClick={onClose} className="rounded-md border border-[#DDE6F0] p-2 text-[#536D89] hover:bg-[#F3F7FC]"><X className="h-4 w-4" /></button>
      </header>
      <div className="border-b border-[#E5EDF6] bg-[#F8FBFF] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E7EFFC] text-[#32649C]"><UserRound className="h-6 w-6" /></div>
          <div className="min-w-0"><p className="text-[12px] font-semibold text-[#1E3C63]">{employee.designation}</p><p className="text-[10px] text-[#67809E]">{employee.department} · {employee.location || "Location not assigned"}</p><p className="mt-0.5 text-[10px] text-[#8597AA]">ID: {employee.employee_code}</p></div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full border border-[#D8E6F4] bg-white px-2.5 py-1 text-[10px] text-[#3F6285]">{employee.employment_status === "active" ? "Active employee" : "Inactive employee"}</span>
          <span className="rounded-full border border-[#D8E6F4] bg-white px-2.5 py-1 text-[10px] text-[#3F6285]">{employee.portal_status === "active" ? "Portal active" : employee.portal_status === "invited" ? "Invite pending" : "Directory only"}</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#E5EDF6] px-4 py-2" role="tablist" aria-label="Employee workspace sections">
        {tabs.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setEditing(false); }} className={`shrink-0 rounded-md px-3 py-2 text-[11px] font-semibold ${tab === key ? "bg-[#153762] text-white" : "text-[#58708E] hover:bg-[#F0F5FB]"}`}>{label}</button>)}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {tab === "profile" ? <>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[12px] font-bold text-[#1C426E]">Employee information</h3>
            {canManage ? <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md border border-[#CCDCEA] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#315E8C] hover:bg-[#EFF6FD]"><Pencil className="h-3.5 w-3.5" />{editing ? "Cancel edit" : "Edit employee"}</button> : null}
          </div>
          {editing && canManage ? <div className="rounded-lg border border-[#D6E4F2] bg-[#F8FBFF] p-3">
            <p className="mb-3 text-[10px] text-[#67809E]">Profile details use the existing authorized save workflow. Employee code and reporting changes are locked here pending the separate governed change workflow.</p>
            <EmployeeEditForm key={employee.id} employee={employee} managers={managers} compact />
          </div> : <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#F5F8FC] p-3"><p className="text-[9px] uppercase tracking-wide text-[#8A9AAD]">Department</p><p className="mt-1 text-[11px] font-semibold text-[#23456B]">{employee.department}</p></div>
              <div className="rounded-lg bg-[#F5F8FC] p-3"><p className="text-[9px] uppercase tracking-wide text-[#8A9AAD]">Vertical</p><p className="mt-1 text-[11px] font-semibold text-[#23456B]">{employee.vertical || "Not set"}</p></div>
            </div>
            <p className="flex items-center gap-2 text-[11px] text-[#516882]"><BriefcaseBusiness className="h-4 w-4 text-[#96A9BE]" />{employee.designation}</p>
            <p className="flex items-center gap-2 text-[11px] text-[#516882]"><MapPin className="h-4 w-4 text-[#96A9BE]" />{employee.location || "Location unavailable"}</p>
            {employee.email ? <p className="flex items-center gap-2 break-all text-[11px] text-[#516882]"><Mail className="h-4 w-4 shrink-0 text-[#96A9BE]" />{employee.email}</p> : null}
            {employee.phone ? <p className="flex items-center gap-2 text-[11px] text-[#516882]"><Phone className="h-4 w-4 text-[#96A9BE]" />{employee.phone}</p> : null}
          </div>}
        </> : null}
        {tab === "reporting" ? <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#F2F7FD] p-3"><p className="text-[20px] font-bold text-[#214978]">{reports.length}</p><p className="text-[10px] text-[#7C8FA5]">Direct reports</p></div>
            <div className="rounded-lg bg-[#EFF8F3] p-3"><p className="text-[20px] font-bold text-[#167056]">{partners.length}</p><p className="text-[10px] text-[#7C8FA5]">Assigned intermediaries</p></div>
          </div>
          <h3 className="text-[11px] font-bold text-[#23466F]">Reporting manager</h3>
          {manager ? <button type="button" onClick={() => onFocus(manager.id)} className="flex w-full items-center justify-between rounded-lg border border-[#DFE9F3] bg-white px-3 py-3 text-left text-[11px] font-semibold text-[#315A83] hover:bg-[#F2F7FC]">{manager.full_name}<ChevronRight className="h-4 w-4" /></button> : <p className="text-[11px] text-[#7A8FA6]">No linked manager within your visible directory.</p>}
          {reports.length ? <><h3 className="flex items-center gap-2 text-[11px] font-bold text-[#23466F]"><Users className="h-4 w-4" />Direct reports</h3><div className="max-h-72 space-y-1 overflow-y-auto">{reports.map((person) => <button key={person.id} type="button" onClick={() => onFocus(person.id)} className="flex w-full items-center justify-between rounded-lg bg-[#F6F9FD] px-3 py-2 text-left text-[11px] text-[#3C6184] hover:bg-[#EAF3FC]">{person.full_name}<ChevronRight className="h-4 w-4" /></button>)}</div></> : null}
          <p className="rounded-md bg-[#F7FAFC] p-3 text-[10px] text-[#697E94]">Reporting-manager changes are handled through the employee editor and must not automatically reassign partners.</p>
        </> : null}
        {tab === "network" ? <>
          <h3 className="flex items-center gap-2 text-[12px] font-bold text-[#17634E]"><Handshake className="h-4 w-4" />Assigned business network ({partners.length})</h3>
          {partners.length ? <div className="space-y-2">{partners.map((partner) => <section key={partner.id} className="rounded-lg border border-[#D9E9E1] bg-[#F9FDFB] p-3"><p className="text-[11px] font-semibold text-[#245D4B]">{partner.name}</p><p className="mt-0.5 text-[9.5px] text-[#728E82]">{partner.kind.toUpperCase()} · {partner.code || "Registration pending"}</p><PartnerRelationships partner={partner} compact /></section>)}</div> : <p className="rounded-lg border border-dashed border-[#D7E5DE] p-6 text-center text-[11px] text-[#748B80]">No assigned partners in your visible network.</p>}
        </> : null}
        {tab === "access" && canSeeAccess ? <>
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-[#39658E]" /><h3 className="text-[12px] font-bold text-[#214978]">Portal account management</h3></div>
          <p className="text-[10px] leading-4 text-[#73869D]">This section uses existing portal-account permissions. Editing employee details does not grant role-management privileges.</p>
          {employee.profile_id ? <EmployeePortalRoleForm key={employee.id} employee={employee} portalRoles={portalRoles} /> : <EmployeePortalInviteForm key={employee.id} employee={employee} portalRoles={portalRoles} />}
        </> : null}
      </div>
      <footer className="border-t border-[#E5EDF6] bg-[#F9FBFD] px-5 py-3 text-[10px] text-[#8091A6]">Permanent employee deletion is not available in the Organization Explorer.</footer>
    </aside>
  </div>;
}
