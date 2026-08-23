"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, History, Plus, RotateCcw, Search, Upload } from "lucide-react";
import {
  loadExpectedReconciliationPolicies,
  matchReconciliationPolicies,
  submitReconciliationCycle,
  type ReconciliationPolicyMatch,
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
type DraftState = { insurerId: string; periodStart: string; periodEnd: string; reference: string; rows: Row[] };

const STORAGE_KEY = "insureit:reconciliation:draft:v1";
const reasons = ["", "Matched", "Commercial rate difference", "Insurer short payment", "Insurer excess payment", "Cancellation", "Reversal", "Endorsement", "Hold", "Hold release", "Previous-period adjustment", "Manual insurer adjustment", "Other"];
const transactionTypes = ["Commission", "Reversal", "Cancellation", "Endorsement", "Adjustment", "Hold", "Hold release", "Other"];

function id() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function blankRow(): Row { return { id: id(), policyNo: "", policyId: "", insurerName: "", customerName: "", vehicleNo: "", issuanceDate: "", projectedPayin: null, actualPayin: "", tds: "", adjustment: "", transactionType: "Commission", reason: "", reference: "", remarks: "", status: "draft" }; }
function numeric(value: string) { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function variance(row: Row) { if (row.projectedPayin === null || row.actualPayin === "") return null; return numeric(row.actualPayin) + numeric(row.adjustment) - row.projectedPayin; }
function money(value: number | null) { return value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }
function monthBounds() { const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth(), 1); const last = new Date(now.getFullYear(), now.getMonth() + 1, 0); const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; return { start: iso(first), end: iso(last) }; }
function fromMatch(match: ReconciliationPolicyMatch, current?: Row): Row { const row = current ?? blankRow(); return { ...row, policyNo: match.policyNo, policyId: match.policyId, insurerName: match.insurerName, customerName: match.customerName, vehicleNo: match.vehicleNo, issuanceDate: match.issuanceDate, projectedPayin: match.projectedPayin, status: row.actualPayin === "" ? "matched" : "ready" }; }

export function ReconciliationWorkspace({ insurers }: { insurers: InsurerOption[] }) {
  const bounds = useMemo(monthBounds, []);
  const [insurerId, setInsurerId] = useState("");
  const [periodStart, setPeriodStart] = useState(bounds.start);
  const [periodEnd, setPeriodEnd] = useState(bounds.end);
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
      const saved = JSON.parse(raw) as DraftState;
      if (saved?.rows?.length) { setInsurerId(saved.insurerId ?? ""); setPeriodStart(saved.periodStart ?? bounds.start); setPeriodEnd(saved.periodEnd ?? bounds.end); setReference(saved.reference ?? ""); setRows(saved.rows); }
    } catch {}
  }, [bounds.end, bounds.start]);

  useEffect(() => {
    const timer = window.setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ insurerId, periodStart, periodEnd, reference, rows } satisfies DraftState)); } catch {} }, 250);
    return () => window.clearTimeout(timer);
  }, [insurerId, periodStart, periodEnd, reference, rows]);

  const selectedInsurer = insurers.find((item) => item.id === insurerId);
  const activeRows = rows.filter((row) => row.policyNo.trim());
  const counts = useMemo(() => {
    let matched = 0, unmatched = 0, varianceCount = 0, ready = 0;
    for (const row of rows) {
      if (row.status === "unmatched") unmatched++;
      if (row.policyId) matched++;
      const diff = variance(row); if (diff !== null && Math.abs(diff) > 1) varianceCount++;
      if (row.actualPayin !== "") ready++;
    }
    return { total: rows.filter((row)=>row.policyNo.trim()).length, matched, unmatched, varianceCount, ready };
  }, [rows]);
  const canSubmit = Boolean(insurerId && activeRows.length && activeRows.every((row) => row.actualPayin !== "") && !isPending);

  function patch(rowId: string, values: Partial<Row>) { setRows((current) => current.map((row) => row.id === rowId ? { ...row, ...values } : row)); }
  function addRow() { setRows((current) => [...current, blankRow()]); }
  function removeRow(rowId: string) { setRows((current) => current.length === 1 ? [blankRow()] : current.filter((row) => row.id !== rowId)); }
  function clearDraft() { setRows([blankRow()]); setReference(""); setMessage("Draft cleared."); try { localStorage.removeItem(STORAGE_KEY); } catch {} }

  function matchRows(targetRows = rows) {
    const candidates = targetRows.filter((row) => row.policyNo.trim());
    if (!candidates.length) { setMessage("Enter at least one policy number."); return; }
    setMessage(null);
    startTransition(async () => {
      try {
        const results = await matchReconciliationPolicies(candidates.map((row) => row.policyNo), insurerId || undefined);
        const queues = new Map<string, typeof results>();
        for (const result of results) { const key = result.inputPolicyNo.trim().toUpperCase(); const list = queues.get(key) ?? []; list.push(result); queues.set(key, list); }
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
    startTransition(async () => {
      try {
        const matches = await loadExpectedReconciliationPolicies({ insurerId, periodStart, periodEnd });
        setRows(matches.length ? matches.map((match) => fromMatch(match)) : [blankRow()]);
        setMessage(matches.length ? `${matches.length} expected policies loaded.` : "No policies found for this insurer and period.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Policies could not be loaded."); }
    });
  }

  function importText(text: string) {
    const parsed = parseDelimited(text); if (!parsed.length) { setMessage("No usable rows found in the imported data."); return; }
    const next = parsed.map((values) => ({ ...blankRow(), policyNo: values.policyNo, actualPayin: values.actualPayin, tds: values.tds, adjustment: values.adjustment, transactionType: values.transactionType || "Commission", reason: values.reason, reference: values.reference, remarks: values.remarks }));
    setRows(next); setPasteText(""); setPasteOpen(false); setMessage(`${next.length} rows loaded. Match policies to continue.`);
    window.setTimeout(() => matchRows(next), 0);
  }

  async function onFile(file: File | undefined) { if (!file) return; const text = await file.text(); importText(text); if (fileRef.current) fileRef.current.value = ""; }
  function downloadTemplate() { const content = "Policy No,Actual Recognized Pay-in,TDS,Adjustment,Transaction Type,Reason,Insurer Reference,Remarks\n"; const blob = new Blob([content], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "INSUREIT_Reconciliation_Template.csv"; anchor.click(); URL.revokeObjectURL(url); }

  function submitCycle() {
    if (!canSubmit) { setMessage("Select an insurer and enter actual recognized pay-in for every reconciliation row."); return; }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await submitReconciliationCycle({ insurerId, periodStart, periodEnd, statementReference: reference, rows: activeRows.map((row) => ({ policyNo: row.policyNo, actualPayin: numeric(row.actualPayin), tds: numeric(row.tds), adjustment: numeric(row.adjustment), transactionType: row.transactionType, reason: row.reason, reference: row.reference, remarks: row.remarks })) });
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        window.location.href = `/reconciliation/${result.cycleId}`;
      } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation could not be submitted."); }
    });
  }

  return <div className="mx-auto max-w-[1680px] space-y-4 pb-10">
    <section className="overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm">
      <div className="flex flex-col gap-4 bg-[linear-gradient(135deg,#071D49,#17365D_62%,#315B9A)] px-5 py-5 text-white lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-white/60">Commercial controls</p><h1 className="mt-1 text-[20px] font-semibold">Pay-in Reconciliation</h1><p className="mt-1 max-w-3xl text-[10px] leading-5 text-white/70">Manual entry, Excel paste and the InsureIT template all create the same governed reconciliation cycle.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/reconciliation/history" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[9px] font-bold"><History className="h-3.5 w-3.5"/>History</Link><button onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[9px] font-bold"><Download className="h-3.5 w-3.5"/>Template</button><button onClick={()=>setPasteOpen((value)=>!value)} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-[9px] font-bold"><FileSpreadsheet className="h-3.5 w-3.5"/>Paste from Excel</button><button onClick={()=>fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[9px] font-bold text-[#17365D]"><Upload className="h-3.5 w-3.5"/>Import template</button><input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(event)=>void onFile(event.target.files?.[0])}/></div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <FieldLabel label="Insurer"><select className={inputClass} value={insurerId} onChange={(event)=>setInsurerId(event.target.value)}><option value="">Select insurer</option>{insurers.map((insurer)=><option key={insurer.id} value={insurer.id}>{insurer.name}</option>)}</select></FieldLabel>
        <FieldLabel label="Period from"><input type="date" className={inputClass} value={periodStart} onChange={(event)=>setPeriodStart(event.target.value)}/></FieldLabel>
        <FieldLabel label="Period to"><input type="date" className={inputClass} value={periodEnd} onChange={(event)=>setPeriodEnd(event.target.value)}/></FieldLabel>
        <FieldLabel label="Statement / batch reference"><input className={inputClass} value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="Optional reference"/></FieldLabel>
        <div className="flex items-end"><button onClick={loadExpected} disabled={isPending || !insurerId} className="h-10 w-full rounded-xl border border-[#b8c7da] bg-[#f7faff] px-3 text-[9px] font-bold text-[#17365D] disabled:opacity-50">Load expected policies</button></div>
      </div>
      {pasteOpen?<div className="border-t border-[#e6ebf2] bg-[#f8fafc] p-4"><div className="flex flex-col gap-3 lg:flex-row"><textarea className="min-h-28 flex-1 rounded-xl border border-[#cfd8e5] bg-white p-3 font-mono text-[10px] outline-none" value={pasteText} onChange={(event)=>setPasteText(event.target.value)} placeholder={"Paste columns from Excel here.\nPolicy No | Actual Pay-in | TDS | Adjustment | Transaction Type | Reason | Reference | Remarks"}/><div className="flex shrink-0 items-end gap-2"><button onClick={()=>{setPasteText("");setPasteOpen(false)}} className="rounded-xl border px-4 py-2 text-[9px] font-semibold">Cancel</button><button onClick={()=>importText(pasteText)} className="rounded-xl bg-[#17365D] px-4 py-2 text-[9px] font-bold text-white">Load rows</button></div></div></div>:null}
    </section>

    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Rows" value={counts.total}/><Metric label="Matched" value={counts.matched}/><Metric label="Unmatched" value={counts.unmatched} tone={counts.unmatched?"danger":undefined}/><Metric label="With variance" value={counts.varianceCount} tone={counts.varianceCount?"warn":undefined}/><Metric label="Actual entered" value={counts.ready}/></section>

    <section className="overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ebf2] bg-[#fbfcfe] px-4 py-3"><div><h2 className="text-[13px] font-semibold text-[#17365D]">Reconciliation grid</h2><p className="mt-0.5 text-[8.5px] text-[#667085]">Blank means not supplied. Zero is accepted as an intentional insurer value.</p></div><div className="flex gap-2"><button onClick={()=>matchRows()} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-[#b8c7da] px-3 py-2 text-[8.5px] font-bold text-[#17365D]"><Search className="h-3.5 w-3.5"/>Match policies</button><button onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg bg-[#17365D] px-3 py-2 text-[8.5px] font-bold text-white"><Plus className="h-3.5 w-3.5"/>Add row</button></div></div>
      <div className="overflow-x-auto"><table className="min-w-[1520px] w-full border-collapse text-[9px]"><thead className="sticky top-0 z-10 bg-[#f5f7fa] text-[#526277]"><tr>{["#","Policy No.","Customer / Vehicle","Projected","Actual recognized","TDS","Adjustment","Variance","Transaction","Reason","Reference","Remarks","Status",""].map((label)=><th key={label} className="border-b border-r border-[#e2e8f0] px-2 py-2 text-left font-bold uppercase tracking-[.04em]">{label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><GridRow key={row.id} row={row} index={index} patch={patch} remove={removeRow}/>)}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-[#e6ebf2] bg-[#fbfcfe] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-[9px] text-[#667085]">{message ?? `${selectedInsurer?.name ?? "No insurer selected"} · Draft auto-saved in this browser`}</div><div className="flex gap-2"><button onClick={clearDraft} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[8.5px] font-semibold"><RotateCcw className="h-3.5 w-3.5"/>Clear draft</button><button onClick={submitCycle} disabled={!canSubmit} className="rounded-lg bg-[#17365D] px-4 py-2 text-[8.5px] font-bold text-white disabled:bg-[#a9b4c4]">{isPending?"Submitting…":"Submit reconciliation"}</button></div></div>
    </section>
  </div>;
}

function GridRow({ row, index, patch, remove }: { row: Row; index: number; patch: (id: string, values: Partial<Row>) => void; remove: (id: string) => void }) {
  const diff = variance(row); const status = row.status === "unmatched" ? "Unmatched" : row.policyId ? (row.actualPayin === "" ? "Matched" : diff !== null && Math.abs(diff)>1 ? "Variance" : "Ready") : "Draft";
  const tone = status === "Unmatched" ? "bg-[#fff1f1] text-[#b42318]" : status === "Variance" ? "bg-[#fff8e6] text-[#9a6700]" : status === "Ready" ? "bg-[#ecf8f3] text-[#18794e]" : "bg-[#f2f4f7] text-[#667085]";
  const cell = "border-b border-r border-[#edf0f4] px-2 py-1.5 align-top";
  return <tr className="hover:bg-[#fbfdff]"><td className={`${cell} text-[#98a2b3]`}>{index+1}</td><td className={cell}><input className={gridInput} value={row.policyNo} onChange={(event)=>patch(row.id,{policyNo:event.target.value.toUpperCase(),policyId:"",status:"draft"})} placeholder="Policy no."/></td><td className={`${cell} min-w-44`}><div className="font-semibold text-[#26364f]">{row.customerName||"—"}</div><div className="mt-1 text-[8px] text-[#7a8798]">{row.vehicleNo||"—"}{row.issuanceDate?` · ${row.issuanceDate}`:""}</div></td><td className={`${cell} text-right font-semibold tabular-nums text-[#315B9A]`}>{money(row.projectedPayin)}</td><td className={cell}><input className={`${gridInput} text-right tabular-nums`} type="number" step="0.01" value={row.actualPayin} onChange={(event)=>patch(row.id,{actualPayin:event.target.value,status:row.policyId?"ready":row.status})} placeholder="0.00"/></td><td className={cell}><input className={`${gridInput} text-right tabular-nums`} type="number" step="0.01" min="0" value={row.tds} onChange={(event)=>patch(row.id,{tds:event.target.value})} placeholder="Optional"/></td><td className={cell}><input className={`${gridInput} text-right tabular-nums`} type="number" step="0.01" value={row.adjustment} onChange={(event)=>patch(row.id,{adjustment:event.target.value})} placeholder="0.00"/></td><td className={`${cell} text-right font-bold tabular-nums ${diff!==null&&diff< -1?"text-[#b42318]":diff!==null&&diff>1?"text-[#18794e]":"text-[#526277]"}`}>{money(diff)}</td><td className={cell}><select className={gridInput} value={row.transactionType} onChange={(event)=>patch(row.id,{transactionType:event.target.value})}>{transactionTypes.map((value)=><option key={value}>{value}</option>)}</select></td><td className={cell}><select className={gridInput} value={row.reason} onChange={(event)=>patch(row.id,{reason:event.target.value})}>{reasons.map((value)=><option key={value} value={value}>{value||"Select reason"}</option>)}</select></td><td className={cell}><input className={gridInput} value={row.reference} onChange={(event)=>patch(row.id,{reference:event.target.value})} placeholder="Voucher / ref"/></td><td className={cell}><input className={gridInput} value={row.remarks} onChange={(event)=>patch(row.id,{remarks:event.target.value})} placeholder="Optional"/></td><td className={cell}><span className={`inline-flex rounded-full px-2 py-1 text-[7.5px] font-bold ${tone}`}>{status}</span>{row.status==="unmatched"?<div className="mt-1 text-[7.5px] text-[#b42318]">Check policy / insurer</div>:null}</td><td className={cell}><button onClick={()=>remove(row.id)} className="rounded px-2 py-1 text-[11px] text-[#98a2b3] hover:bg-[#fff1f1] hover:text-[#b42318]" aria-label={`Remove row ${index+1}`}>×</button></td></tr>;
}

function parseDelimited(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").map((line)=>line.trimEnd()).filter((line)=>line.trim()); if (!lines.length) return [];
  const delimiter = lines.some((line)=>line.includes("\t")) ? "\t" : ","; const split = (line:string) => delimiter === "\t" ? line.split("\t") : parseCsvLine(line);
  const first = split(lines[0]).map((value)=>value.trim().toLowerCase()); const hasHeader = first.some((value)=>value.includes("policy") || value.includes("actual") || value.includes("recognized"));
  const indexes = { policy:0, actual:1, tds:2, adjustment:3, transaction:4, reason:5, reference:6, remarks:7 };
  if (hasHeader) { const find=(tests:string[])=>first.findIndex((value)=>tests.some((test)=>value.includes(test))); const mapped={policy:find(["policy"]),actual:find(["actual","recognized pay"]),tds:find(["tds"]),adjustment:find(["adjust"]),transaction:find(["transaction"]),reason:find(["reason","status"]),reference:find(["reference","voucher","ref"]),remarks:find(["remark","note"])}; Object.assign(indexes,Object.fromEntries(Object.entries(mapped).map(([key,value])=>[key,value<0?indexes[key as keyof typeof indexes]:value]))); }
  return lines.slice(hasHeader?1:0).map(split).filter((values)=>values.some((value)=>value.trim())).map((values)=>({policyNo:(values[indexes.policy]??"").trim(),actualPayin:(values[indexes.actual]??"").replace(/[,₹\s]/g,""),tds:(values[indexes.tds]??"").replace(/[,₹\s]/g,""),adjustment:(values[indexes.adjustment]??"").replace(/[,₹\s]/g,""),transactionType:(values[indexes.transaction]??"").trim(),reason:(values[indexes.reason]??"").trim(),reference:(values[indexes.reference]??"").trim(),remarks:(values[indexes.remarks]??"").trim()})).filter((row)=>row.policyNo);
}
function parseCsvLine(line:string){const values:string[]=[];let current="",quoted=false;for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(char===","&&!quoted){values.push(current);current="";}else current+=char;}values.push(current);return values;}

const inputClass="h-10 w-full rounded-xl border border-[#d5dde8] bg-white px-3 text-[10px] font-medium text-[#26364f] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#e5eef9]";
const gridInput="h-8 w-full min-w-24 rounded-lg border border-[#dce3ec] bg-white px-2 text-[9px] font-medium text-[#26364f] outline-none focus:border-[#315B9A] focus:ring-1 focus:ring-[#dce8fa]";
function FieldLabel({label,children}:{label:string;children:React.ReactNode}){return <label><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-[.055em] text-[#526277]">{label}</span>{children}</label>}
function Metric({label,value,tone}:{label:string;value:number;tone?:"warn"|"danger"}){const toneClass=tone==="danger"?"text-[#b42318]":tone==="warn"?"text-[#9a6700]":"text-[#17365D]";return <div className="rounded-xl border border-[#dfe5ed] bg-white px-4 py-3 shadow-sm"><div className="text-[8px] font-bold uppercase tracking-[.08em] text-[#7a8798]">{label}</div><div className={`mt-1 text-[18px] font-bold tabular-nums ${toneClass}`}>{value}</div></div>}
