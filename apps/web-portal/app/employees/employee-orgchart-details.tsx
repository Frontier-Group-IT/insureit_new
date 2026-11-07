"use client";

import { useEffect, useRef } from "react";
import { Building2, BriefcaseBusiness, ChevronRight, Handshake, Mail, MapPin, Phone, UserRound, Users, X } from "lucide-react";
import type { EmployeeRow } from "./employee-forms";
import type { DirectoryPartner } from "./employee-organization-tree";

export function EmployeeOrgchartDetails({
  employee, manager, reports, partners, onClose, onFocus,
}: {
  employee: EmployeeRow | null;
  manager: EmployeeRow | undefined;
  reports: EmployeeRow[];
  partners: DirectoryPartner[];
  onClose: () => void;
  onFocus: (employeeId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!employee) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [employee, onClose]);
  if (!employee) return null;

  return <div className="absolute inset-0 z-40 flex justify-end" data-testid="employee-details-drawer">
    <button aria-label="Close employee details" type="button" onClick={onClose} className="absolute inset-0 cursor-default bg-[#102846]/20 backdrop-blur-[1px]" />
    <aside role="dialog" aria-modal="true" aria-labelledby="orgchart-details-heading" className="relative z-10 flex h-full w-full max-w-[410px] flex-col border-l border-[#DCE5EF] bg-white shadow-[-14px_0_35px_rgba(14,36,64,0.15)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#E5EDF6] px-5 py-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#7588A0]">Employee profile</p><h2 id="orgchart-details-heading" className="text-[15px] font-bold text-[#112E56]">Employee details</h2></div>
        <button ref={closeRef} type="button" aria-label="Close details panel" onClick={onClose} className="rounded-md border border-[#DDE6F0] p-2 text-[#536D89] hover:bg-[#F3F7FC]"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#E8F1FF] text-[#32649C]"><UserRound className="h-7 w-7" /></div>
          <div className="min-w-0"><p className="text-[15px] font-bold text-[#142F55]">{employee.full_name}</p><p className="text-[11px] text-[#617792]">{employee.designation}</p><p className="text-[10px] text-[#8B99A9]">{employee.employee_code}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[#F3F7FC] p-3"><p className="text-[21px] font-bold text-[#204977]">{reports.length}</p><p className="text-[10px] text-[#70839C]">Direct reports</p></div>
          <div className="rounded-lg bg-[#EDF9F4] p-3"><p className="text-[21px] font-bold text-[#167056]">{partners.length}</p><p className="text-[10px] text-[#608879]">Assigned associates</p></div>
        </div>
        <section className="space-y-2 text-[11px] text-[#455E7A]">
          <h3 className="font-bold text-[#193B66]">Organization information</h3>
          <p className="flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[#93A5BA]" />{employee.department}{employee.vertical ? ` · ${employee.vertical}` : ""}</p>
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#93A5BA]" />{employee.location || "Location unavailable"}</p>
          {employee.email ? <p className="flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0 text-[#93A5BA]" />{employee.email}</p> : null}
          {employee.phone ? <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#93A5BA]" />{employee.phone}</p> : null}
        </section>
        {manager ? <section><h3 className="mb-2 text-[11px] font-bold text-[#193B66]">Reports to</h3><button type="button" onClick={() => onFocus(manager.id)} className="flex w-full items-center justify-between rounded-lg border border-[#DEE9F4] bg-[#FAFCFF] p-3 text-left hover:bg-[#EEF5FF]"><span className="text-[11px] font-semibold text-[#325982]">{manager.full_name}</span><ChevronRight className="h-4 w-4 text-[#9BB0C4]" /></button></section> : null}
        {reports.length ? <section><h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#193B66]"><Users className="h-4 w-4" />Direct reports ({reports.length})</h3><div className="max-h-[175px] space-y-1 overflow-y-auto">{reports.map((person) => <button key={person.id} type="button" onClick={() => onFocus(person.id)} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] text-[#4C6481] hover:bg-[#F0F5FB]"><span className="truncate">{person.full_name}</span><ChevronRight className="h-3.5 w-3.5 shrink-0" /></button>)}</div></section> : null}
        {partners.length ? <section><h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#18705B]"><Handshake className="h-4 w-4" />Assigned network ({partners.length})</h3><div className="max-h-[175px] space-y-1 overflow-y-auto">{partners.map((partner) => <div key={partner.id} className="flex items-start gap-2 rounded-md bg-[#F4FBF7] px-2 py-1.5"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#53977D]" /><div className="min-w-0"><p className="truncate text-[11px] text-[#216B59]">{partner.name}</p><p className="text-[9px] text-[#7B9289]">{partner.kind.toUpperCase()} · {partner.branches.length} branches</p></div></div>)}</div></section> : null}
      </div>
    </aside>
  </div>;
}
