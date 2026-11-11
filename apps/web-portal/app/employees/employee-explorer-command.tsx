"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Command, CornerDownLeft, Search, UserRound, Users, X } from "lucide-react";
import type { EmployeeRow } from "./employee-forms";
import type { DirectoryPartner } from "./employee-organization-tree";

type Match = { id: string; category: "employee" | "network"; employeeId: string; title: string; detail: string };
const lower = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

export function EmployeeExplorerCommand({
  employees, partners, onChoose,
}: {
  employees: EmployeeRow[];
  partners: DirectoryPartner[];
  onChoose: (employeeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visibleIds = useMemo(() => new Set(employees.map((employee) => employee.id)), [employees]);
  const matching = useMemo(() => {
    const q = lower(query);
    const employeeResults: Match[] = employees.filter((e) => !q || [e.full_name, e.employee_code, e.department, e.designation, e.location].some((v) => lower(v).includes(q)))
      .map((e) => ({ id: `employee:${e.id}`, category: "employee", employeeId: e.id, title: e.full_name, detail: [e.designation, e.department, e.location].filter(Boolean).join(" · ") }));
    const partnerResults: Match[] = partners.filter((partner) => visibleIds.has(partner.employeeId) &&
      q && [partner.name, partner.code, partner.kind, ...partner.associates.map((a) => a.name), ...partner.branches.map((b) => b.name)]
        .some((v) => lower(v).includes(q))).map((partner) => ({
          id: `partner:${partner.id}`, category: "network", employeeId: partner.employeeId,
          title: partner.name, detail: `${partner.kind.toUpperCase()} · Jump to assigned employee`,
        }));
    if (!q) {
      const recentResults = recent.map((id) => employeeResults.find((result) => result.employeeId === id)).filter((r): r is Match => Boolean(r));
      return [...recentResults, ...employeeResults.filter((result) => !recent.includes(result.employeeId)).slice(0, 8)];
    }
    return [...employeeResults.slice(0, 12), ...partnerResults.slice(0, 8)];
  }, [query, employees, partners, visibleIds, recent]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { setQuery(""); setSelected(0); inputRef.current?.focus(); } }, [open]);
  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
      if (event.key === "Tab" && panelRef.current) {
        const controls = [...panelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)")];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const choose = (match: Match) => {
    setRecent((previous) => [match.employeeId, ...previous.filter((id) => id !== match.employeeId)].slice(0, 5));
    setOpen(false);
    onChoose(match.employeeId);
    triggerRef.current?.focus();
  };

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CDDBEB] bg-[#F8FBFF] px-2.5 text-[10.5px] font-semibold text-[#315F90] transition-colors hover:border-[#84A9D4] hover:bg-[#EAF4FF]" aria-label="Quick jump to employee or partner">
      <Search className="h-3.5 w-3.5" /> Quick jump <span className="hidden rounded border border-[#D7E2EF] bg-white px-1.5 py-0.5 text-[9px] text-[#8191A5] sm:inline">Ctrl K</span>
    </button>
    {open ? <div className="fixed inset-0 z-[90] flex items-start justify-center bg-[#091B33]/40 px-3 pt-[min(16vh,130px)] backdrop-blur-[2px]" data-testid="employee-explorer-command">
      <button type="button" aria-label="Close quick jump" onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Quick jump to employee or partner" className="org-drawer-panel relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[#C9D9EA] bg-white shadow-[0_22px_75px_rgba(7,29,73,.28)]">
        <div className="flex items-center gap-3 border-b border-[#E4EBF4] px-4 py-3">
          <Command className="h-4 w-4 shrink-0 text-[#7094BA]" />
          <input ref={inputRef} type="search" aria-label="Find employee, partner, associate or branch" aria-autocomplete="list" aria-controls="employee-quick-jump-results" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setSelected((i) => Math.min(matching.length - 1, i + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setSelected((i) => Math.max(0, i - 1)); }
            if (event.key === "Enter" && matching[selected]) { event.preventDefault(); choose(matching[selected]); }
          }} placeholder="Employee, partner, POSP, MISP, associate, branch..." className="min-w-0 flex-1 bg-transparent text-[13px] text-[#173654] outline-none placeholder:text-[#93A4B9]" />
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close search" className="rounded-md p-1.5 text-[#7187A1] hover:bg-[#EDF4FB]"><X className="h-4 w-4" /></button>
        </div>
        <div id="employee-quick-jump-results" role="listbox" aria-label="Search results" className="max-h-[360px] overflow-y-auto p-2">
          {!query && recent.length ? <p className="px-2 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#8697AA]">Recent people and suggested employees</p> : null}
          {query ? <p className="px-2 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#8697AA]">{matching.length} matching result{matching.length === 1 ? "" : "s"}</p> : null}
          {matching.map((match, index) => <button type="button" role="option" aria-selected={index === selected} key={match.id} onMouseEnter={() => setSelected(index)} onClick={() => choose(match)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${index === selected ? "bg-[#EAF3FF]" : "hover:bg-[#F3F7FC]"}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#37689A]">{match.category === "employee" ? <UserRound className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-[#183B64]">{match.title}</span><span className="block truncate text-[10px] text-[#6F849C]">{match.detail}</span></span>
            {match.category === "network" ? <span className="rounded bg-[#E4F4EC] px-1.5 py-1 text-[9px] text-[#247454]">Network</span> : <Users className="h-3.5 w-3.5 text-[#A0B0C4]" />}
          </button>)}
          {!matching.length ? <div className="px-3 py-8 text-center text-[11px] text-[#8395AA]">No authorized results match this search.</div> : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#E8EEF5] bg-[#FAFCFF] px-4 py-2 text-[9px] text-[#7C8FA5]"><span>↑ ↓ navigate · Enter select · Esc close</span><CornerDownLeft className="h-3 w-3" /></div>
      </div>
    </div> : null}
  </>;
}
