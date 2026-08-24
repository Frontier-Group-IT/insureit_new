"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  History,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  discardReconciliationDraft,
  loadExpectedReconciliationPolicies,
  matchReconciliationPolicies,
  saveReconciliationDraft,
  submitReconciliationCycle,
  type ReconciliationPolicyMatch,
  type ReconciliationSourceMethod,
} from "./actions";

type InsurerOption = { id: string; name: string };
type RowStatus = "draft" | "matched" | "unmatched" | "ready";
type Row = {
  id: string;
  policyNo: string;
  policyId: string;
  insurerName: string;
  customerName: string;
  vehicleNo: string;
  issuanceDate: string;
  projectedPayin: number | null;
  actualPayin: string;
  tds: string;
  adjustment: string;
  transactionType: string;
  reason: string;
  reference: string;
  remarks: string;
  status: RowStatus;
};
type DraftListItem = {
  id: string;
  period_start: string;
  period_end: string;
  statement_reference: string | null;
  statement_date: string | null;
  settlement_cycle: string | null;
  source_method: string;
  row_count: number;
  draft_saved_at: string | null;
  insurance_companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};
type DraftPayloadRow = {
  policyNo?: string;
  actualPayin?: number | null;
  tds?: number | null;
  adjustment?: number | null;
  transactionType?: string;
  reason?: string;
  reference?: string;
  remarks?: string;
};
type InitialDraft = {
  id: string;
  insurer_id: string;
  period_start: string;
  period_end: string;
  accounting_period_start: string | null;
  accounting_period_end: string | null;
  statement_date: string | null;
  statement_reference: string | null;
  settlement_cycle: string | null;
  source_method: ReconciliationSourceMethod;
  draft_saved_at: string | null;
  draft_payload?: { rows?: DraftPayloadRow[] } | null;
};
type Props = { insurers: InsurerOption[]; drafts: DraftListItem[]; initialDraft: InitialDraft | null };

const reasons = ["", "Matched", "Commercial rate difference", "Insurer short payment", "Insurer excess payment", "Cancellation", "Reversal", "Endorsement", "Hold", "Hold release", "Previous-period adjustment", "Manual insurer adjustment", "Other"];
const transactionTypes = ["Commission", "Reversal", "Cancellation", "Endorsement", "Adjustment", "Hold", "Hold release", "Other"];
const fieldClass = "h-8 w-full rounded-lg border border-[#D8DEE9] bg-white px-2.5 text-[9px] font-medium text-[#26364F] outline-none transition focus:border-[#315B9A] focus:ring-2 focus:ring-[#E5EEFB]";
const gridInput = "h-7 w-full rounded-md border border-[#D8DEE9] bg-white px-2 text-[8.5px] font-medium text-[#26364F] outline-none focus:border-[#315B9A] focus:ring-1 focus:ring-[#DCE8FA]";

function uid() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function blankRow(): Row { return { id: uid(), policyNo: "", policyId: "", insurerName: "", customerName: "", vehicleNo: "", issuanceDate: "", projectedPayin: null, actualPayin: "", tds: "", adjustment: "", transactionType: "Commission", reason: "", reference: "", remarks: "", status: "draft" }; }
function numeric(value: string) { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function optionalNumeric(value: string) { if (value.trim() === "") return null; const parsed = Number(value.replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function variance(row: Row) { if (row.projectedPayin === null || row.actualPayin === "") return null; return numeric(row.actualPayin) + numeric(row.adjustment) - row.projectedPayin; }
function money(value: number | null) { return value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }
function monthBounds() { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0); const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; return { start: iso(first), end: iso(last) }; }
function firstRelationName(value: DraftListItem["insurance_companies"]) { const item = Array.isArray(value) ? value[0] : value; return item?.name ?? "Insurer"; }
function fromMatch(match: ReconciliationPolicyMatch, current?: Row): Row { const row = current ?? blankRow(); return { ...row, policyNo: match.policyNo, policyId: match.policyId, insurerName: match.insurerName, customerName: match.customerName, vehicleNo: match.vehicleNo, issuanceDate: match.issuanceDate, projectedPayin: match.projectedPayin, status: row.actualPayin === "" ? "matched" : "ready" }; }
function fromDraftRow(value: DraftPayloadRow): Row { return { ...blankRow(), policyNo: value.policyNo ?? "", actualPayin: value.actualPayin === null || value.actualPayin === undefined ? "" : String(value.actualPayin), tds: value.tds === null || value.tds === undefined ? "" : String(value.tds), adjustment: value.adjustment === null || value.adjustment === undefined ? "" : String(value.adjustment), transactionType: value.transactionType || "Commission", reason: value.reason || "", reference: value.reference || "", remarks: value.remarks || "" }; }

export function ReconciliationScreen({ insurers, drafts, initialDraft }: Props) {
  const bounds = useMemo(monthBounds, []);
  const [cycleId, setCycleId] = useState(initialDraft?.id ?? "");
  const [insurerId, setInsurerId] = useState(initialDraft?.insurer_id ?? "");
  const [periodStart, setPeriodStart] = useState(initialDraft?.period_start ?? bounds.start);
  const [periodEnd, setPeriodEnd] = useState(initialDraft?.period_end ?? bounds.end);
  const [accountingStart, setAccountingStart] = useState(initialDraft?.accounting_period_start ?? bounds.start);
  const [accountingEnd, setAccountingEnd] = useState(initialDraft?.accounting_period_end ?? bounds.end);
  const [statementDate, setStatementDate] = useState(initialDraft?.statement_date ?? "");
  const [reference, setReference] = useState(initialDraft?.statement_reference ?? "");
  const [settlementCycle, setSettlementCycle] = useState(initialDraft?.settlement_cycle ?? "");
  const [sourceMethod, setSourceMethod] = useState<ReconciliationSourceMethod>(initialDraft?.source_method ?? "manual");
  const [rows, setRows] = useState<Row[]>(() => initialDraft?.draft_payload?.rows?.length ? initialDraft.draft_payload.rows.map(fromDraftRow) : [blankRow()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState<string | null>(initialDraft ? "Draft loaded." : null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialDraft ? "saved" : "idle");
  const [showDrafts, setShowDrafts] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSavedSignature = useRef("");

  const selectedInsurer = insurers.find((item) => item.id === insurerId);
  const activeRows = rows.filter((row) => row.policyNo.trim());
  const groups = useMemo(() => {
    const map = new Map<string, { count: number; actual: number; adjustment: number; projected: number | null }>();
    for (const row of activeRows) {
      const key = row.policyNo.trim().toUpperCase();
      const current = map.get(key) ?? { count: 0, actual: 0, adjustment: 0, projected: row.projectedPayin };
      current.count += 1;
      current.actual += row.actualPayin === "" ? 0 : numeric(row.actualPayin);
      current.adjustment += numeric(row.adjustment);
      if (current.projected === null) current.projected = row.projectedPayin;
      map.set(key, current);
    }
    return map;
  }, [activeRows]);
  const repeatedGroups = useMemo(() => Array.from(groups.entries()).filter(([, group]) => group.count > 1), [groups]);
  const counts = useMemo(() => {
    let matched = 0, unmatched = 0, varianceCount = 0, ready = 0, holds = 0;
    for (const row of activeRows) {
      if (row.status === "unmatched") unmatched += 1;
      if (row.policyId) matched += 1;
      const diff = variance(row);
      if (diff !== null && Math.abs(diff) > 1) varianceCount += 1;
      if (row.actualPayin !== "") ready += 1;
      if (["Hold", "Hold release"].includes(row.transactionType)) holds += 1;
    }
    return { total: activeRows.length, policies: groups.size, matched, unmatched, varianceCount, ready, holds };
  }, [activeRows, groups.size]);

  const missingActualRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => Boolean(row.policyNo.trim()) && row.actualPayin === "");
  const submitIssues: string[] = [];
  if (!insurerId) submitIssues.push("Select insurer");
  if (!activeRows.length) submitIssues.push("Add at least one policy row");
  if (missingActualRows.length) submitIssues.push(`${missingActualRows.length} row${missingActualRows.length === 1 ? "" : "s"} missing Actual Recognized`);
  const canSubmit = submitIssues.length === 0 && !isPending;

  function patch(rowId: string, values: Partial<Row>) { setRows((current) => current.map((row) => row.id === rowId ? { ...row, ...values } : row)); setSaveState("idle"); }
  function addRow() { setRows((current) => [...current, blankRow()]); setSaveState("idle"); }
  function removeRow(rowId: string) { setRows((current) => current.length === 1 ? [blankRow()] : current.filter((row) => row.id !== rowId)); setSaveState("idle"); }
  function draftRows() { return rows.filter((row) => row.policyNo.trim() || row.actualPayin || row.reference || row.remarks).map((row) => ({ policyNo: row.policyNo, actualPayin: optionalNumeric(row.actualPayin), tds: optionalNumeric(row.tds), adjustment: optionalNumeric(row.adjustment), transactionType: row.transactionType, reason: row.reason, reference: row.reference, remarks: row.remarks })); }
  function draftInput() { return { cycleId: cycleId || null, insurerId, periodStart, periodEnd, accountingPeriodStart: accountingStart, accountingPeriodEnd: accountingEnd, statementDate, statementReference: reference, settlementCycle, sourceMethod, rows: draftRows() }; }

  async function saveDraft(silent = false) {
    if (!insurerId || !periodStart || !periodEnd) return;
    setSaveState("saving");
    try {
      const result = await saveReconciliationDraft(draftInput());
      setCycleId(result.cycleId);
      setSaveState("saved");
      lastSavedSignature.current = JSON.stringify(draftInput());
      if (!silent) setMessage("Draft saved.");
      if (!cycleId) window.history.replaceState(null, "", `/reconciliation?draft=${result.cycleId}`);
    } catch (error) {
      setSaveState("error");
      if (!silent) setMessage(error instanceof Error ? error.message : "Draft could not be saved.");
    }
  }

  useEffect(() => {
    if (!insurerId) return;
    const signature = JSON.stringify({ insurerId, periodStart, periodEnd, accountingStart, accountingEnd, statementDate, reference, settlementCycle, sourceMethod, rows: draftRows() });
    if (signature === lastSavedSignature.current) return;
    const timer = window.setTimeout(() => { void saveDraft(true); }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insurerId, periodStart, periodEnd, accountingStart, accountingEnd, statementDate, reference, settlementCycle, sourceMethod, rows]);

  function matchRows(targetRows = rows) {
    const candidates = targetRows.filter((row) => row.policyNo.trim());
    if (!candidates.length) { setMessage("Enter at least one policy number."); return; }
    startTransition(async () => {
      try {
        const results = await matchReconciliationPolicies(candidates.map((row) => row.policyNo), insurerId || undefined);
        const queues = new Map<string, typeof results>();
        for (const result of results) {
          const key = result.inputPolicyNo.trim().toUpperCase();
          const list = queues.get(key) ?? [];
          list.push(result);
          queues.set(key, list);
        }
        setRows((current) => current.map((row) => {
          if (!row.policyNo.trim()) return row;
          const result = queues.get(row.policyNo.trim().toUpperCase())?.shift();
          if (!result) return row;
          return result.match ? fromMatch(result.match, row) : { ...row, policyId: "", insurerName: "", customerName: "", vehicleNo: "", issuanceDate: "", projectedPayin: null, status: "unmatched" };
        }));
        setMessage("Policy matching completed.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Policy matching failed."); }
    });
  }

  function loadExpected() {
    if (!insurerId) { setMessage("Select an insurer first."); return; }
    setSourceMethod("expected_policies");
    startTransition(async () => {
      try {
        const matches = await loadExpectedReconciliationPolicies({ insurerId, periodStart, periodEnd });
        setRows(matches.length ? matches.map((match) => fromMatch(match)) : [blankRow()]);
        setMessage(matches.length ? `${matches.length} expected policies loaded.` : "No policies found for this insurer and period.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Policies could not be loaded."); }
    });
  }

  function importText(text: string, method: ReconciliationSourceMethod) {
    const parsed = parseDelimited(text);
    if (!parsed.length) { setMessage("No usable rows found."); return; }
    const next = parsed.map((values) => ({ ...blankRow(), policyNo: values.policyNo, actualPayin: values.actualPayin, tds: values.tds, adjustment: values.adjustment, transactionType: values.transactionType || "Commission", reason: values.reason, reference: values.reference, remarks: values.remarks }));
    setSourceMethod(method);
    setRows(next);
    setPasteText("");
    setPasteOpen(false);
    setMessage(`${next.length} rows loaded. Matching policies…`);
    window.setTimeout(() => matchRows(next), 0);
  }

  async function onFile(file: File | undefined) { if (!file) return; const text = await file.text(); importText(text, "template_import"); if (fileRef.current) fileRef.current.value = ""; }
  function downloadTemplate() { const content = "Policy No,Actual Recognized Brokerage,TDS,Adjustment,Transaction Type,Reason,Insurer Reference,Remarks\n"; const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "INSUREIT_Reconciliation_Template.csv"; anchor.click(); URL.revokeObjectURL(url); }
  function submitCycle() {
    if (!canSubmit) { setMessage(submitIssues.join(" · ")); return; }
    startTransition(async () => {
      try {
        const result = await submitReconciliationCycle({ ...draftInput(), rows: activeRows.map((row) => ({ policyNo: row.policyNo, actualPayin: numeric(row.actualPayin), tds: optionalNumeric(row.tds), adjustment: optionalNumeric(row.adjustment), transactionType: row.transactionType, reason: row.reason, reference: row.reference, remarks: row.remarks })) });
        window.location.href = `/reconciliation/${result.cycleId}`;
      } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation could not be submitted."); }
    });
  }
  function discardDraft() { if (!cycleId) { setRows([blankRow()]); return; } startTransition(async () => { try { await discardReconciliationDraft(cycleId); window.location.href = "/reconciliation"; } catch (error) { setMessage(error instanceof Error ? error.message : "Draft could not be discarded."); } }); }
  function gridKey(event: KeyboardEvent<HTMLElement>, rowIndex: number, column: string) { if (event.key !== "Enter" || event.shiftKey) return; event.preventDefault(); const next = document.querySelector<HTMLElement>(`[data-grid-row="${rowIndex + 1}"][data-grid-col="${column}"]`); if (next) next.focus(); else { addRow(); window.setTimeout(() => document.querySelector<HTMLElement>(`[data-grid-row="${rowIndex + 1}"][data-grid-col="${column}"]`)?.focus(), 0); } }

  return <div className="mx-auto max-w-[1760px] space-y-2.5 pb-6">
    <section className="rounded-2xl border border-[#D9E2F0] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[17px] font-semibold text-[#17365D]">Insurer Reconciliation</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <IconLink href="/reconciliation/history" label="History"><History className="h-4 w-4" /></IconLink>
          <IconButton label="Download template" onClick={downloadTemplate}><Download className="h-4 w-4" /></IconButton>
          <IconButton label="Paste Excel" onClick={() => setPasteOpen((value) => !value)} active={pasteOpen}><FileSpreadsheet className="h-4 w-4" /></IconButton>
          <IconButton label="Import template" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /></IconButton>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(event) => void onFile(event.target.files?.[0])} />
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Insurer"><select className={fieldClass} value={insurerId} onChange={(event) => { setInsurerId(event.target.value); setSaveState("idle"); }}><option value="">Select insurer</option>{insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Statement from"><input type="date" className={fieldClass} value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></Field>
        <Field label="Statement to"><input type="date" className={fieldClass} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></Field>
        <Field label="Statement date"><input type="date" className={fieldClass} value={statementDate} onChange={(event) => setStatementDate(event.target.value)} /></Field>
        <Field label="Accounting from"><input type="date" className={fieldClass} value={accountingStart} onChange={(event) => setAccountingStart(event.target.value)} /></Field>
        <Field label="Accounting to"><input type="date" className={fieldClass} value={accountingEnd} onChange={(event) => setAccountingEnd(event.target.value)} /></Field>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_auto_auto_auto]">
        <Field label="Batch reference"><input className={fieldClass} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Statement reference" /></Field>
        <Field label="Settlement cycle"><input className={fieldClass} value={settlementCycle} onChange={(event) => setSettlementCycle(event.target.value)} placeholder="e.g. Aug 2026 Clear" /></Field>
        <Field label="Input source"><select className={fieldClass} value={sourceMethod} onChange={(event) => setSourceMethod(event.target.value as ReconciliationSourceMethod)}><option value="manual">Manual</option><option value="excel_paste">Excel paste</option><option value="template_import">Template</option><option value="expected_policies">Expected policies</option></select></Field>
        <ActionButton label="Load policies" onClick={loadExpected} disabled={isPending || !insurerId}><Search className="h-3.5 w-3.5" /></ActionButton>
        <ActionButton label={saveState === "saving" ? "Saving" : "Save draft"} onClick={() => void saveDraft(false)} disabled={!insurerId || isPending} primary><Save className="h-3.5 w-3.5" /></ActionButton>
        <IconButton label="Discard draft" onClick={discardDraft} danger disabled={isPending}><Trash2 className="h-4 w-4" /></IconButton>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#EDF0F4] pt-2 text-[8px] text-[#667085]">
        <span className={`inline-flex items-center gap-1 font-bold ${saveState === "error" ? "text-[#B42318]" : "text-[#0F766E]"}`}><Check className="h-3 w-3" />{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Draft saved" : saveState === "error" ? "Save failed" : "Unsaved changes"}</span>
        {selectedInsurer ? <span>{selectedInsurer.name}</span> : null}
        {drafts.length ? <button type="button" onClick={() => setShowDrafts((value) => !value)} className="ml-auto inline-flex items-center gap-1 font-semibold text-[#526277]">Open drafts ({drafts.length}) <ChevronDown className={`h-3 w-3 transition ${showDrafts ? "rotate-180" : ""}`} /></button> : null}
      </div>
      {showDrafts && drafts.length ? <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg bg-[#F8FAFC] p-2">{drafts.slice(0,12).map((draft) => <Link key={draft.id} href={`/reconciliation?draft=${draft.id}`} className={`rounded-lg border px-2.5 py-1.5 text-[8px] font-semibold ${draft.id === cycleId ? "border-[#315B9A] bg-[#EEF4FF] text-[#315B9A]" : "border-[#D8DEE9] bg-white text-[#526277]"}`}>{firstRelationName(draft.insurance_companies)} · {draft.period_start} · {draft.row_count}</Link>)}</div> : null}
      {pasteOpen ? <div className="mt-2 flex gap-2 rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] p-2"><textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} className="min-h-20 flex-1 rounded-lg border border-[#D8DEE9] bg-white p-2 font-mono text-[8.5px] outline-none" placeholder="Paste Excel rows: Policy No | Actual Recognized | TDS | Adjustment | Transaction Type | Reason | Reference | Remarks" /><div className="flex flex-col justify-end gap-1.5"><IconButton label="Cancel" onClick={() => { setPasteText(""); setPasteOpen(false); }}><X className="h-4 w-4" /></IconButton><IconButton label="Load rows" onClick={() => importText(pasteText, "excel_paste")} active><Check className="h-4 w-4" /></IconButton></div></div> : null}
    </section>

    <section className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
      <Metric label="Transactions" value={counts.total} />
      <Metric label="Policies" value={counts.policies} />
      <Metric label="Matched" value={counts.matched} tone="good" />
      <Metric label="Unmatched" value={counts.unmatched} tone={counts.unmatched ? "bad" : "neutral"} />
      <Metric label="Variance" value={counts.varianceCount} tone={counts.varianceCount ? "warn" : "neutral"} />
      <Metric label="Hold / release" value={counts.holds} />
      <Metric label="Actual entered" value={counts.ready} />
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EDF0F4] px-3 py-2">
        <h2 className="text-[11px] font-semibold text-[#17365D]">Statement transactions</h2>
        <span className="text-[8px] text-[#8490A1]">{activeRows.length} rows</span>
        <div className="ml-auto flex items-center gap-1.5">
          <ActionButton label="Match" onClick={() => matchRows()} disabled={isPending}><Search className="h-3.5 w-3.5" /></ActionButton>
          <IconButton label="Add row" onClick={addRow}><Plus className="h-4 w-4" /></IconButton>
          <IconButton label="Clear sheet" onClick={() => { setRows([blankRow()]); setMessage("Sheet cleared."); }}><RotateCcw className="h-4 w-4" /></IconButton>
        </div>
      </div>
      <div className="max-h-[64vh] overflow-auto">
        <table className="w-full min-w-[1450px] border-separate border-spacing-0 text-[8.5px]">
          <thead className="sticky top-0 z-30 bg-[#F8FAFC] text-[7px] font-black uppercase tracking-[.04em] text-[#7C899B]"><tr>
            <th className="sticky left-0 z-40 w-[36px] border-b bg-[#F8FAFC] px-2 py-2 text-left">#</th>
            <th className="sticky left-[36px] z-40 min-w-[210px] border-b bg-[#F8FAFC] px-2 py-2 text-left">Policy / Customer</th>
            <th className="min-w-[95px] border-b px-2 py-2 text-right">Projected</th>
            <th className="min-w-[105px] border-b px-2 py-2 text-right">Actual Recognized</th>
            <th className="min-w-[90px] border-b px-2 py-2 text-right">Adjustment</th>
            <th className="min-w-[88px] border-b px-2 py-2 text-right">Variance</th>
            <th className="min-w-[90px] border-b px-2 py-2 text-right">TDS</th>
            <th className="min-w-[125px] border-b px-2 py-2 text-left">Transaction</th>
            <th className="min-w-[175px] border-b px-2 py-2 text-left">Reason</th>
            <th className="min-w-[150px] border-b px-2 py-2 text-left">Reference</th>
            <th className="min-w-[180px] border-b px-2 py-2 text-left">Remarks</th>
            <th className="min-w-[72px] border-b px-2 py-2 text-center">Match</th>
            <th className="sticky right-0 z-40 w-[42px] border-b bg-[#F8FAFC] px-1 py-2" />
          </tr></thead>
          <tbody>{rows.map((row, index) => {
            const diff = variance(row);
            const group = groups.get(row.policyNo.trim().toUpperCase());
            const actualMissing = Boolean(row.policyNo.trim()) && row.actualPayin === "";
            return <tr key={row.id} className="hover:bg-[#FBFCFE]">
              <td className="sticky left-0 z-20 border-b border-[#EDF0F4] bg-white px-2 py-1.5 text-[7.5px] text-[#98A2B3]">{index + 1}</td>
              <td className="sticky left-[36px] z-20 border-b border-[#EDF0F4] bg-white px-2 py-1.5">
                <input data-grid-row={index} data-grid-col="policy" onKeyDown={(event) => gridKey(event, index, "policy")} value={row.policyNo} onChange={(event) => patch(row.id, { policyNo: event.target.value, policyId: "", status: "draft" })} className={`${gridInput} font-semibold text-[#17365D]`} placeholder="Policy number" />
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[7px] text-[#8490A1]"><span className="truncate">{row.customerName || row.vehicleNo || row.insurerName || "Not matched"}</span>{group && group.count > 1 ? <span className="shrink-0 rounded-full bg-[#EEF4FF] px-1.5 py-0.5 font-bold text-[#315B9A]">{group.count} rows</span> : null}</div>
              </td>
              <td className="border-b border-[#EDF0F4] px-2 py-1.5 text-right font-semibold tabular-nums">{money(row.projectedPayin)}</td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><input data-grid-row={index} data-grid-col="actual" onKeyDown={(event) => gridKey(event, index, "actual")} type="number" step="0.01" value={row.actualPayin} onChange={(event) => patch(row.id, { actualPayin: event.target.value, status: row.policyId ? "ready" : row.status })} className={`${gridInput} text-right font-semibold ${actualMissing ? "border-[#F59E0B] bg-[#FFF9EC] ring-1 ring-[#FDE7B0]" : ""}`} placeholder={actualMissing ? "Required" : "0.00"} /></td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><input data-grid-row={index} data-grid-col="adjustment" onKeyDown={(event) => gridKey(event, index, "adjustment")} type="number" step="0.01" value={row.adjustment} onChange={(event) => patch(row.id, { adjustment: event.target.value })} className={`${gridInput} text-right`} placeholder="0.00" /></td>
              <td className={`border-b border-[#EDF0F4] px-2 py-1.5 text-right font-bold tabular-nums ${varianceClass(diff)}`}>{money(diff)}</td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><input data-grid-row={index} data-grid-col="tds" onKeyDown={(event) => gridKey(event, index, "tds")} type="number" step="0.01" value={row.tds} onChange={(event) => patch(row.id, { tds: event.target.value })} className={`${gridInput} text-right`} placeholder="0.00" /></td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><select data-grid-row={index} data-grid-col="transaction" onKeyDown={(event) => gridKey(event, index, "transaction")} value={row.transactionType} onChange={(event) => patch(row.id, { transactionType: event.target.value })} className={gridInput}>{transactionTypes.map((item) => <option key={item}>{item}</option>)}</select></td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><select data-grid-row={index} data-grid-col="reason" onKeyDown={(event) => gridKey(event, index, "reason")} value={row.reason} onChange={(event) => patch(row.id, { reason: event.target.value })} className={gridInput}>{reasons.map((item) => <option key={item} value={item}>{item || "Select reason"}</option>)}</select></td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><input data-grid-row={index} data-grid-col="reference" onKeyDown={(event) => gridKey(event, index, "reference")} value={row.reference} onChange={(event) => patch(row.id, { reference: event.target.value })} className={gridInput} /></td>
              <td className="border-b border-[#EDF0F4] px-1.5 py-1"><input data-grid-row={index} data-grid-col="remarks" onKeyDown={(event) => gridKey(event, index, "remarks")} value={row.remarks} onChange={(event) => patch(row.id, { remarks: event.target.value })} className={gridInput} /></td>
              <td className="border-b border-[#EDF0F4] px-2 py-1.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="sticky right-0 z-20 border-b border-[#EDF0F4] bg-white px-1 py-1"><IconButton label={`Remove row ${index + 1}`} onClick={() => removeRow(row.id)} danger><Trash2 className="h-3.5 w-3.5" /></IconButton></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    {repeatedGroups.length ? <details className="rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><summary className="cursor-pointer px-3 py-2 text-[9px] font-semibold text-[#17365D]">Repeated policies ({repeatedGroups.length})</summary><div className="grid gap-1.5 border-t border-[#EDF0F4] p-2 sm:grid-cols-2 xl:grid-cols-4">{repeatedGroups.slice(0,16).map(([policyNo, group]) => { const net = group.actual + group.adjustment; const diff = group.projected === null ? null : net - group.projected; return <div key={policyNo} className="rounded-lg border border-[#E1E7EF] bg-[#F8FAFC] p-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-[8px] font-bold text-[#17365D]">{policyNo}</span><span className="text-[7px] text-[#667085]">{group.count} rows</span></div><div className="mt-1 flex justify-between gap-2 text-[7.5px]"><span>{money(group.projected)}</span><span>{money(net)}</span><span className={varianceClass(diff)}>{money(diff)}</span></div></div>; })}</div></details> : null}

    <section className={`sticky bottom-2 z-30 flex flex-wrap items-center gap-2 rounded-2xl border bg-white/95 px-3 py-2 shadow-[0_10px_28px_rgba(23,54,93,.13)] backdrop-blur ${canSubmit ? "border-[#A7D7BE]" : "border-[#F0CF8D]"}`}>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[9px] font-bold text-[#17365D]">Submission</span><span className={`rounded-full px-2 py-1 text-[7px] font-bold ${canSubmit ? "bg-[#E9F7F3] text-[#0F766E]" : "bg-[#FFF7E6] text-[#9A6700]"}`}>{canSubmit ? "Ready" : `${submitIssues.length} missing`}</span></div>{!canSubmit ? <div className="mt-1 truncate text-[8px] font-semibold text-[#8A5A00]" title={submitIssues.join(" · ")}>{submitIssues.join(" · ")}</div> : null}{message ? <div className="mt-1 truncate text-[8px] font-semibold text-[#315B6B]">{message}</div> : null}</div>
      <button onClick={submitCycle} disabled={!canSubmit} className={`h-8 rounded-lg px-4 text-[8.5px] font-bold ${canSubmit ? "bg-[#0F766E] text-white hover:bg-[#0B655E]" : "cursor-not-allowed border border-[#D8DEE9] bg-[#F2F4F7] text-[#98A2B3]"}`}>{isPending ? "Working…" : "Submit for review"}</button>
    </section>
  </div>;
}

function parseDelimited(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : ",";
  const split = (line: string) => line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]).map((value) => value.toLowerCase());
  const hasHeader = first.some((value) => value.includes("policy") || value.includes("actual") || value.includes("recognized"));
  const header = hasHeader ? first : ["policy no", "actual recognized brokerage", "tds", "adjustment", "transaction type", "reason", "insurer reference", "remarks"];
  const data = hasHeader ? lines.slice(1) : lines;
  const find = (names: string[]) => header.findIndex((value) => names.some((name) => value.includes(name)));
  const indexes = {
    policy: find(["policy"]), actual: find(["actual", "recognized"]), tds: find(["tds"]), adjustment: find(["adjust"]), transaction: find(["transaction"]), reason: find(["reason"]), reference: find(["reference", "ref"]), remarks: find(["remark", "note"]),
  };
  return data.map(split).map((values) => ({
    policyNo: values[indexes.policy >= 0 ? indexes.policy : 0] ?? "",
    actualPayin: values[indexes.actual >= 0 ? indexes.actual : 1] ?? "",
    tds: values[indexes.tds >= 0 ? indexes.tds : 2] ?? "",
    adjustment: values[indexes.adjustment >= 0 ? indexes.adjustment : 3] ?? "",
    transactionType: values[indexes.transaction >= 0 ? indexes.transaction : 4] ?? "Commission",
    reason: values[indexes.reason >= 0 ? indexes.reason : 5] ?? "",
    reference: values[indexes.reference >= 0 ? indexes.reference : 6] ?? "",
    remarks: values[indexes.remarks >= 0 ? indexes.remarks : 7] ?? "",
  })).filter((row) => row.policyNo || row.actualPayin || row.reference || row.remarks);
}

function varianceClass(value: number | null) { if (value === null || Math.abs(value) <= 1) return "text-[#667085]"; return value > 0 ? "text-[#137A4A]" : "text-[#B42318]"; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-1 block text-[7px] font-black uppercase tracking-[.04em] text-[#667085]">{label}</span>{children}</label>; }
function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "good" | "warn" | "bad" }) { const toneClass = tone === "good" ? "text-[#137A4A]" : tone === "bad" ? "text-[#B42318]" : tone === "warn" ? "text-[#B54708]" : "text-[#17365D]"; return <div className="rounded-xl border border-[#D9E2F0] bg-white px-3 py-2 shadow-sm"><div className="text-[7px] font-black uppercase tracking-[.04em] text-[#8490A1]">{label}</div><div className={`mt-0.5 text-[15px] font-semibold ${toneClass}`}>{value}</div></div>; }
function StatusBadge({ status }: { status: RowStatus }) { const style = status === "matched" ? "bg-[#EAF2FF] text-[#315B9A]" : status === "ready" ? "bg-[#E8F7EF] text-[#137A4A]" : status === "unmatched" ? "bg-[#FFF0F0] text-[#B42318]" : "bg-[#F2F4F7] text-[#667085]"; return <span className={`inline-flex rounded-full px-2 py-1 text-[7px] font-bold ${style}`}>{status}</span>; }
function IconButton({ label, onClick, children, active = false, danger = false, disabled = false }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; danger?: boolean; disabled?: boolean }) { return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-lg border transition disabled:opacity-40 ${danger ? "border-[#F2C7C7] bg-white text-[#B42318] hover:bg-[#FFF5F5]" : active ? "border-[#315B9A] bg-[#EEF4FF] text-[#315B9A]" : "border-[#D8DEE9] bg-white text-[#526277] hover:bg-[#F8FAFC]"}`}>{children}</button>; }
function IconLink({ href, label, children }: { href: string; label: string; children: ReactNode }) { return <Link href={href} title={label} aria-label={label} className="grid h-8 w-8 place-items-center rounded-lg border border-[#D8DEE9] bg-white text-[#526277] hover:bg-[#F8FAFC]">{children}</Link>; }
function ActionButton({ label, onClick, children, disabled = false, primary = false }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; primary?: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} className={`mt-[13px] inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[8.5px] font-bold disabled:opacity-40 ${primary ? "bg-[#17365D] text-white" : "border border-[#D8DEE9] bg-white text-[#17365D] hover:bg-[#F8FAFC]"}`}>{children}{label}</button>; }
