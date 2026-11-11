"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ChevronRight, Handshake, LocateFixed, Maximize2, Minus, Plus, UserRound, Users } from "lucide-react";
import type { EmployeeRow } from "./employee-forms";
import { EmployeeOrgchartTeamFocus } from "./employee-orgchart-team-focus";
import "./employee-orgchart-motion.css";
import { EmployeeOrgchartOverview } from "./employee-orgchart-overview";
import { EmployeeOrgchartDetails } from "./employee-orgchart-details";

export type DirectoryPartner = {
  id: string;
  applicationId: string;
  employeeId: string;
  name: string;
  code: string | null;
  kind: "partner" | "posp" | "misp";
  status: string;
  branches: { id: string; name: string; code: string | null }[];
  associates: { id: string; name: string; designation: string | null; role: string | null; status: string }[];
};

type ChartNode = {
  key: string;
  label: string;
  subtitle: string;
  detail: string;
  type: "employee" | "group" | "partner" | "branch";
  employee?: EmployeeRow;
  partner?: DirectoryPartner;
  count: number;
  children: ChartNode[];
};

type Positioned = { node: ChartNode; x: number; y: number; parent: string | null };
const CARD_W = 188;
const CARD_H = 100;
const H_GAP = 24;
const V_GAP = 84;
const MARGIN = 80;
const normalize = (value: string | null | undefined) => (value ?? "").trim().toLocaleLowerCase();

function layoutForest(roots: ChartNode[]) {
  const widths = new Map<string, number>();
  const measure = (node: ChartNode): number => {
    const childWidth = node.children.reduce((sum, child, index) => sum + measure(child) + (index ? H_GAP : 0), 0);
    const width = Math.max(CARD_W, childWidth);
    widths.set(node.key, width);
    return width;
  };
  const totalWidth = roots.reduce((sum, node, index) => sum + measure(node) + (index ? H_GAP * 2 : 0), 0);
  const positions: Positioned[] = [];
  let deepest = 0;
  const place = (node: ChartNode, left: number, depth: number, parent: string | null) => {
    const width = widths.get(node.key) ?? CARD_W;
    const x = left + width / 2;
    const y = MARGIN + depth * (CARD_H + V_GAP);
    deepest = Math.max(deepest, depth);
    positions.push({ node, x, y, parent });
    const childrenWidth = node.children.reduce((sum, child, index) => sum + (widths.get(child.key) ?? CARD_W) + (index ? H_GAP : 0), 0);
    let next = left + (width - childrenWidth) / 2;
    for (const child of node.children) {
      place(child, next, depth + 1, node.key);
      next += (widths.get(child.key) ?? CARD_W) + H_GAP;
    }
  };
  let next = MARGIN;
  for (const root of roots) {
    place(root, next, 0, null);
    next += (widths.get(root.key) ?? CARD_W) + H_GAP * 2;
  }
  return { positions, width: Math.max(600, totalWidth + MARGIN * 2), height: Math.max(420, (deepest + 1) * (CARD_H + V_GAP) + MARGIN * 2) };
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

export function EmployeeOrganizationTree({ employees, partners, query, focusRequest, managers, portalRoles, canManage, canManagePortalAccess }: { employees: EmployeeRow[]; partners: DirectoryPartner[]; query: string; focusRequest?: { employeeId: string; sequence: number } | null; managers: Pick<EmployeeRow, "id" | "employee_code" | "full_name">[]; portalRoles: { value: string; label: string }[]; canManage: boolean; canManagePortalAccess: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(employees.filter((employee) => !employee.reporting_manager_id || !employees.some((manager) => manager.id === employee.reporting_manager_id)).map((employee) => `employee:${employee.id}`)));
  const [showPartners, setShowPartners] = useState(true);
  const [mode, setMode] = useState<"overview" | "team" | "full">("team");
  const [detailsId, setDetailsId] = useState("");
  const [department, setDepartment] = useState("");
  const [focus, setFocus] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1050, height: 590 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const resize = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setViewport({ width: box.width, height: box.height });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  useEffect(() => { if (focusRequest && employeeById.has(focusRequest.employeeId)) { setDepartment(""); setFocus(focusRequest.employeeId); setMode("team"); } }, [focusRequest, employeeById]);
  const closeDetails = useCallback(() => setDetailsId(""), []);
  const navigateToEmployee = useCallback((id: string) => { setDetailsId(""); setFocus(id); setMode("team"); }, []);
  const reportsByManager = useMemo(() => {
    const result = new Map<string, EmployeeRow[]>();
    for (const employee of employees) {
      if (!employee.reporting_manager_id || !employeeById.has(employee.reporting_manager_id) || employee.reporting_manager_id === employee.id) continue;
      const reports = result.get(employee.reporting_manager_id) ?? [];
      reports.push(employee);
      result.set(employee.reporting_manager_id, reports);
    }
    for (const reports of result.values()) reports.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return result;
  }, [employees, employeeById]);
  const partnersByEmployee = useMemo(() => {
    const result = new Map<string, DirectoryPartner[]>();
    for (const partner of partners) {
      if (!employeeById.has(partner.employeeId)) continue;
      const list = result.get(partner.employeeId) ?? [];
      list.push(partner);
      result.set(partner.employeeId, list);
    }
    for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [employeeById, partners]);
  const departments = useMemo(() => [...new Set(employees.map((employee) => employee.department?.trim()).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b)), [employees]);
  const search = normalize(query);
  const matched = useMemo(() => {
    if (!search && !department) return null;
    const ids = new Set<string>();
    for (const employee of employees) {
      const text = [employee.full_name, employee.employee_code, employee.designation, employee.department, employee.location].join(" ").toLowerCase();
      const assigned = partnersByEmployee.get(employee.id) ?? [];
      const matchName = !search || text.includes(search) || assigned.some((partner) => [partner.name, partner.code, partner.kind].some((s) => normalize(s).includes(search)));
      const matchDepartment = !department || normalize(employee.department) === normalize(department);
      if (!matchName || !matchDepartment) continue;
      let current: EmployeeRow | undefined = employee;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        ids.add(current.id);
        current = current.reporting_manager_id ? employeeById.get(current.reporting_manager_id) : undefined;
      }
    }
    return ids;
  }, [employees, employeeById, partnersByEmployee, search, department]);

  const roots = useMemo(() => employees
    .filter((e) => !e.reporting_manager_id || !employeeById.has(e.reporting_manager_id) || e.reporting_manager_id === e.id)
    .sort((a, b) => a.full_name.localeCompare(b.full_name)), [employees, employeeById]);

  const chartRoots = useMemo(() => {
    const make = (employee: EmployeeRow, depth: number, ancestors: Set<string>): ChartNode => {
      const key = `employee:${employee.id}`;
      if (ancestors.has(employee.id)) return { key: `loop:${employee.id}`, label: "Reporting loop detected", subtitle: "Review manager assignments", detail: "", type: "group", count: 0, children: [] };
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(employee.id);
      const reports = (reportsByManager.get(employee.id) ?? []).filter((child) => !matched || matched.has(child.id));
      const assigned = partnersByEmployee.get(employee.id) ?? [];
      const open = Boolean(search || department) || expanded.has(key);
      const children: ChartNode[] = open ? reports.map((child) => make(child, depth + 1, nextAncestors)) : [];
      if (open && showPartners && assigned.length) {
        for (const kind of ["partner", "posp", "misp"] as const) {
          const records = assigned.filter((partner) => partner.kind === kind).filter((partner) =>
            !search || normalize([partner.name, partner.code, partner.kind].join(" ")).includes(search) ||
            normalize([employee.full_name, employee.employee_code, employee.designation, employee.department].join(" ")).includes(search)
          );
          if (!records.length) continue;
          const groupKey = `group:${employee.id}:${kind}`;
          const groupOpen = expanded.has(groupKey) || Boolean(search);
          children.push({
            key: groupKey, label: kind === "partner" ? "Partners" : kind.toUpperCase(), subtitle: "Business network",
            detail: `${records.length} assigned`, type: "group", count: records.length,
            children: groupOpen ? records.map((partner) => ({
              key: `partner:${partner.id}`, label: partner.name, subtitle: kind.toUpperCase(),
              detail: partner.code || "Registration pending", type: "partner" as const, partner,
              count: partner.branches.length,
              children: expanded.has(`partner:${partner.id}`) ? partner.branches.map((branch) => ({
                key: `branch:${branch.id}`, label: branch.name, subtitle: "Partner branch",
                detail: branch.code || "", type: "branch" as const, count: 0, children: [],
              })) : [],
            })) : [],
          });
        }
      }
      return {
        key, label: employee.full_name, subtitle: employee.designation || "Employee",
        detail: [employee.department, employee.location].filter(Boolean).join(" · "),
        type: "employee", employee, count: reports.length + (showPartners ? assigned.length : 0), children,
      };
    };
    const list = focus && employeeById.has(focus) ? [employeeById.get(focus)!] : roots;
    return list.filter((employee) => !matched || matched.has(employee.id)).map((employee) => make(employee, 0, new Set()));
  }, [roots, focus, employeeById, reportsByManager, partnersByEmployee, matched, search, department, expanded, showPartners]);

  const graph = useMemo(() => layoutForest(chartRoots), [chartRoots]);
  const placed = useMemo(() => new Map(graph.positions.map((position) => [position.node.key, position])), [graph]);
  const selectedDetails = detailsId ? employeeById.get(detailsId) ?? null : null;
  const detailReports = selectedDetails ? reportsByManager.get(selectedDetails.id) ?? [] : [];
  const detailPartners = selectedDetails && showPartners ? partnersByEmployee.get(selectedDetails.id) ?? [] : [];
  const fit = useCallback(() => {
    // Never shrink employee names to illegibility just to fit very wide branches.
    const scale = Math.min(1.1, Math.max(0.72, Math.min((viewport.width - 48) / graph.width, (viewport.height - 36) / graph.height)));
    setZoom(scale);
    setOffset({ x: graph.width * scale > viewport.width ? 20 : (viewport.width - graph.width * scale) / 2, y: Math.max(10, (viewport.height - graph.height * scale) / 2) });
  }, [viewport, graph]);
  useEffect(() => { if (mode === "full") fit(); }, [fit, mode]);
  const changeZoom = (next: number) => {
    const scale = Math.max(0.72, Math.min(1.6, next));
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    setOffset((previous) => ({ x: centerX - (centerX - previous.x) * scale / zoom, y: centerY - (centerY - previous.y) * scale / zoom }));
    setZoom(scale);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,a,select,input,summary")) return;
    // The diagram is draggable, not selectable. Stop browser text selection at its source.
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (Math.hypot(event.clientX - dragRef.current.x, event.clientY - dragRef.current.y) < 4) return;
    setIsDragging(true);
    setOffset({ x: dragRef.current.originX + event.clientX - dragRef.current.x, y: dragRef.current.originY + event.clientY - dragRef.current.y });
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const toggle = (key: string) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return <div className="insureit-org-motion relative bg-[#FBFAF7]">
    <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[#E6E4DE] bg-[#FBFAF7] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 text-[10px] text-[#758092]"><Users className="h-3.5 w-3.5" /><span>Reporting hierarchy</span><span className="text-[#C4C9D1]">/</span><span>{employees.length} employees</span></div><div className="inline-flex rounded-md border border-[#D9E2EC] bg-white p-0.5 text-[10px] font-semibold"><button type="button" onClick={() => setMode("overview")} aria-pressed={mode === "overview"} className={`rounded px-2.5 py-1.5 ${mode === "overview" ? "bg-[#173D71] text-white" : "text-[#57718D]"}`}>Overview</button><button type="button" onClick={() => setMode("team")} aria-pressed={mode === "team"} className={`rounded px-2.5 py-1.5 ${mode === "team" ? "bg-[#173D71] text-white" : "text-[#57718D]"}`}>Team focus</button><button type="button" onClick={() => setMode("full")} aria-pressed={mode === "full"} className={`rounded px-2.5 py-1.5 ${mode === "full" ? "bg-[#173D71] text-white" : "text-[#57718D]"}`}>Full chart</button></div></div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor="orgchart-department">Department</label>
        <select id="orgchart-department" value={department} onChange={(event) => { setDepartment(event.target.value); setFocus(""); }} className="h-8 min-w-[155px] rounded-md border border-[#DBE1E9] bg-white px-2 text-[10.5px] text-[#34445E] shadow-sm">
          <option value="">All departments</option>
          {departments.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label className="flex h-8 items-center gap-1.5 rounded-md border border-[#DBE1E9] bg-white px-2 text-[10px] text-[#485973]">
          <input type="checkbox" checked={showPartners} onChange={(event) => setShowPartners(event.target.checked)} className="accent-[#2B65CA]" />Partner network
        </label>
        {mode === "full" ? <button type="button" onClick={() => { setExpanded(new Set(employees.map((employee) => `employee:${employee.id}`))); setFocus(""); }} className="h-8 rounded-md border border-[#DBE1E9] bg-white px-2 text-[10px] text-[#40546E] hover:bg-[#EEF4FF]">Expand all</button> : null}
        {mode === "full" ? <button type="button" onClick={() => { setExpanded(new Set()); setFocus(""); }} className="h-8 rounded-md border border-[#DBE1E9] bg-white px-2 text-[10px] text-[#40546E] hover:bg-[#EEF4FF]">Collapse all</button> : null}
      </div>
    </div>
    {mode === "overview" ? <div className="org-mode-panel" key="overview"><EmployeeOrgchartOverview employees={employees} partners={showPartners ? partners : []} department={department} query={query} onFocus={navigateToEmployee} /></div> : null}
    {mode === "team" ? <div className="org-mode-panel" key="team"><EmployeeOrgchartTeamFocus employees={employees} partners={partners} query={query} department={department} showPartners={showPartners} selectedId={focus} onSelect={setFocus} onDetails={setDetailsId} /></div> : null}
    <div ref={canvasRef} onWheel={onWheel} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDragStart={(event) => event.preventDefault()} className={`relative h-[min(74vh,780px)] min-h-[470px] w-full touch-none select-none overflow-hidden bg-[#FAF9F6] ${mode === "full" ? "block" : "hidden"}`} aria-label="Interactive organization chart">
      <div className="absolute right-3 top-3 z-20 flex flex-col gap-1 rounded-md border border-[#E1E2E6] bg-white/95 p-1 shadow-sm">
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => changeZoom(zoom + 0.15)} className="rounded p-1.5 text-[#62718A] hover:bg-[#EDF3FA]"><Plus className="h-4 w-4" /></button>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => changeZoom(zoom - 0.15)} className="rounded p-1.5 text-[#62718A] hover:bg-[#EDF3FA]"><Minus className="h-4 w-4" /></button>
        <button type="button" title="Fit chart" aria-label="Fit chart" onClick={fit} className="rounded p-1.5 text-[#62718A] hover:bg-[#EDF3FA]"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" title="Full organization" aria-label="Full organization" onClick={() => setFocus("")} className="rounded p-1.5 text-[#62718A] hover:bg-[#EDF3FA]"><LocateFixed className="h-4 w-4" /></button>
      </div>
      {graph.positions.length > 0 ? <div className="absolute bottom-3 right-3 z-20 w-[168px] rounded-lg border border-[#D8E2ED] bg-white/95 p-2 shadow-md" data-testid="orgchart-mini-map">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#7790A9]">Overview map · click to move</div>
        <svg viewBox={`0 0 ${graph.width} ${graph.height}`} role="img" aria-label="Mini-map of expanded reporting tree" className="h-[92px] w-full cursor-crosshair rounded bg-[#F3F6FA]" onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width * graph.width;
          const y = (event.clientY - bounds.top) / bounds.height * graph.height;
          setOffset({ x: viewport.width / 2 - x * zoom, y: viewport.height / 2 - y * zoom });
        }}>
          {graph.positions.map(({ node, x, y }) => <rect key={node.key} x={x - CARD_W / 2} y={y - CARD_H / 2} width={CARD_W} height={CARD_H} rx="15" fill={node.type === "employee" ? "#79A5D9" : "#83C4AA"} />)}
          <rect x={Math.max(0, -offset.x / zoom)} y={Math.max(0, -offset.y / zoom)} width={viewport.width / zoom} height={viewport.height / zoom} fill="none" stroke="#225897" strokeWidth={Math.max(3, graph.width / 400)} strokeDasharray="12 8" />
        </svg>
      </div> : null}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-white/85 px-2 py-1 text-[10px] text-[#778393] shadow-sm">Drag to pan · Ctrl + scroll to zoom · {Math.round(zoom * 100)}%</div>
      {chartRoots.length === 0 ? <div className="flex h-full items-center justify-center text-[12px] text-[#66768C]">No employees match these filters.</div> : (
        <div className="org-canvas-camera absolute left-0 top-0 origin-top-left" data-dragging={isDragging} style={{ width: graph.width, height: graph.height, transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${graph.width} ${graph.height}`}>
            {graph.positions.map(({ node, x, y, parent }) => {
              const leader = parent ? placed.get(parent) : undefined;
              if (!leader) return null;
              const startY = leader.y + CARD_H / 2;
              const endY = y - CARD_H / 2;
              const middle = (startY + endY) / 2;
              return <path key={node.key} d={`M ${leader.x} ${startY} C ${leader.x} ${middle}, ${x} ${middle}, ${x} ${endY}`} fill="none" stroke={node.type === "employee" ? "#B9C4D4" : "#9CC4BB"} strokeWidth="1.35" strokeDasharray={node.type === "employee" ? undefined : "4 4"} />;
            })}
          </svg>
          {graph.positions.map(({ node, x, y }) => {
            const isEmployee = node.type === "employee";
            const isGroup = node.type === "group";
            const isPartner = node.type === "partner";
            const hasChildren = node.children.length > 0 || node.count > 0;
            const expandedNode = expanded.has(node.key);
            return <article key={node.key} className={`org-interactive-card absolute flex flex-col items-center justify-between rounded-lg border px-2.5 py-2 text-center shadow-[0_2px_7px_rgba(31,46,66,0.11)] transition-colors ${isGroup ? "border-[#B7D2ED] bg-[#EDF5FF]" : isEmployee && focus === node.employee?.id ? "border-[#82AEEA] bg-[#E9F2FF]" : isPartner || node.type === "branch" ? "border-[#BEDDD3] bg-[#F9FFFC]" : "border-[#D9DFE7] bg-white hover:border-[#9CB9E2]"}`} style={{ width: CARD_W, height: CARD_H, left: x - CARD_W / 2, top: y - CARD_H / 2 }}>
              <div className="w-full">
                <p className="truncate text-[10px] font-semibold text-[#34465C]" title={node.subtitle}>{node.subtitle}</p>
                <p className="mt-0.5 truncate text-[9px] text-[#8A96A8]">{node.detail}</p>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[#E5EFFE] text-[10px] font-bold text-[#315C91] shadow-sm">{isEmployee ? initials(node.label) : isGroup ? <Users className="h-3.5 w-3.5" /> : isPartner ? <Handshake className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}</div>
              {node.partner ? <Link href={`/intermediaries/applications/${node.partner.applicationId}`} title={node.label} className="w-full truncate text-[10px] font-semibold text-[#183A60] hover:underline">{node.label}</Link> : <button type="button" title={node.label} onClick={() => node.employee ? setFocus(node.employee.id) : toggle(node.key)} className="w-full truncate text-[10px] font-semibold text-[#183A60] hover:underline">{node.label}</button>}
              {node.employee ? <button type="button" onClick={() => setDetailsId(node.employee!.id)} className="absolute right-1 top-1 rounded bg-white/90 px-1 text-[9px] font-semibold text-[#4272A6] hover:bg-[#E5EFFB]" aria-label={`View details for ${node.label}`}>Info</button> : null}
              {hasChildren ? <button type="button" onClick={() => toggle(node.key)} aria-expanded={expandedNode || (isEmployee && Boolean(search || department))} aria-label={`Toggle ${node.label} descendants`} className="absolute -bottom-3 left-1/2 z-10 flex h-6 min-w-8 -translate-x-1/2 items-center justify-center gap-0.5 rounded-full border-2 border-[#FAF9F6] bg-[#477CD5] px-1 text-[9px] font-semibold text-white shadow-sm">{expandedNode ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{node.count}</button> : null}
              <span className="pointer-events-none absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-[#CCD7E4] bg-white" />
            </article>;
          })}
        </div>
      )}
    </div>
    <EmployeeOrgchartDetails employee={selectedDetails} manager={selectedDetails?.reporting_manager_id ? employeeById.get(selectedDetails.reporting_manager_id) : undefined} reports={detailReports} partners={detailPartners} managers={managers} portalRoles={portalRoles} canManage={canManage} canManagePortalAccess={canManagePortalAccess} onClose={closeDetails} onFocus={navigateToEmployee} />
  </div>;
}
