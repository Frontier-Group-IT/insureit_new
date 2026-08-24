"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  FilterX,
  History,
  Pencil,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Undo2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { bulkSavePolicyCommercials, type CommercialSide, type CommercialStatus } from "@/app/policies/commercial-review/actions";
import { savePolicyCommercialRow } from "@/app/policies/commercial-review/row-actions";

export type LedgerStatus = CommercialStatus | "not_entered";
export type CommercialReviewRow = {
  id: string;
  policyNo: string;
  insurerName: string;
  issuanceDate: string;
  intermediaryName: string;
  intermediaryType: string | null;
  intermediaryCode: string | null;
  odPremium: number;
  tpCpaPremium: number;
  projectedOdPercent: number;
  projectedTpPercent: number;
  schemeAmount: number;
  projectedTotal: number;
  insurerStatus: LedgerStatus;
  insurerNote: string;
  insurerReviewedAt: string | null;
  insurerUpdatedAt: string | null;
  insurerLastAction: string | null;
  insurerLastActionAt: string | null;
  payoutOdPercent: number;
  payoutTpPercent: number;
  payoutTotal: number;
  partnerStatus: LedgerStatus;
  partnerNote: string;
  partnerType: string | null;
  partnerCode: string | null;
  partnerReviewedAt: string | null;
  partnerUpdatedAt: string | null;
  partnerLastAction: string | null;
  partnerLastActionAt: string | null;
};

type BackfillFilter = "all" | "incomplete" | "complete" | "zero_od" | "zero_tp" | "zero_total";
type EditState = { od: string; tp: string; scheme: string; note: string };

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const statusLabels: Record<LedgerStatus, string> = {
  not_entered: "Not entered",
  needs_review: "Needs review",
  entered: "Entered",
  reviewed: "Reviewed",
  not_applicable: "Not applicable",
};
const incompleteStatuses = new Set<LedgerStatus>(["not_entered", "needs_review"]);

export function CommercialReviewClient({ rows }: { rows: CommercialReviewRow[] }) {
  const router = useRouter();
  const [side, setSide] = useState<CommercialSide>("insurer");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [insurer, setInsurer] = useState("all");
  const [intermediary, setIntermediary] = useState("all");
  const [intermediaryType, setIntermediaryType] = useState("all");
  const [status, setStatus] = useState<LedgerStatus | "all">("all");
  const [backfill, setBackfill] = useState<BackfillFilter>("incomplete");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ od: "", tp: "", scheme: "", note: "" });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<EditState>({ od: "", tp: "", scheme: "", note: "" });
  const [bulkStatus, setBulkStatus] = useState<CommercialStatus | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurerName))).sort(), [rows]);
  const intermediaries = useMemo(() => {
    const byCode = new Map<string, CommercialReviewRow>();
    for (const row of rows) if (row.intermediaryCode && !byCode.has(row.intermediaryCode)) byCode.set(row.intermediaryCode, row);
    return Array.from(byCode.values()).sort((a, b) => a.intermediaryName.localeCompare(b.intermediaryName));
  }, [rows]);
  const intermediaryTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.intermediaryType).filter((value): value is string => Boolean(value)))).sort(), [rows]);
  const statusKey = side === "insurer" ? "insurerStatus" : "partnerStatus";
  const counts = useMemo(() => rows.reduce<Record<LedgerStatus, number>>((acc, row) => {
    acc[row[statusKey]] += 1;
    return acc;
  }, { not_entered: 0, needs_review: 0, entered: 0, reviewed: 0, not_applicable: 0 }), [rows, statusKey]);
  const incompleteCount = counts.not_entered + counts.needs_review;
  const completeCount = rows.length - incompleteCount;

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = row[statusKey];
      const odValue = side === "insurer" ? row.projectedOdPercent : row.payoutOdPercent;
      const tpValue = side === "insurer" ? row.projectedTpPercent : row.payoutTpPercent;
      const totalValue = side === "insurer" ? row.projectedTotal : row.payoutTotal;
      if (status !== "all" && rowStatus !== status) return false;
      if (insurer !== "all" && row.insurerName !== insurer) return false;
      if (intermediary !== "all" && row.intermediaryCode !== intermediary) return false;
      if (intermediaryType !== "all" && row.intermediaryType !== intermediaryType) return false;
      if (backfill === "incomplete" && !incompleteStatuses.has(rowStatus)) return false;
      if (backfill === "complete" && incompleteStatuses.has(rowStatus)) return false;
      if (backfill === "zero_od" && odValue !== 0) return false;
      if (backfill === "zero_tp" && tpValue !== 0) return false;
      if (backfill === "zero_total" && totalValue !== 0) return false;
      if (dateFrom && row.issuanceDate < dateFrom) return false;
      if (dateTo && row.issuanceDate > dateTo) return false;
      if (!normalizedQuery) return true;
      return [row.policyNo, row.insurerName, row.intermediaryName, row.intermediaryCode ?? "", row.intermediaryType ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [rows, statusKey, status, insurer, intermediary, intermediaryType, backfill, dateFrom, dateTo, query, side]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id));
  const activeTotal = side === "insurer"
    ? filteredRows.reduce((sum, row) => sum + row.projectedTotal, 0)
    : filteredRows.reduce((sum, row) => sum + row.payoutTotal, 0);

  function switchSide(value: CommercialSide) {
    setSide(value);
    setSelected(new Set());
    setEditingId(null);
    setStatus("all");
    setBackfill("incomplete");
    setBulkOpen(false);
    setMessage(null);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredRows.forEach((row) => next.delete(row.id));
      else filteredRows.forEach((row) => next.add(row.id));
      return next;
    });
  }

  function beginEdit(row: CommercialReviewRow) {
    setEditingId(row.id);
    setEdit({
      od: String(side === "insurer" ? row.projectedOdPercent : row.payoutOdPercent),
      tp: String(side === "insurer" ? row.projectedTpPercent : row.payoutTpPercent),
      scheme: side === "insurer" ? String(row.schemeAmount) : "",
      note: side === "insurer" ? row.insurerNote : row.partnerNote,
    });
    setMessage(null);
  }

  function saveRow(row: CommercialReviewRow, moveNext = false) {
    startTransition(async () => {
      setMessage(null);
      const result = await savePolicyCommercialRow({ policyId: row.id, side, odPercent: edit.od, tpPercent: edit.tp, schemeAmount: edit.scheme, note: edit.note });
      if (!result.ok) return setMessage(result.error);
      const currentIndex = filteredRows.findIndex((item) => item.id === row.id);
      const nextRow = moveNext ? filteredRows.slice(currentIndex + 1).find((item) => incompleteStatuses.has(item[statusKey])) : undefined;
      if (nextRow) beginEdit(nextRow); else setEditingId(null);
      setMessage(`${row.policyNo} saved.`);
      router.refresh();
    });
  }

  function applyBulk(statusOverride?: CommercialStatus) {
    const policyIds = Array.from(selected);
    startTransition(async () => {
      setMessage(null);
      const result = await bulkSavePolicyCommercials({
        policyIds,
        side,
        odPercent: bulk.od,
        tpPercent: bulk.tp,
        schemeAmount: side === "insurer" ? bulk.scheme : undefined,
        status: statusOverride ?? (bulkStatus || undefined),
        note: bulk.note,
      });
      if (!result.ok) return setMessage(result.error);
      setMessage(`${result.updated} policies updated.`);
      setSelected(new Set());
      setBulk({ od: "", tp: "", scheme: "", note: "" });
      setBulkStatus("");
      setBulkOpen(false);
      router.refresh();
    });
  }

  function applyRowStatus(row: CommercialReviewRow, nextStatus: CommercialStatus) {
    startTransition(async () => {
      setMessage(null);
      const result = await bulkSavePolicyCommercials({ policyIds: [row.id], side, status: nextStatus });
      if (!result.ok) return setMessage(result.error);
      setMessage(`${row.policyNo} updated.`);
      if (editingId === row.id) setEditingId(null);
      router.refresh();
    });
  }

  function clearFilters() {
    setQuery(""); setInsurer("all"); setIntermediary("all"); setIntermediaryType("all"); setStatus("all"); setBackfill("all"); setDateFrom(""); setDateTo("");
  }

  const currentEditIndex = editingId ? filteredRows.findIndex((row) => row.id === editingId) : -1;
  const jumpEdit = (direction: -1 | 1) => {
    if (!filteredRows.length) return;
    let index = currentEditIndex >= 0 ? currentEditIndex + direction : direction > 0 ? 0 : filteredRows.length - 1;
    while (index >= 0 && index < filteredRows.length) {
      if (incompleteStatuses.has(filteredRows[index][statusKey])) return beginEdit(filteredRows[index]);
      index += direction;
    }
  };

  return <div className="space-y-2.5">
    <section className="rounded-2xl border border-[#D9E2F0] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[#D9E2F0] bg-[#F8FAFC] p-1">
          <TabButton active={side === "insurer"} onClick={() => switchSide("insurer")} icon={ShieldCheck}>Insurer Pay-In</TabButton>
          <TabButton active={side === "partner"} onClick={() => switchSide("partner")} icon={UserRoundCheck}>Partner Payout</TabButton>
        </div>
        <button type="button" onClick={() => setBackfill(backfill === "incomplete" ? "all" : "incomplete")} className={`rounded-lg border px-3 py-2 text-[8.5px] font-bold ${backfill === "incomplete" ? "border-[#D7A94B] bg-[#FFF7E6] text-[#9A6700]" : "border-[#D9E2F0] text-[#526277]"}`}>Incomplete {incompleteCount}</button>
        <button type="button" onClick={() => setBackfill(backfill === "complete" ? "all" : "complete")} className={`rounded-lg border px-3 py-2 text-[8.5px] font-bold ${backfill === "complete" ? "border-[#A7D7BE] bg-[#ECF8F1] text-[#137A4A]" : "border-[#D9E2F0] text-[#526277]"}`}>Complete {completeCount}</button>
        <div className="ml-auto flex items-center gap-1.5 text-[8.5px] text-[#667085]"><span>{filteredRows.length.toLocaleString("en-IN")} rows</span><span>·</span><span>{money.format(activeTotal)}</span></div>
      </div>
      <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(250px,1.2fr)_minmax(165px,.7fr)_minmax(210px,.85fr)_minmax(150px,.6fr)_minmax(170px,.7fr)_auto_auto]">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#98A2B3]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Policy / insurer / intermediary" className="h-9 w-full rounded-xl border border-[#D8DEE9] pl-9 pr-3 text-[9.5px] outline-none focus:border-[#315B9A]" /></label>
        <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="h-9 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9px]"><option value="all">All insurers</option>{insurers.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={intermediary} onChange={(e) => setIntermediary(e.target.value)} className="h-9 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9px]"><option value="all">All intermediaries</option>{intermediaries.map((row) => <option key={row.intermediaryCode ?? row.id} value={row.intermediaryCode ?? ""}>{row.intermediaryName} · {row.intermediaryCode}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value as LedgerStatus | "all")} className="h-9 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9px]"><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select value={backfill} onChange={(e) => setBackfill(e.target.value as BackfillFilter)} className="h-9 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9px]"><option value="all">All entries</option><option value="incomplete">Backfill incomplete</option><option value="complete">Complete</option><option value="zero_od">OD = 0%</option><option value="zero_tp">TP = 0%</option><option value="zero_total">Total = ₹0</option></select>
        <IconButton label="More filters" onClick={() => setShowMore((value) => !value)} active={showMore}><Settings2 className="h-4 w-4" /></IconButton>
        <IconButton label="Clear filters" onClick={clearFilters}><FilterX className="h-4 w-4" /></IconButton>
      </div>
      {showMore ? <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-[#F8FAFC] p-2">
        <DateField label="Issued from" value={dateFrom} onChange={setDateFrom} />
        <DateField label="Issued to" value={dateTo} onChange={setDateTo} />
        <label className="text-[7.5px] font-bold uppercase text-[#667085]">Intermediary type<select value={intermediaryType} onChange={(e) => setIntermediaryType(e.target.value)} className="ml-2 h-8 rounded-lg border border-[#D8DEE9] bg-white px-2 text-[8.5px]"><option value="all">All types</option>{intermediaryTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <StatusPills counts={counts} value={status} onChange={setStatus} />
      </div> : null}
    </section>

    {selected.size ? <section className="rounded-2xl border border-[#C9D8EA] bg-[#F8FBFF] px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#17365D] px-2.5 py-1 text-[8px] font-bold text-white">{selected.size} selected</span>
        <IconButton label="Edit selected" onClick={() => setBulkOpen((value) => !value)} active={bulkOpen}><Pencil className="h-4 w-4" /></IconButton>
        <IconButton label="Mark reviewed" onClick={() => applyBulk("reviewed")}><BadgeCheck className="h-4 w-4" /></IconButton>
        <IconButton label="Mark not applicable" onClick={() => applyBulk("not_applicable")}><CircleOff className="h-4 w-4" /></IconButton>
        <IconButton label="Clear selection" onClick={() => { setSelected(new Set()); setBulkOpen(false); }}><X className="h-4 w-4" /></IconButton>
      </div>
      {bulkOpen ? <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(120px,.65fr))_minmax(160px,.8fr)_minmax(180px,1fr)_auto]">
        <CompactInput label={side === "insurer" ? "OD Pay-In %" : "OD Payout %"} value={bulk.od} onChange={(value) => setBulk((state) => ({ ...state, od: value }))} />
        <CompactInput label={side === "insurer" ? "TP/CPA Pay-In %" : "TP/CPA Payout %"} value={bulk.tp} onChange={(value) => setBulk((state) => ({ ...state, tp: value }))} />
        {side === "insurer" ? <CompactInput label="Scheme" value={bulk.scheme} onChange={(value) => setBulk((state) => ({ ...state, scheme: value }))} amount /> : <div />}
        <label className="text-[7.5px] font-bold uppercase text-[#667085]">Status<select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as CommercialStatus | "")} className="mt-1 h-8 w-full rounded-lg border border-[#D8DEE9] bg-white px-2 text-[8.5px]"><option value="">Unchanged</option><option value="entered">Entered</option><option value="reviewed">Reviewed</option><option value="needs_review">Needs review</option><option value="not_applicable">Not applicable</option></select></label>
        <label className="text-[7.5px] font-bold uppercase text-[#667085]">Note<input value={bulk.note} onChange={(e) => setBulk((state) => ({ ...state, note: e.target.value }))} placeholder="Reason / reference" className="mt-1 h-8 w-full rounded-lg border border-[#D8DEE9] px-2 text-[8.5px]" /></label>
        <button disabled={isPending} onClick={() => applyBulk()} className="mt-4 h-8 rounded-lg bg-[#17365D] px-4 text-[8.5px] font-bold text-white disabled:opacity-40">Apply</button>
      </div> : null}
    </section> : null}

    {message ? <div className="rounded-xl border border-[#B8DDD0] bg-[#EFF9F5] px-3 py-2 text-[8.5px] font-semibold text-[#21645F]">{message}</div> : null}

    <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EDF0F4] px-3 py-2">
        <div className="text-[8.5px] font-semibold text-[#526277]">{side === "insurer" ? "Projected insurer pay-in" : "Actual agreed partner payout"}</div>
        <div className="flex items-center gap-1">
          <IconButton label="Previous incomplete" onClick={() => jumpEdit(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
          <span className="px-1 text-[8px] font-bold text-[#A96A00]">{incompleteCount} incomplete</span>
          <IconButton label="Next incomplete" onClick={() => jumpEdit(1)}><ChevronRight className="h-4 w-4" /></IconButton>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[1320px] text-[8.5px]">
          <thead className="sticky top-0 z-30 bg-[#F8FAFC] text-[7px] font-black uppercase tracking-[.05em] text-[#7C899B]"><tr>
            <SelectHead checked={allFilteredSelected} onChange={toggleFiltered} />
            <th className="sticky left-[38px] z-40 bg-[#F8FAFC] px-2 py-2 text-left">Policy</th>
            <th className="px-2 py-2 text-left">Insurer</th>
            <th className="px-2 py-2 text-left">Intermediary</th>
            <th className="px-2 py-2 text-left">Issued</th>
            <th className="px-2 py-2 text-right">OD Premium</th>
            <th className="px-2 py-2 text-right">TP/CPA</th>
            <th className="px-2 py-2 text-right">{side === "insurer" ? "OD Pay-In %" : "OD Payout %"}</th>
            <th className="px-2 py-2 text-right">{side === "insurer" ? "TP Pay-In %" : "TP Payout %"}</th>
            {side === "insurer" ? <th className="px-2 py-2 text-right">Scheme</th> : null}
            <th className="px-2 py-2 text-right">{side === "insurer" ? "Projected Pay-In" : "Agreed Payout"}</th>
            <th className="px-2 py-2 text-left">Status</th>
            <th className="sticky right-0 z-40 bg-[#F8FAFC] px-2 py-2 text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-[#EDF0F4]">{filteredRows.map((row) => {
            const isEditing = editingId === row.id;
            const rowStatus = row[statusKey];
            const od = side === "insurer" ? row.projectedOdPercent : row.payoutOdPercent;
            const tp = side === "insurer" ? row.projectedTpPercent : row.payoutTpPercent;
            const total = side === "insurer" ? row.projectedTotal : row.payoutTotal;
            const preview = isEditing ? calculatePreview(row, side, edit) : total;
            return <tr key={row.id} className={isEditing ? "bg-[#FFF9EC]" : "hover:bg-[#FBFCFE]"}>
              <td className="sticky left-0 z-10 bg-inherit px-2 py-2"><input aria-label={`Select ${row.policyNo}`} type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
              <td className="sticky left-[38px] z-10 bg-inherit px-2 py-2"><Link href={`/policies/${row.id}/edit`} className="font-bold text-[#1E2D49] hover:text-[#315B9A] hover:underline">{row.policyNo}</Link></td>
              <td className="max-w-[190px] px-2 py-2"><div className="truncate font-medium text-[#26364F]">{row.insurerName}</div></td>
              <td className="max-w-[190px] px-2 py-2"><div className="truncate font-semibold text-[#26364F]" title={row.intermediaryName}>{row.intermediaryName}</div><div className="truncate text-[7px] text-[#98A2B3]">{[row.intermediaryType, row.intermediaryCode].filter(Boolean).join(" · ") || "—"}</div></td>
              <td className="whitespace-nowrap px-2 py-2">{date(row.issuanceDate)}</td>
              <MoneyCell value={row.odPremium} /><MoneyCell value={row.tpCpaPremium} />
              <EditableNumber editing={isEditing} value={isEditing ? edit.od : od.toFixed(2)} onChange={(value) => setEdit((state) => ({ ...state, od: value }))} onEnter={() => saveRow(row, true)} suffix="%" />
              <EditableNumber editing={isEditing} value={isEditing ? edit.tp : tp.toFixed(2)} onChange={(value) => setEdit((state) => ({ ...state, tp: value }))} onEnter={() => saveRow(row, true)} suffix="%" />
              {side === "insurer" ? <EditableNumber editing={isEditing} value={isEditing ? edit.scheme : String(row.schemeAmount)} onChange={(value) => setEdit((state) => ({ ...state, scheme: value }))} onEnter={() => saveRow(row, true)} moneyValue /> : null}
              <td className="bg-[#FAFCFF] px-2 py-2 text-right font-bold text-[#315B9A] tabular-nums">{money.format(preview)}</td>
              <td className="px-2 py-2"><StatusBadge status={rowStatus} /></td>
              <td className="sticky right-0 z-10 bg-inherit px-2 py-2"><div className="flex justify-center gap-1">
                {isEditing ? <><IconButton label="Save" onClick={() => saveRow(row)} disabled={isPending}><Save className="h-3.5 w-3.5" /></IconButton><IconButton label="Undo" onClick={() => setEditingId(null)}><Undo2 className="h-3.5 w-3.5" /></IconButton></> : <IconButton label="Edit row" onClick={() => beginEdit(row)}><Pencil className="h-3.5 w-3.5" /></IconButton>}
                <IconButton label="Mark not applicable" onClick={() => applyRowStatus(row, "not_applicable")} disabled={isPending}><CircleOff className="h-3.5 w-3.5" /></IconButton>
                <button type="button" title={`${side === "insurer" ? row.insurerNote : row.partnerNote}\n${(side === "insurer" ? row.insurerLastAction : row.partnerLastAction) ?? "No history"}`} className="grid h-9 w-9 place-items-center rounded-xl border border-[#D8E2EF] text-[#667085]"><History className="h-3.5 w-3.5" /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-[#EDF0F4] px-3 py-1.5 text-[7.5px] text-[#7A8798]"><span>{filteredRows.length.toLocaleString("en-IN")} rows shown</span><span>Enter saves and moves to the next incomplete row · Tab moves across fields</span></div>
    </section>
  </div>;
}

function calculatePreview(row: CommercialReviewRow, side: CommercialSide, edit: EditState) {
  const od = Number(edit.od || 0);
  const tp = Number(edit.tp || 0);
  const scheme = side === "insurer" ? Number(edit.scheme || 0) : 0;
  return row.odPremium * od / 100 + row.tpCpaPremium * tp / 100 + scheme;
}

function EditableNumber({ editing, value, onChange, onEnter, suffix, moneyValue }: { editing: boolean; value: string | number; onChange: (value: string) => void; onEnter: () => void; suffix?: string; moneyValue?: boolean }) {
  if (!editing) return <td className="px-2 py-2 text-right font-semibold tabular-nums">{moneyValue ? money.format(Number(value)) : `${value}${suffix ?? ""}`}</td>;
  return <td className="px-1.5 py-1"><input type="number" min="0" max={suffix ? "100" : undefined} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} className="h-7 w-full min-w-[76px] rounded-md border border-[#D7A94B] bg-white px-2 text-right text-[8.5px] font-semibold outline-none focus:ring-2 focus:ring-[#F8DFA8]" /></td>;
}

function StatusPills({ counts, value, onChange }: { counts: Record<LedgerStatus, number>; value: LedgerStatus | "all"; onChange: (value: LedgerStatus | "all") => void }) {
  return <div className="flex flex-wrap gap-1">{(Object.keys(statusLabels) as LedgerStatus[]).map((item) => <button key={item} type="button" onClick={() => onChange(value === item ? "all" : item)} className={`rounded-full border px-2 py-1 text-[7.5px] font-bold ${value === item ? "border-[#315B9A] bg-[#EEF4FF] text-[#315B9A]" : "border-[#D8DEE9] bg-white text-[#667085]"}`}>{statusLabels[item]} {counts[item]}</button>)}</div>;
}
function SelectHead({ checked, onChange }: { checked: boolean; onChange: () => void }) { return <th className="sticky left-0 z-40 w-[38px] bg-[#F8FAFC] px-2 py-2 text-left"><input aria-label="Select visible policies" type="checkbox" checked={checked} onChange={onChange} /></th>; }
function MoneyCell({ value }: { value: number }) { return <td className="px-2 py-2 text-right tabular-nums">{money.format(value)}</td>; }
function StatusBadge({ status }: { status: LedgerStatus }) { const styles: Record<LedgerStatus, string> = { not_entered: "bg-[#F2F4F7] text-[#667085]", needs_review: "bg-[#FFF4D8] text-[#A96A00]", entered: "bg-[#EAF2FF] text-[#315B9A]", reviewed: "bg-[#E8F7EF] text-[#137A4A]", not_applicable: "bg-[#F2F4F7] text-[#667085]" }; return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[7px] font-bold ${styles[status]}`}>{statusLabels[status]}</span>; }
function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: ReactNode }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[8.5px] font-bold ${active ? "bg-[#17365D] text-white shadow-sm" : "text-[#526277] hover:bg-white"}`}><Icon className="h-3.5 w-3.5" />{children}</button>; }
function IconButton({ label, onClick, children, active = false, disabled = false }: { label: string; onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean }) { return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-xl border transition disabled:opacity-40 ${active ? "border-[#315B9A] bg-[#EEF4FF] text-[#315B9A]" : "border-[#D8DEE9] bg-white text-[#526277] hover:bg-[#F8FAFC]"}`}>{children}</button>; }
function CompactInput({ label, value, onChange, amount = false }: { label: string; value: string; onChange: (value: string) => void; amount?: boolean }) { return <label className="text-[7.5px] font-bold uppercase text-[#667085]">{label}<input type="number" min="0" max={amount ? undefined : "100"} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className="mt-1 h-8 w-full rounded-lg border border-[#D8DEE9] px-2 text-[8.5px]" /></label>; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-[7.5px] font-bold uppercase text-[#667085]">{label}<input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="ml-2 h-8 rounded-lg border border-[#D8DEE9] bg-white px-2 text-[8.5px]" /></label>; }
function date(value: string | null) { if (!value) return "—"; const parsed = new Date(`${value.slice(0, 10)}T00:00:00`); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-IN"); }
