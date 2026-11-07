"use client";

import { Building2, ChevronRight, Handshake, Network, Users } from "lucide-react";
import type { EmployeeRow } from "./employee-forms";
import type { DirectoryPartner } from "./employee-organization-tree";

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();
export function EmployeeOrgchartOverview({
  employees, partners, department, query, onFocus,
}: {
  employees: EmployeeRow[];
  partners: DirectoryPartner[];
  department: string;
  query: string;
  onFocus: (id: string) => void;
}) {
  const allowed = new Set(employees.map((e) => e.id));
  const byId = new Map(employees.map((e) => [e.id, e]));
  const roots = employees.filter((e) => !e.reporting_manager_id || !allowed.has(e.reporting_manager_id) || e.reporting_manager_id === e.id);
  const groups = new Map<string, EmployeeRow[]>();
  const matches = (e: EmployeeRow) => (!department || normalize(e.department) === normalize(department)) &&
    (!query || [e.full_name, e.employee_code, e.department, e.designation, e.location].some((v) => normalize(v).includes(normalize(query))) ||
      partners.some((p) => p.employeeId === e.id && [p.name, p.code, p.kind].some((v) => normalize(v).includes(normalize(query)))));
  for (const employee of employees.filter(matches)) {
    const label = employee.department?.trim() || "Unassigned department";
    const key = normalize(label);
    groups.set(key, [...(groups.get(key) ?? []), employee]);
  }
  const grouped = [...groups.entries()].map(([key, members]) => ({
    key, label: members[0]?.department?.trim() || "Unassigned department",
    members, associates: partners.filter((p) => members.some((e) => e.id === p.employeeId)).length,
  })).sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label));

  function reportingRoot(member: EmployeeRow) {
    let current = member;
    const seen = new Set<string>();
    while (current.reporting_manager_id && byId.has(current.reporting_manager_id) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.reporting_manager_id)!;
    }
    return current;
  }
  return <section data-testid="employee-orgchart-overview" className="min-h-[490px] bg-[#FAFAF8] px-4 py-5 sm:px-6">
    <div className="mb-5 flex items-center gap-3 border-b border-[#E4EAF1] pb-4"><div className="rounded-xl bg-[#E8F1FD] p-3 text-[#35649B]"><Building2 className="h-6 w-6" /></div><div><h2 className="text-[16px] font-bold text-[#122F58]">INSUREIT Organization</h2><p className="text-[11px] text-[#71839B]">Choose a department or leader to explore the reporting network</p></div></div>
    <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7F98]"><Network className="h-4 w-4" /><span>{employees.length} employees</span><span>·</span><span>{grouped.length} departments</span><span>·</span><span>{partners.filter((p) => allowed.has(p.employeeId)).length} assigned intermediaries</span></div>
    <h3 className="mb-2 text-[11px] font-bold text-[#244973]">Departments</h3>
    {grouped.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{grouped.map((group) => {
      const sorted = [...group.members].sort((a, b) => a.full_name.localeCompare(b.full_name));
      const representative = sorted.find((e) => !group.members.some((candidate) => candidate.id === e.reporting_manager_id)) ?? sorted[0];
      return <article key={group.key} className="rounded-xl border border-[#DCE6F1] bg-white p-4 shadow-[0_2px_10px_rgba(26,55,87,0.04)]">
        <button type="button" onClick={() => onFocus(representative.id)} className="flex w-full items-center justify-between gap-2 text-left"><span className="truncate text-[12px] font-bold text-[#244771]">{group.label}</span><ChevronRight className="h-4 w-4 shrink-0 text-[#8095AD]" /></button>
        <div className="mt-3 flex gap-3 border-y border-[#EDF2F7] py-2.5 text-[10px] text-[#71849C]"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{group.members.length} employees</span><span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" />{group.associates} associates</span></div>
        <p className="mt-2 truncate text-[10px] text-[#697E97]">Explore from {representative.full_name}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{sorted.slice(0, 4).map((e) => <button key={e.id} type="button" onClick={() => onFocus(e.id)} className="max-w-full truncate rounded-full bg-[#F0F5FC] px-2 py-1 text-[9.5px] text-[#315B8A] hover:bg-[#E0EDFC]">{e.full_name}</button>)}</div>
      </article>;
    })}</div> : <div className="rounded-lg border border-dashed border-[#DCE6F1] p-8 text-center text-[11px] text-[#70839A]">No departments match the selected filters.</div>}
    {roots.length ? <div className="mt-6"><h3 className="mb-2 text-[11px] font-bold text-[#244973]">Reporting roots</h3><div className="flex flex-wrap gap-2">{roots.map((root) => <button key={root.id} type="button" onClick={() => onFocus(reportingRoot(root).id)} className="rounded-full border border-[#CEDCEB] bg-white px-3 py-1.5 text-[10px] text-[#3F6389] hover:bg-[#ECF4FE]">{root.full_name}</button>)}</div></div> : null}
  </section>;
}
