"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ChevronRight, GitBranch, Handshake, Network, UserRound } from "lucide-react";
import type { EmployeeRow } from "./employee-forms";

export type DirectoryPartner = {
  id: string;
  applicationId: string;
  employeeId: string;
  name: string;
  code: string | null;
  kind: "partner" | "posp" | "misp";
  status: string;
  branches: { id: string; name: string; code: string | null }[];
};

function normalized(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase().trim();
}

const kindLabel = { partner: "Partner", posp: "POSP", misp: "MISP" } as const;

export function EmployeeOrganizationTree({ employees, partners, query }: { employees: EmployeeRow[]; partners: DirectoryPartner[]; query: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showPartners, setShowPartners] = useState(true);
  const [focus, setFocus] = useState("");
  const search = normalized(query);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const children = useMemo(() => {
    const result = new Map<string, EmployeeRow[]>();
    for (const employee of employees) {
      if (!employee.reporting_manager_id || !employeeById.has(employee.reporting_manager_id) || employee.reporting_manager_id === employee.id) continue;
      const list = result.get(employee.reporting_manager_id) ?? [];
      list.push(employee);
      result.set(employee.reporting_manager_id, list);
    }
    for (const list of result.values()) list.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return result;
  }, [employees, employeeById]);
  const partnerByEmployee = useMemo(() => {
    const result = new Map<string, DirectoryPartner[]>();
    for (const partner of partners) {
      if (!employeeById.has(partner.employeeId)) continue;
      const list = result.get(partner.employeeId) ?? [];
      list.push(partner);
      result.set(partner.employeeId, list);
    }
    for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [partners, employeeById]);

  const matchedIds = useMemo(() => {
    if (!search) return null;
    const ids = new Set<string>();
    const matches = (employee: EmployeeRow) => [employee.full_name, employee.employee_code, employee.department, employee.designation, employee.location].some((s) => normalized(s).includes(search));
    for (const employee of employees) {
      if (!matches(employee) && !(partnerByEmployee.get(employee.id) ?? []).some((p) => [p.name, p.code, kindLabel[p.kind]].some((s) => normalized(s).includes(search)))) continue;
      let current: EmployeeRow | undefined = employee;
      const visited = new Set<string>();
      while (current && !visited.has(current.id)) {
        visited.add(current.id);
        ids.add(current.id);
        current = current.reporting_manager_id ? employeeById.get(current.reporting_manager_id) : undefined;
      }
    }
    return ids;
  }, [employees, employeeById, partnerByEmployee, search]);
  const roots = useMemo(() => employees.filter((employee) => !employee.reporting_manager_id || !employeeById.has(employee.reporting_manager_id) || employee.reporting_manager_id === employee.id).sort((a, b) => a.full_name.localeCompare(b.full_name)), [employees, employeeById]);
  const rootList = focus && employeeById.has(focus) ? [employeeById.get(focus)!] : roots;
  const visibleRootList = matchedIds ? rootList.filter((employee) => matchedIds.has(employee.id)) : rootList;

  function toggle(id: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function EmployeeNode({ employee, path }: { employee: EmployeeRow; path: Set<string> }) {
    if (path.has(employee.id)) return <p className="text-[10px] text-amber-700">Reporting loop detected — review manager assignments.</p>;
    const nextPath = new Set(path);
    nextPath.add(employee.id);
    const reports = children.get(employee.id) ?? [];
    const assigned = partnerByEmployee.get(employee.id) ?? [];
    const open = Boolean(search) || expanded.has(employee.id);
    const visibleReports = matchedIds ? reports.filter((item) => matchedIds.has(item.id)) : reports;
    const employeeMatches = [employee.full_name, employee.employee_code, employee.department, employee.designation, employee.location].some((s) => normalized(s).includes(search));
    const visiblePartners = search && !employeeMatches ? assigned.filter((p) => [p.name, p.code, kindLabel[p.kind]].some((s) => normalized(s).includes(search))) : assigned;
    const canExpand = reports.length > 0 || (showPartners && assigned.length > 0);
    return (
      <li className="relative min-w-0 border-l border-[#DCE6F1] pl-4 before:absolute before:left-0 before:top-6 before:w-4 before:border-t before:border-[#DCE6F1]">
        <div className="flex min-h-[62px] flex-wrap items-center gap-3 rounded-lg border border-[#D8E4F2] bg-white px-3 py-1.5 shadow-[0_3px_10px_rgba(7,29,73,0.04)] transition hover:border-[#A9C6EF] hover:shadow-sm">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#164078]"><UserRound className="h-4 w-4" /></span>
          <div className="min-w-[140px] flex-1">
            <p className="truncate text-[12px] font-bold text-[#102A53]">{employee.full_name}</p>
            <p className="truncate text-[10px] text-[#65758C]">{employee.designation} · {employee.department}</p>
            <p className="text-[9px] text-[#8290A5]">{employee.location || "Location not assigned"} · {employee.employee_code}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
            {reports.length > 0 ? <span className="rounded-full bg-[#EAF2FF] px-2 py-1 text-[#22558E]">{reports.length} direct reports</span> : null}
            {showPartners && assigned.length > 0 ? <span className="rounded-full bg-[#EAF8F2] px-2 py-1 text-[#097250]">{assigned.length} associates</span> : null}
            <button type="button" onClick={() => setFocus(employee.id)} title="Focus on this employee" className="rounded-md border border-[#E0E8F2] p-1.5 text-[#667C98] hover:bg-[#EFF5FD]"><Network className="h-3.5 w-3.5" /></button>
            {canExpand ? <button type="button" aria-expanded={open} aria-label={open ? `Collapse ${employee.full_name}` : `Expand ${employee.full_name}`} onClick={() => toggle(employee.id)} className="rounded-md border border-[#DCE6F1] p-1.5 text-[#234D7B] hover:bg-[#EFF5FD]">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button> : null}
          </div>
        </div>
        {open && (visibleReports.length || (showPartners && visiblePartners.length)) ? (
          <ul className="mt-2 space-y-2">
            {visibleReports.map((report) => <EmployeeNode key={report.id} employee={report} path={nextPath} />)}
            {showPartners && visiblePartners.length ? (
              <li className="ml-4 rounded-lg border border-dashed border-[#C9DFD6] bg-[#F8FCFA] p-2">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-[#13654B]"><Handshake className="h-3.5 w-3.5" /> Business network · {visiblePartners.length}</div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePartners.map((partner) => <div key={partner.id} className="min-w-0 rounded-md border border-[#D8E8DF] bg-white p-2.5">
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-[#378064]" /><Link href={`/intermediaries/applications/${partner.applicationId}`} className="truncate text-[11px] font-semibold text-[#153658] hover:underline">{partner.name}</Link></div>
                    <p className="mt-1 text-[9px] text-[#687F92]">{kindLabel[partner.kind]} · {partner.code || "Registration pending"} · {partner.status.replaceAll("_", " ")}</p>
                    {partner.branches.length ? <details className="mt-2 border-t border-[#E5EFE8] pt-2"><summary className="cursor-pointer text-[10px] font-semibold text-[#24725B]">{partner.branches.length} branches</summary><ul className="mt-1 space-y-1">{partner.branches.map((branch) => <li key={branch.id} className="text-[10px] text-[#52667A]"><GitBranch className="mr-1 inline h-3 w-3" />{branch.name}</li>)}</ul></details> : null}
                  </div>)}
                </div>
              </li>
            ) : null}
          </ul>
        ) : null}
      </li>
    );
  }

  return <div className="px-3 pb-3 pt-2 lg:px-4">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#F6F9FD] px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#657B94]">
        <span className="font-semibold text-[#25456C]">Reporting hierarchy</span>
        <span className="hidden text-[#B6C5D5] sm:inline">/</span>
        <span>Click an employee to explore their team and network</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-[#456079]"><input checked={showPartners} onChange={(e) => setShowPartners(e.target.checked)} type="checkbox" className="accent-[#153B6D]" /> Partner network</label>
        <span className="h-4 border-l border-[#DCE5F0]" />
        <button type="button" onClick={() => { setExpanded(new Set(employees.map((e) => e.id))); setFocus(""); }} className="rounded border border-[#CEDCEB] bg-white px-2 py-1 text-[10px] font-semibold text-[#23456C] hover:bg-[#EFF5FD]">Expand all</button>
        <button type="button" onClick={() => { setExpanded(new Set()); setFocus(""); }} className="rounded border border-[#CEDCEB] bg-white px-2 py-1 text-[10px] font-semibold text-[#23456C] hover:bg-[#EFF5FD]">Collapse all</button>
      </div>
    </div>
    <div className="min-h-[55vh] max-h-[calc(100vh-265px)] overflow-auto rounded-lg border border-[#E3EBF4] bg-[#FCFDFF] px-2 py-3 sm:px-4">
      {focus ? <button type="button" onClick={() => setFocus("")} className="mb-3 rounded-md bg-[#EAF2FF] px-3 py-1.5 text-[10px] font-semibold text-[#214D83]">← Full organization</button> : null}
      {visibleRootList.length ? <ul className="max-w-[1500px] space-y-2">{visibleRootList.map((employee) => <EmployeeNode key={employee.id} employee={employee} path={new Set()} />)}</ul> : <p className="p-8 text-center text-[11px] text-[#65758A]">No matching people or partners found.</p>}
    </div>
  </div>;
}
