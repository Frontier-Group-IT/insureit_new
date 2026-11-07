"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, ChevronDown, ChevronRight, Handshake, Network, UserRound, Users } from "lucide-react";
import Link from "next/link";
import type { EmployeeRow } from "./employee-forms";
import type { DirectoryPartner } from "./employee-organization-tree";

const PAGE_SIZE = 6;
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();
function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((piece) => piece[0] || "").join("").toUpperCase();
}

export function EmployeeOrgchartTeamFocus({
  employees, partners, query, department, showPartners, selectedId, onSelect,
}: {
  employees: EmployeeRow[];
  partners: DirectoryPartner[];
  query: string;
  department: string;
  showPartners: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const [partnerExpanded, setPartnerExpanded] = useState(false);
  const [partnerPage, setPartnerPage] = useState(0);
  const byId = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const reports = useMemo(() => {
    const map = new Map<string, EmployeeRow[]>();
    for (const employee of employees) {
      if (!employee.reporting_manager_id || !byId.has(employee.reporting_manager_id) || employee.reporting_manager_id === employee.id) continue;
      const list = map.get(employee.reporting_manager_id) ?? [];
      list.push(employee);
      map.set(employee.reporting_manager_id, list);
    }
    for (const values of map.values()) values.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return map;
  }, [employees, byId]);
  const roots = useMemo(() => employees
    .filter((e) => !e.reporting_manager_id || !byId.has(e.reporting_manager_id) || e.reporting_manager_id === e.id)
    .sort((a, b) => (reports.get(b.id)?.length ?? 0) - (reports.get(a.id)?.length ?? 0) || a.full_name.localeCompare(b.full_name)), [employees, byId, reports]);

  const search = normalize(query);
  const matching = useMemo(() => {
    if (!search && !department) return [];
    return employees.filter((employee) =>
      (!department || normalize(employee.department) === normalize(department)) &&
      (!search || [employee.full_name, employee.employee_code, employee.designation, employee.department, employee.location]
        .some((value) => normalize(value).includes(search)) ||
        partners.some((partner) => partner.employeeId === employee.id && [partner.name, partner.code, partner.kind].some((v) => normalize(v).includes(search))))
    );
  }, [employees, partners, department, search]);

  const defaultId = roots[0]?.id ?? employees[0]?.id ?? "";
  const currentId = selectedId && byId.has(selectedId) ? selectedId : defaultId;
  const focused = byId.get(currentId);
  useEffect(() => { setPage(0); setPartnerPage(0); setPartnerExpanded(false); }, [currentId]);

  // Search and department filters expose results without changing the authorized employee list.
  const children = focused ? (reports.get(focused.id) ?? []).filter((child) => {
    if (!department && !search) return true;
    if (matching.some((employee) => employee.id === child.id)) return true;
    const seen = new Set<string>();
    const hasMatchedDescendant = (id: string): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      return (reports.get(id) ?? []).some((descendant) => matching.some((employee) => employee.id === descendant.id) || hasMatchedDescendant(descendant.id));
    };
    return hasMatchedDescendant(child.id);
  }) : [];
  const ownPartners = focused && showPartners ? partners.filter((p) => p.employeeId === focused.id && (!search || [p.name, p.code, p.kind].some((v) => normalize(v).includes(search)) || [focused.full_name, focused.employee_code, focused.designation].some((v) => normalize(v).includes(search)))) : [];
  const parent = focused?.reporting_manager_id ? byId.get(focused.reporting_manager_id) : undefined;
  const ancestors: EmployeeRow[] = [];
  const seen = new Set<string>();
  let cursor = parent;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    ancestors.unshift(cursor);
    cursor = cursor.reporting_manager_id ? byId.get(cursor.reporting_manager_id) : undefined;
  }
  const visibleReports = children.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(children.length / PAGE_SIZE));
  const partnersShown = ownPartners.slice(partnerPage * PAGE_SIZE, (partnerPage + 1) * PAGE_SIZE);
  const partnerPages = Math.max(1, Math.ceil(ownPartners.length / PAGE_SIZE));

  const employeeCard = (employee: EmployeeRow, large = false) => (
    <button key={employee.id} type="button" onClick={() => onSelect(employee.id)}
      className={`group min-w-0 rounded-xl border text-left transition-colors hover:border-[#82AADB] hover:bg-[#F3F8FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5685C4] ${large ? "w-full max-w-[335px] border-[#89B0E9] bg-[#EFF5FF] p-4 shadow-md" : "border-[#D7E2ED] bg-white p-3 shadow-[0_2px_9px_rgba(16,39,72,0.07)]"}`}>
      <div className="flex items-center gap-3">
        <div className={`flex shrink-0 items-center justify-center rounded-full bg-[#E6F0FF] font-semibold text-[#245790] ${large ? "h-12 w-12 text-[14px]" : "h-10 w-10 text-[12px]"}`}>{initials(employee.full_name) || <UserRound className="h-4 w-4" />}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-[#132D53]" title={employee.full_name}>{employee.full_name}</p>
          <p className="truncate text-[10px] text-[#536781]" title={employee.designation}>{employee.designation}</p>
          <p className="truncate text-[9.5px] text-[#7D8BA0]">{employee.department} · {employee.location || "No location"}</p>
        </div>
        {!large ? <ChevronRight className="h-4 w-4 shrink-0 text-[#9AAAC0] group-hover:text-[#245790]" /> : null}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[#E4EBF3] pt-2 text-[9.5px] text-[#5B708A]">
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{reports.get(employee.id)?.length ?? 0} direct reports</span>
        {showPartners ? <span className="inline-flex items-center gap-1"><Handshake className="h-3 w-3" />{partners.filter((partner) => partner.employeeId === employee.id).length} associates</span> : null}
      </div>
    </button>
  );

  return <div className="min-h-[490px] bg-[#FAFAF8] px-4 py-4 sm:px-6" data-testid="employee-team-focus">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <nav aria-label="Reporting chain" className="flex min-w-0 flex-wrap items-center gap-1.5 text-[#6D8098]">
        <button type="button" onClick={() => onSelect(defaultId)} className="font-semibold text-[#315A88] hover:underline">Organization</button>
        {ancestors.map((employee) => <span key={employee.id} className="inline-flex items-center gap-1"><ChevronRight className="h-3 w-3" /><button type="button" onClick={() => onSelect(employee.id)} className="max-w-[140px] truncate hover:underline">{employee.full_name}</button></span>)}
        {focused ? <span className="inline-flex items-center gap-1 font-semibold text-[#183C65]"><ChevronRight className="h-3 w-3" />{focused.full_name}</span> : null}
      </nav>
      {parent ? <button type="button" onClick={() => onSelect(parent.id)} className="inline-flex items-center gap-1 rounded-md border border-[#D5E1ED] bg-white px-2.5 py-1.5 font-medium text-[#355E89] hover:bg-[#EDF5FF]"><ArrowLeft className="h-3.5 w-3.5" />Up one level</button> : null}
    </div>

    {(search || department) ? <div className="mb-4 rounded-lg border border-[#D9E7F6] bg-[#F2F7FD] p-2.5">
      <p className="mb-2 text-[10px] font-semibold text-[#355C85]">{matching.length} matching employees · Select a result to focus</p>
      <div className="flex max-h-[94px] flex-wrap gap-1.5 overflow-y-auto">
        {matching.map((employee) => <button key={employee.id} type="button" onClick={() => onSelect(employee.id)} className="rounded-full border border-[#C8DAEC] bg-white px-2.5 py-1 text-[10px] text-[#2E527B] hover:border-[#8CB4E3]">{employee.full_name}</button>)}
      </div>
    </div> : null}

    {focused ? <div className="flex flex-col items-center">
      {parent ? <button type="button" onClick={() => onSelect(parent.id)} className="mb-2 rounded-lg border border-[#DDE6EE] bg-white px-4 py-2 text-[10px] text-[#667D96] hover:border-[#99B7D7]"><span className="font-semibold text-[#284A70]">{parent.full_name}</span> · {parent.designation}</button> : null}
      {parent ? <div className="h-5 w-px bg-[#B9CBDB]" /> : null}
      {employeeCard(focused, true)}
      <div className="h-6 w-px bg-[#B9CBDB]" />
      <div className="rounded-full bg-[#DFEAF8] px-3 py-1 text-[10px] font-semibold text-[#365D87]">{children.length} direct reports</div>
      <div className="h-5 w-px bg-[#B9CBDB]" />
      {children.length ? <>
        <div className="grid w-full max-w-[1020px] grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleReports.map((employee) => employeeCard(employee))}
        </div>
        {pages > 1 ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-[#516B89]">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-[#CDDBE9] bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, children.length)} of {children.length}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} className="rounded-md border border-[#CDDBE9] bg-white px-3 py-1.5 disabled:opacity-40">More reports <ChevronRight className="inline h-3 w-3" /></button>
        </div> : null}
      </> : <p className="mt-2 text-[10.5px] text-[#7A8DA2]">No direct reports in this view</p>}
    </div> : <div className="py-24 text-center text-[12px] text-[#7A8DA2]">No employees available.</div>}

    {showPartners && focused && ownPartners.length ? <section className="mx-auto mt-6 max-w-[1020px] rounded-xl border border-[#D9EAE3] bg-white p-3">
      <button type="button" onClick={() => { setPartnerExpanded((v) => !v); setPartnerPage(0); }} aria-expanded={partnerExpanded} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-[#216B57]"><Handshake className="h-4 w-4" />Business network <span className="rounded-full bg-[#E5F6EE] px-2 py-0.5 text-[10px]">{ownPartners.length} assigned</span></span>
        <ChevronDown className={`h-4 w-4 text-[#568C7D] transition-transform ${partnerExpanded ? "rotate-180" : ""}`} />
      </button>
      {partnerExpanded ? <>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {partnersShown.map((partner) => <div key={partner.id} className="min-w-0 rounded-lg border border-[#D8E9E1] bg-[#FAFFFC] p-3">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#347966]" /><Link href={`/intermediaries/applications/${partner.applicationId}`} className="truncate text-[11px] font-semibold text-[#1F5361] hover:underline">{partner.name}</Link></div>
            <p className="mt-1 text-[9.5px] text-[#69887D]">{partner.kind.toUpperCase()} · {partner.code || "Registration pending"} · {partner.status.replaceAll("_", " ")}</p>
            {partner.branches.length ? <details className="mt-2 text-[10px] text-[#347966]"><summary className="cursor-pointer">{partner.branches.length} branches</summary><ul className="mt-1 space-y-1">{partner.branches.map((branch) => <li key={branch.id}>{branch.name}</li>)}</ul></details> : null}
          </div>)}
        </div>
        {partnerPages > 1 ? <div className="mt-3 flex items-center justify-center gap-3 text-[10px]">
          <button type="button" disabled={partnerPage === 0} onClick={() => setPartnerPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button>
          <span>{partnerPage + 1} / {partnerPages}</span>
          <button type="button" disabled={partnerPage >= partnerPages - 1} onClick={() => setPartnerPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">More partners</button>
        </div> : null}
      </> : null}
    </section> : null}
    {roots.length > 1 && !parent ? <div className="mx-auto mt-6 flex max-w-[1020px] flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3 text-[10px] text-[#718196]"><Network className="h-3.5 w-3.5" />Other reporting roots:{roots.filter((root) => root.id !== focused?.id).map((root) => <button key={root.id} type="button" onClick={() => onSelect(root.id)} className="rounded-full border border-[#D5E2EE] bg-white px-2 py-1 text-[#3B618B]">{root.full_name}</button>)}</div> : null}
  </div>;
}
