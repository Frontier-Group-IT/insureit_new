"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronDown, Files, FileText, Plus, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { filterPolicyRegisterPeriod } from "@/lib/policy-register-period";
import {
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

type PolicyDocument = {
  id: string;
  document_type: string;
  file_name: string;
};

type NonMotorDetails = { category: string | null; risk_title: string | null; risk_location: string | null; transit_from: string | null; transit_to: string | null; nature_of_business: string | null; liability_type: string | null; risk_details: Record<string, unknown> | null };

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  policy_product: string | null;
  business_line: string | null;
  issuance_date: string | null;
  created_at: string;
  start_date: string;
  end_date: string | null;
  insured_declared_value: number | null;
  gross_premium: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  rm_name: string | null;
  rm_employee_id: string | null;
  source_name: string | null;
  branch_source_code?: string | null;
  policy_documents: PolicyDocument[];
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string; chassis_no: string | null; engine_no: string | null } | null;
  insurance_companies: { name: string } | null;
  non_motor_policy_details: NonMotorDetails | null;
  claims: { count: number }[];
};

type SourceOption = { value: string; label: string };
type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";
type BusinessFilter = "all" | "Motor" | "Non Motor" | "Life" | "Health";
type TimeScope = "mtd" | "all";
type QuickDateRange = "mtd" | "90" | "365";
type PolicyRegisterReturnState = {
  query: string;
  view: ViewKey;
  timeScope: TimeScope;
  business: BusinessFilter;
  source: string;
  rm: string;
  fromDate: string;
  toDate: string;
  page: number;
};
const PAGE_SIZE = 10;
const POLICY_REGISTER_RETURN_STATE_KEY = "insureit:policy-register:return-state:v1";
const POLICY_REGISTER_PERIOD_KEY = "insureit:policy-register:period:v1";

function policySourceDatabaseType(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sibl / partner" || normalized === "partner") return "partner";
  if (normalized === "posp") return "posp";
  if (normalized === "misp") return "misp";
  return null;
}

function policySourceKey(row: Pick<PolicyRow, "intermediary_type" | "intermediary_code">) {
  const type = policySourceDatabaseType(row.intermediary_type);
  const code = row.intermediary_code?.trim();
  return type && code ? `${type}:${code}` : "";
}


/** Render menus through document.body so the horizontal filter strip never clips them. */
function usePolicyFloatingMenu(width: number, height: number, align: "left" | "right" = "left") {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const close = () => setPosition(null);
  const toggle = () => {
    if (position) { close(); return; }
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const availableWidth = Math.max(0, window.innerWidth - 16);
    const actualWidth = Math.min(width, availableWidth);
    const left = Math.max(8, Math.min(
      align === "right" ? bounds.right - actualWidth : bounds.left,
      window.innerWidth - actualWidth - 8,
    ));
    const openBelow = bounds.bottom + height + 8 <= window.innerHeight || bounds.bottom <= window.innerHeight - bounds.top;
    const top = openBelow ? bounds.bottom + 6 : Math.max(8, bounds.top - height - 6);
    const maxHeight = Math.max(72, (openBelow ? window.innerHeight - top : bounds.top - 14));
    setPosition({ top, left, maxHeight });
  };
  useEffect(() => {
    if (!position) return;
    const outside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (triggerRef.current?.contains(target) || menuRef.current?.contains(target))) return;
      close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    const dismissOnScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", dismissOnScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", dismissOnScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);
  return { triggerRef, menuRef, position, toggle, close };
}

function PolicyBusinessFilter({
  business,
  onBusinessChange,
}: {
  business: BusinessFilter;
  onBusinessChange: (value: BusinessFilter) => void;
}) {
  const label = business === "all" ? "All Policies" : business;
  const menu = usePolicyFloatingMenu(250, 255);
  return (
    <>
      <button ref={menu.triggerRef} type="button" aria-haspopup="true" aria-expanded={Boolean(menu.position)}
        aria-label={`Policy type: ${label}`} onClick={menu.toggle}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#334155] outline-none transition hover:border-[#9FB2C8] focus-visible:ring-2 focus-visible:ring-[#17365D]/10">
        <span className="truncate">{label}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#64748B] transition ${menu.position ? "rotate-180" : ""}`} />
      </button>
      {menu.position && createPortal(
        <div ref={menu.menuRef} role="group" aria-label="Business line options"
          style={{ position: "fixed", top: menu.position.top, left: menu.position.left, width: Math.min(250, window.innerWidth - 16), maxHeight: menu.position.maxHeight, zIndex: 9999 }}
          className="overflow-y-auto rounded-xl border border-[#D7E0EA] bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
          <p className="px-2 pb-1.5 pt-1 text-[8px] font-black uppercase tracking-[.1em] text-[#8A96A7]">Business line</p>
          {([["all","All Policies"],["Motor","Motor"],["Non Motor","Non Motor"],["Life","Life"],["Health","Health"]] as const).map(([value, text]) => (
            <button key={value} type="button" onClick={() => { onBusinessChange(value); menu.close(); }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10.5px] font-semibold transition ${business === value ? "bg-[#EEF4FB] text-[#17365D]" : "text-[#475569] hover:bg-[#F8FAFC]"}`}>
              {text}<span className={`h-2 w-2 rounded-full border ${business === value ? "border-[#17365D] bg-[#17365D]" : "border-[#CBD5E1]"}`} />
            </button>
          ))}
        </div>, document.body,
      )}
    </>
  );
}

function PolicyDateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onQuickRange,
  onClear,
}: {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onQuickRange: (value: QuickDateRange) => void;
  onClear: () => void;
}) {
  const label = fromDate || toDate
    ? `${fromDate ? shortFilterDate(fromDate) : "Any"} – ${toDate ? shortFilterDate(toDate) : "Any"}`
    : "Date Range";
  const activeQuickRange = quickDateRangeKey(fromDate, toDate);
  const menu = usePolicyFloatingMenu(292, 165, "right");
  return (
    <>
      <button ref={menu.triggerRef} type="button" aria-haspopup="true" aria-expanded={Boolean(menu.position)}
        aria-label={`Policy date range: ${label}`} onClick={menu.toggle}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] outline-none transition hover:border-[#9FB2C8] focus-visible:ring-2 focus-visible:ring-[#17365D]/10">
        <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#64748B]" /><span className="truncate">{label}</span></span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#64748B] transition ${menu.position ? "rotate-180" : ""}`} />
      </button>
      {menu.position && createPortal(
        <div ref={menu.menuRef} role="group" aria-label="Policy date range options"
          style={{ position: "fixed", top: menu.position.top, left: menu.position.left, width: Math.min(292, window.innerWidth - 16), maxHeight: menu.position.maxHeight, zIndex: 9999 }}
          className="overflow-y-auto rounded-xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
          <div className="grid grid-cols-2 gap-2">
            <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDateChange(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
            <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDateChange(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(["mtd", "90", "365"] as const).map((range) => (
                <button key={range} type="button" onClick={() => { onQuickRange(range); menu.close(); }}
                  className={`min-w-[48px] rounded-lg border px-2.5 py-1.5 text-[9px] font-bold transition ${activeQuickRange === range ? "border-[#7DA7E8] bg-[#EAF2FF] text-[#174EA6]" : "border-[#D7E0EA] bg-[#F8FAFC] text-[#475569] hover:border-[#AFC3DB] hover:bg-[#F1F5F9]"}`}>
                  {range === "mtd" ? "MTD" : range}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { onClear(); menu.close(); }} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-[#64748B] hover:bg-[#F8FAFC]">Clear dates</button>
          </div>
        </div>, document.body,
      )}
    </>
  );
}

/**
 * Direct period buttons avoid portal event/scroll dismissal races.
 * The same state drives the visible policy table, counters and pagination.
 */
function PolicyPeriodFilter({
  value,
  mtdCount,
  allCount,
  onChange,
}: {
  value: TimeScope;
  mtdCount: number;
  allCount: number;
  onChange: (value: TimeScope) => void;
}) {
  return (
    <div role="group" aria-label="Policy period" className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-xl border border-[#CBD5E1] bg-[#F3F6FA] p-0.5">
      {([
        { value: "mtd", label: "MTD", count: mtdCount },
        { value: "all", label: "All", count: allCount },
      ] as const).map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`inline-flex h-8 min-w-[74px] shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 text-[10px] font-bold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]/30 ${value === option.value
            ? "bg-[#0F766E] text-white shadow-sm"
            : "text-[#475569] hover:bg-white hover:text-[#17365D]"}`}
        >
          <span>{option.label}</span><span className={value === option.value ? "text-white/80" : "text-[#64748B]"}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

export function PolicyWorkspace({ rows, sourceOptions = [], isRelationshipManager = false }: { rows: PolicyRow[]; sourceOptions?: SourceOption[]; isRelationshipManager?: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [timeScope, setTimeScope] = useState<TimeScope>("mtd");
  const [business, setBusiness] = useState<BusinessFilter>("all");
  const [source, setSource] = useState("all");
  const [rm, setRm] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const { from: mtdStart, to: mtdEnd } = monthToDateBounds();

  useEffect(() => {
    try {
      // A saved navigation-return snapshot has priority; otherwise remember
      // MTD/All selection during normal register navigation and refresh.
      const raw = window.sessionStorage.getItem(POLICY_REGISTER_RETURN_STATE_KEY);
      const storedPeriod = window.sessionStorage.getItem(POLICY_REGISTER_PERIOD_KEY);
      if (raw) {
        window.sessionStorage.removeItem(POLICY_REGISTER_RETURN_STATE_KEY);
        const saved = JSON.parse(raw) as Partial<PolicyRegisterReturnState>;
        if (typeof saved.query === "string") setQuery(saved.query);
        if (["all", "active", "expiring", "expired", "claims"].includes(saved.view ?? "")) setView(saved.view as ViewKey);
        if (saved.timeScope === "mtd" || saved.timeScope === "all") setTimeScope(saved.timeScope);
        else if (storedPeriod === "mtd" || storedPeriod === "all") setTimeScope(storedPeriod);
        if (saved.business === "all" || saved.business === "Motor" || saved.business === "Non Motor" || saved.business === "Life" || saved.business === "Health") setBusiness(saved.business);
        if (typeof saved.source === "string") setSource(saved.source);
        if (!isRelationshipManager && typeof saved.rm === "string") setRm(saved.rm);
        if (typeof saved.fromDate === "string") setFromDate(saved.fromDate);
        if (typeof saved.toDate === "string") setToDate(saved.toDate);
        if (typeof saved.page === "number" && Number.isFinite(saved.page) && saved.page > 0) setPage(Math.floor(saved.page));
      } else if (storedPeriod === "mtd" || storedPeriod === "all") {
        setTimeScope(storedPeriod);
      }
    } catch {
      window.sessionStorage.removeItem(POLICY_REGISTER_RETURN_STATE_KEY);
    }
  }, [isRelationshipManager]);

  const enriched = useMemo(() => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })), [rows]);
  const rms = useMemo(() => Array.from(new Set(rows.map((row) => row.rm_name?.trim()).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b)), [rows]);
  const visibleSourceOptions = useMemo(() => {
    if (rm === "all") return sourceOptions;
    const rmSourceKeys = new Set(
      rows
        .filter((row) => row.rm_name?.trim() === rm)
        .map((row) => policySourceKey(row))
        .filter(Boolean)
    );
    return sourceOptions.filter((option) => rmSourceKeys.has(option.value));
  }, [rm, rows, sourceOptions]);
  const selectedSourceVisible = source === "all" || visibleSourceOptions.some((option) => option.value === source);
  const sourceSelectValue = selectedSourceVisible ? source : "all";

  useEffect(() => {
    if (rm === "all") return;
    if (source !== "all" && !visibleSourceOptions.some((option) => option.value === source)) {
      setSource(visibleSourceOptions.length === 1 ? visibleSourceOptions[0].value : "all");
      setPage(1);
      return;
    }
    if (source === "all" && visibleSourceOptions.length === 1) {
      setSource(visibleSourceOptions[0].value);
      setPage(1);
    }
  }, [rm, source, visibleSourceOptions]);

  const controlFiltered = useMemo(() => enriched.filter((row) => {
    const haystack = [row.policy_no, row.business_line, row.policy_type, row.policy_product, row.insurance_companies?.name, row.rm_name, row.vehicles?.vehicle_no, row.vehicles?.chassis_no, row.vehicles?.engine_no, row.customers?.company_name, row.customers?.contact_name, row.intermediary_type, row.intermediary_code, row.source_name, policyCategory(row), riskAssetPrimary(row), riskAssetSecondary(row)].filter(Boolean).join(" ").toLowerCase();
    const matchesBusiness = business === "all" || policyBusinessLine(row) === business;
    const matchesSource = source === "all" || policySourceKey(row) === source;
    const matchesRm = isRelationshipManager || rm === "all" || row.rm_name?.trim() === rm;
    const businessDate = policyBusinessDate(row);
    const matchesFromDate = !fromDate || businessDate >= fromDate;
    const matchesToDate = !toDate || businessDate <= toDate;
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesBusiness && matchesSource && matchesRm && matchesFromDate && matchesToDate && matchesQuery;
  }), [business, enriched, fromDate, isRelationshipManager, query, rm, source, toDate]);

  const mtdFiltered = useMemo(
    () => filterPolicyRegisterPeriod(controlFiltered, "mtd", mtdStart, mtdEnd, policyBusinessDate),
    [controlFiltered, mtdEnd, mtdStart],
  );
  // Apply the chosen period consistently, including while searching.
  // "All" must never silently fall back to the current-month subset.
  const baseFiltered = useMemo(
    () => filterPolicyRegisterPeriod(controlFiltered, timeScope, mtdStart, mtdEnd, policyBusinessDate),
    [controlFiltered, timeScope, mtdEnd, mtdStart],
  );

  const stats = useMemo(() => {
    const active = baseFiltered.filter((row) => row.status === "Active").length;
    const expiring = baseFiltered.filter((row) => row.status === "Expiring soon").length;
    const expired = baseFiltered.filter((row) => row.status === "Expired").length;
    const claims = baseFiltered.filter((row) => claimCount(row) > 0).length;
    return { all: baseFiltered.length, active, expiring, expired, claims };
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((row) =>
    view === "all" ||
    (view === "active" && row.status === "Active") ||
    (view === "expiring" && row.status === "Expiring soon") ||
    (view === "expired" && row.status === "Expired") ||
    (view === "claims" && claimCount(row) > 0)
  ), [baseFiltered, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  function changeTimeScope(next: TimeScope) {
    // Persist only the display choice; server-side RM / policy authorization
    // remains untouched. The explicit selection also resets status and dates.
    try { window.sessionStorage.setItem(POLICY_REGISTER_PERIOD_KEY, next); } catch {}
    setTimeScope(next);
    setFromDate("");
    setToDate("");
    setView("all");
    setPage(1);
  }

  function changeCustomFromDate(value: string) {
    setTimeScope("all");
    setFromDate(value);
    setView("all");
    setPage(1);
  }

  function changeCustomToDate(value: string) {
    setTimeScope("all");
    setToDate(value);
    setView("all");
    setPage(1);
  }

  function changeQuickDateRange(value: QuickDateRange) {
    const bounds = quickDateRangeBounds(value);
    setTimeScope("all");
    setFromDate(bounds.from);
    setToDate(bounds.to);
    setView("all");
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setBusiness("all");
    setSource("all");
    setRm("all");
    setTimeScope("mtd");
    try { window.sessionStorage.setItem(POLICY_REGISTER_PERIOD_KEY, "mtd"); } catch {}
    setFromDate("");
    setToDate("");
    setView("all");
    setPage(1);
  }

  function rememberReturnState() {
    const snapshot: PolicyRegisterReturnState = { query, view, timeScope, business, source, rm, fromDate, toDate, page: safePage };
    try {
      window.sessionStorage.setItem(POLICY_REGISTER_RETURN_STATE_KEY, JSON.stringify(snapshot));
    } catch {
      // A failed browser storage write should never block policy navigation.
    }
  }

  function openDocument(document: PolicyDocument) {
    if (openingDocumentId) return;
    setOpeningDocumentId(document.id);
    window.open(`/policies/documents/${encodeURIComponent(document.id)}/open`, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setOpeningDocumentId(null), 750);
  }

  return (
    <section
      className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]"
      onClickCapture={(event) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="/policies/"][href$="/edit"]') : null;
        if (target) rememberReturnState();
      }}
    >
      <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]"><FileText className="h-5 w-5" /></span>
            <h2 className="shrink-0 text-[18px] font-semibold leading-tight text-[#0F172A]">Policy Portfolio</h2>
            <label className="relative ml-1 min-w-0 flex-1 lg:max-w-[430px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search policy, customer, insurer, RM, vehicle, chassis, engine, risk or source"
                aria-label="Search policy, customer, insurer, RM, vehicle, chassis, engine, risk or source"
                className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[12px] text-[#0F172A] outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10"
              />
            </label>
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset filters"
              title="Reset filters"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#475569] transition hover:border-[#9FB2C8] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#17365D]/10"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <Link prefetch={false} href="/policies/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Policy</Link>
        </div>
      </div>

      <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [&>*]:shrink-0" role="region" aria-label="Policy portfolio filters" tabIndex={0}>
          <div className="w-[155px] min-w-[155px] [&_button]:!w-full [&_button]:!min-w-0 [&_button]:!max-w-full"><PolicyBusinessFilter
            business={business}
            onBusinessChange={(value) => {
              setBusiness(value);
              if (value === "Non Motor" && view === "claims") setView("all");
              setPage(1);
            }}
          /></div>
          <div className="w-[165px] min-w-[165px] [&>label]:block [&>label]:w-full [&_select]:!min-w-0 [&_select]:w-full">
            <RegisterSelect value={sourceSelectValue} onChange={(value) => { setSource(value); setPage(1); }} label="Lead source">
              <option value="all">All Sources</option>
              {visibleSourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </RegisterSelect>
          </div>
          {!isRelationshipManager ? (
          <div className="w-[135px] min-w-[135px] [&>label]:block [&>label]:w-full [&_select]:!min-w-0 [&_select]:w-full">
            <RegisterSelect value={rm} onChange={(value) => { setRm(value); if (value === "all") setSource("all"); setPage(1); }} label="Relationship manager">
              <option value="all">All RMs</option>
              {rms.map((item) => <option key={item} value={item}>{item}</option>)}
            </RegisterSelect>
          </div>
          ) : null}
          <div className="w-[150px] min-w-[150px] [&_summary]:!min-w-0 [&_summary]:!w-full"><PolicyDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={changeCustomFromDate}
            onToDateChange={changeCustomToDate}
            onQuickRange={changeQuickDateRange}
            onClear={() => { setTimeScope("all"); setFromDate(""); setToDate(""); setView("all"); setPage(1); }}
          /></div>
          <div className="ml-auto w-max min-w-max flex-none overflow-visible" role="region" aria-label="Policy period and status filters" tabIndex={0}>
            <div className="flex w-max min-w-max items-center gap-1 overflow-visible rounded-xl border border-[#D8E2EE] bg-[#F8FAFC] p-1">
              <PolicyPeriodFilter value={timeScope} mtdCount={mtdFiltered.length} allCount={controlFiltered.length} onChange={changeTimeScope} />
              <div className="min-w-max shrink-0 [&>div]:!w-max [&>div]:!flex-nowrap [&>div]:!overflow-visible [&>div>button]:!min-w-max [&>div>button]:!shrink-0 [&>div>button]:!whitespace-nowrap [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 xl:[&_button]:px-2.5 xl:[&_button]:text-[10px]">
                <RegisterViewTabs
                  value={view}
                  onChange={changeView}
                  options={[
                    { value: "active", label: "Active", count: stats.active },
                    { value: "expiring", label: "Due", count: stats.expiring },
                    { value: "expired", label: "Expired", count: stats.expired },
                    { value: "claims", label: "Claims", count: business === "Non Motor" ? undefined : stats.claims, disabled: business === "Non Motor", title: business === "Non Motor" ? "Non-Motor claim workflow is not enabled yet." : undefined }
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((policy) => <PolicyMobileCard key={policy.id} policy={policy} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, source, RM, date range or status view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1098px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[190px] px-3 py-2">Policy / Product</th>
              <th className="w-[188px] px-2.5 py-2">Customer</th>
              <th className="w-[142px] px-2.5 py-2">Risk / Asset</th>
              <th className="w-[178px] px-2.5 py-2 text-center">Insurer</th>
              <th className="w-[156px] px-2.5 py-2">Validity</th>
              <th className="w-[118px] px-2.5 py-2">Status</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Insured Value</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Gross Premium</th>
              <th className="w-[132px] px-2.5 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((policy) => (
              <tr key={policy.id} className="h-12 transition hover:bg-[#FAFCFF]">
                <td className="px-3"><PolicyTypeLink policy={policy} openingDocumentId={openingDocumentId} onOpenDocument={openDocument} /></td>
                <td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.customers?.company_name ?? "Individual account"}</p></td>
                <td className="px-2.5"><RiskAssetCell policy={policy} /></td>
                <td className="px-2.5"><InsurerLogoCell insurerName={policy.insurance_companies?.name} /></td>
                <td className="px-2.5"><p className="font-semibold">{formatDate(policy.start_date)} - {policy.end_date ? formatDate(policy.end_date) : "No fixed maturity date"}</p><p className="text-[9px] leading-4 text-[#64748B]">{validityHint(policy)}</p></td>
                <td className="px-2.5"><PolicyStatus policy={policy} /></td>
                <td className="px-2.5 text-right"><InsuredValueCell policy={policy} /></td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.gross_premium)}</td>
                <td className="px-2.5"><p className="truncate font-semibold capitalize">{policy.source_name ?? policy.intermediary_type?.replaceAll("_", " ") ?? "Direct"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.intermediary_code ?? "Sankalp"}{policy.branch_source_code ? ` · Branch ${policy.branch_source_code}` : ""}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, source, RM, date range or status view." /> : null}
      </div>

      <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
    </section>
  );
}

function PolicyMobileCard({ policy }: { policy: PolicyRow & { status: string; daysLeft: number | null } }) {
  const isNonMotor = policyBusinessLine(policy) === "Non Motor";
  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link prefetch={false} href={`/policies/${policy.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</Link>
          <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{policyBusinessLine(policy)} · {policyCategory(policy)}</p>
        </div>
        <PolicyStatus policy={policy} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
        <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.customers?.contact_name ?? "Customer not linked"}</span>
        <div className="grid grid-cols-2 gap-2">
          <span className="min-w-0 rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold"><span className="block truncate">{riskAssetPrimary(policy)}</span>{riskAssetSecondary(policy) ? <span className="mt-0.5 block truncate text-[9px] font-medium text-[#8490A1]">{riskAssetSecondary(policy)}</span> : null}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(policy)}</span>
        </div>
        <div className={`grid gap-2 ${isNonMotor ? "grid-cols-2" : "grid-cols-3"}`}>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{insuredValuePrefix(policy)} {formatInsuredValue(policy)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.gross_premium)}</span>
          {!isNonMotor ? <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{claimCount(policy)} claims</span> : null}
        </div>
      </div>
      <div className={`mt-3 grid gap-2 ${isNonMotor ? "grid-cols-1" : "grid-cols-2"}`}>
        <Link prefetch={false} href={`/policies/${policy.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111A35] px-3 text-[12px] font-bold text-white">Open policy</Link>
        {!isNonMotor ? <Link prefetch={false} href="/claims/new" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#BFD3F7] bg-[#F0F6FF] px-3 text-[12px] font-bold text-[#174EA6]">Report claim</Link> : null}
      </div>
    </article>
  );
}

function PolicyStatus({ policy }: { policy: PolicyRow & { status?: string; daysLeft?: number | null } }) {
  const status = policy.status ?? policyStatus(policy.end_date);
  if (status === "No fixed maturity") return <RegisterStatusPill tone="slate">No fixed maturity</RegisterStatusPill>;
  if (status === "Expired") return <RegisterStatusPill tone="red">Expired</RegisterStatusPill>;
  if (status === "Expiring soon") return <RegisterStatusPill tone="amber">Due</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Active</RegisterStatusPill>;
}

function PolicyTypeLink({ policy, openingDocumentId, onOpenDocument }: { policy: PolicyRow; openingDocumentId: string | null; onOpenDocument: (document: PolicyDocument) => void; }) {
  const businessLine = policyBusinessLine(policy);
  const category = policyCategory(policy);
  const product = policy.policy_product?.trim();
  const policyCopy = policy.policy_documents?.find((document) => document.document_type === "policy_copy") ?? null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link prefetch={false} href={`/policies/${policy.id}/edit`} title={policy.policy_no} className="min-w-0 text-[12px] text-[#0F172A] hover:text-[#17365D] hover:underline">
        <span className="block truncate"><span className="font-bold">{businessLine}</span><span aria-hidden="true" className="mx-1 text-[11px] font-normal">•</span><span className="font-normal">{category || "-"}</span></span>
        {businessLine === "Motor" && product && product.toLowerCase() !== category.toLowerCase() ? <span className="block truncate text-[8.5px] leading-3.5 text-[#7C899B]">{product}</span> : null}
      </Link>
      {policyCopy ? (
        <button type="button" onClick={() => onOpenDocument(policyCopy)} disabled={openingDocumentId === policyCopy.id} aria-label={`Open policy copy for ${policy.policy_no}`} title={policyCopy.file_name ? `Open policy copy: ${policyCopy.file_name}` : "Open policy copy"} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7c3aed] transition hover:bg-[#E9D5FF] hover:text-[#6D28D9] disabled:cursor-wait disabled:opacity-50">
          <Files className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function InsurerLogoCell({ insurerName }: { insurerName: string | null | undefined }) {
  const insurerLogo = getInsurerLogo(insurerName);
  return (
    <div className="flex items-center justify-center" title={insurerName || "Insurance company"}>
      {insurerLogo ? (
        <Image
          src={insurerLogo}
          alt={insurerName ? `${insurerName} logo` : "Insurance company"}
          width={42}
          height={24}
          className="max-h-6 max-w-[48px] object-contain"
        />
      ) : (
        <span className="grid h-7 w-9 place-items-center rounded-md border border-[#D8E2EE] bg-[#F8FAFC] text-[#64748B]" aria-label={insurerName ? `${insurerName} logo unavailable` : "Insurance company logo unavailable"}>
          <ShieldCheck className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

function RiskAssetCell({ policy }: { policy: PolicyRow }) {
  return <div className="min-w-0"><p className={`truncate font-semibold text-[#334155] ${policyBusinessLine(policy) === "Motor" ? "font-mono" : ""}`}>{riskAssetPrimary(policy)}</p>{riskAssetSecondary(policy) ? <p className="truncate text-[8.5px] leading-3.5 text-[#7C899B]">{riskAssetSecondary(policy)}</p> : null}</div>;
}

function InsuredValueCell({ policy }: { policy: PolicyRow }) {
  return <div className="text-right tabular-nums"><p className="font-semibold text-[#334155]">{formatInsuredValue(policy)}</p><p className="text-[8px] font-bold uppercase tracking-[.06em] text-[#8A96A7]">{insuredValuePrefix(policy)}</p></div>;
}

function policyBusinessLine(policy: PolicyRow) {
  return policy.business_line?.trim() || "Motor";
}

function policyCategory(policy: PolicyRow) {
  if (policyBusinessLine(policy) === "Non Motor") return policy.non_motor_policy_details?.category?.trim() || policy.policy_type?.trim() || "Other";
  return policy.policy_type?.trim() || "Other";
}

function riskAssetPrimary(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return policy.vehicles?.vehicle_no?.trim() || "Vehicle not linked";
  const detail = policy.non_motor_policy_details;
  const risk = detail?.risk_details ?? {};
  return firstText(
    detail?.risk_title,
    risk.cargoDescription,
    risk.projectName,
    risk.businessName,
    detail?.transit_from && detail?.transit_to ? `${detail.transit_from} → ${detail.transit_to}` : null,
    detail?.nature_of_business,
    detail?.liability_type,
    detail?.risk_location,
    "Non-Motor risk"
  );
}

function riskAssetSecondary(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return "";
  const detail = policy.non_motor_policy_details;
  const primary = riskAssetPrimary(policy);
  const location = detail?.risk_location?.trim();
  if (location && location !== primary) return location;
  if (detail?.transit_from && detail?.transit_to) {
    const route = `${detail.transit_from} → ${detail.transit_to}`;
    if (route !== primary) return route;
  }
  return "";
}

function insuredValuePrefix(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return "IDV";
  return /liability/i.test(policyCategory(policy)) ? "Limit" : "SI";
}

function isThirdPartyPolicy(policy: PolicyRow) {
  const thirdPartyPattern = /third[\s-]*party/i;
  return thirdPartyPattern.test(policy.policy_type?.trim() ?? "") || thirdPartyPattern.test(policy.policy_product?.trim() ?? "");
}

function formatInsuredValue(policy: PolicyRow) {
  if (policy.insured_declared_value) return formatCurrency(policy.insured_declared_value);
  return isThirdPartyPolicy(policy) ? "0" : "-";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "—";
}

function validityHint(policy: PolicyRow & { daysLeft?: number | null }) {
  if (!policy.end_date) return "No fixed maturity date";
  const days = policy.daysLeft ?? daysUntil(policy.end_date);
  if (days === null) return "Maturity date unavailable";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}
function policyBusinessDate(row: Pick<PolicyRow, "issuance_date" | "created_at">) {
  return row.issuance_date || row.created_at.slice(0, 10);
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthToDateBounds(now = new Date()) {
  return { from: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: formatLocalDate(now) };
}

function quickDateRangeBounds(value: QuickDateRange, now = new Date()) {
  if (value === "mtd") return monthToDateBounds(now);
  const days = value === "90" ? 90 : 365;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  from.setDate(from.getDate() - (days - 1));
  return { from: formatLocalDate(from), to: formatLocalDate(now) };
}

function quickDateRangeKey(fromDate: string, toDate: string): QuickDateRange | null {
  if (!fromDate || !toDate) return null;
  const ranges: QuickDateRange[] = ["mtd", "90", "365"];
  return ranges.find((range) => {
    const bounds = quickDateRangeBounds(range);
    return bounds.from === fromDate && bounds.to === toDate;
  }) ?? null;
}

function policyStatus(endDate: string | null) {
  if (!endDate) return "No fixed maturity";
  const days = daysUntil(endDate);
  if (days === null) return "No fixed maturity";
  return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active";
}
function daysUntil(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}
function shortFilterDate(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
}
function formatDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? day + "/" + month + "/" + year.slice(-2) : value;
}
function formatCurrency(value: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}
function claimCount(row: PolicyRow) { return row.claims?.[0]?.count ?? 0; }