"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Filter, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { bulkSavePolicyCommercials, type CommercialSide, type CommercialStatus } from "@/app/policies/commercial-review/actions";

export type LedgerStatus = CommercialStatus | "not_entered";
export type CommercialReviewRow = {
  id: string;
  policyNo: string;
  insurerName: string;
  issuanceDate: string;
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

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const statusLabels: Record<LedgerStatus, string> = {
  not_entered: "Not entered",
  needs_review: "Needs review",
  entered: "Entered",
  reviewed: "Reviewed",
  not_applicable: "Not applicable",
};

export function CommercialReviewClient({ rows }: { rows: CommercialReviewRow[] }) {
  const [side, setSide] = useState<CommercialSide>("insurer");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [insurer, setInsurer] = useState("all");
  const [status, setStatus] = useState<LedgerStatus | "all">("all");
  const [od, setOd] = useState("");
  const [tp, setTp] = useState("");
  const [scheme, setScheme] = useState("");
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<CommercialStatus | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurerName))).sort(), [rows]);
  const counts = useMemo(() => {
    const key = side === "insurer" ? "insurerStatus" : "partnerStatus";
    return rows.reduce<Record<LedgerStatus, number>>((acc, row) => {
      acc[row[key]] += 1;
      return acc;
    }, { not_entered: 0, needs_review: 0, entered: 0, reviewed: 0, not_applicable: 0 });
  }, [rows, side]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const rowStatus = side === "insurer" ? row.insurerStatus : row.partnerStatus;
      if (status !== "all" && rowStatus !== status) return false;
      if (insurer !== "all" && row.insurerName !== insurer) return false;
      if (!normalizedQuery) return true;
      return [row.policyNo, row.insurerName, row.partnerCode ?? "", row.partnerType ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [rows, query, insurer, status, side]);

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(row.id));

  function switchSide(value: CommercialSide) {
    setSide(value);
    setSelected(new Set());
    setStatus("all");
    setMessage(null);
    setOd(""); setTp(""); setScheme(""); setNote(""); setNextStatus("");
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

  function apply() {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkSavePolicyCommercials({
        policyIds: Array.from(selected),
        side,
        odPercent: od,
        tpPercent: tp,
        schemeAmount: side === "insurer" ? scheme : undefined,
        status: nextStatus || undefined,
        note,
      });
      if (!result.ok) return setMessage(result.error);
      setMessage(`${result.updated} polic${result.updated === 1 ? "y" : "ies"} updated. Refresh to see the committed ledger state.`);
      setSelected(new Set());
      setOd(""); setTp(""); setScheme(""); setNote(""); setNextStatus("");
    });
  }

  const activeTotal = side === "insurer"
    ? filteredRows.reduce((sum, row) => sum + row.projectedTotal, 0)
    : filteredRows.reduce((sum, row) => sum + row.payoutTotal, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#D9E2F0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-[#D9E2F0] bg-[#F8FAFC] p-1">
            <TabButton active={side === "insurer"} onClick={() => switchSide("insurer")} icon={ShieldCheck}>Insurer Commercials</TabButton>
            <TabButton active={side === "partner"} onClick={() => switchSide("partner")} icon={UserRoundCheck}>Partner Commercials</TabButton>
          </div>
          <div className="text-[9px] text-[#667085]">{filteredRows.length.toLocaleString("en-IN")} visible · {money.format(activeTotal)}</div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatusCard label="Not entered" value={counts.not_entered} active={status === "not_entered"} onClick={() => setStatus(status === "not_entered" ? "all" : "not_entered")} tone="slate" />
          <StatusCard label="Needs review" value={counts.needs_review} active={status === "needs_review"} onClick={() => setStatus(status === "needs_review" ? "all" : "needs_review")} tone="amber" />
          <StatusCard label="Entered" value={counts.entered} active={status === "entered"} onClick={() => setStatus(status === "entered" ? "all" : "entered")} tone="blue" />
          <StatusCard label="Reviewed" value={counts.reviewed} active={status === "reviewed"} onClick={() => setStatus(status === "reviewed" ? "all" : "reviewed")} tone="green" />
          <StatusCard label="Not applicable" value={counts.not_applicable} active={status === "not_applicable"} onClick={() => setStatus(status === "not_applicable" ? "all" : "not_applicable")} tone="slate" />
        </div>
      </section>

      <section className="rounded-2xl border border-[#D9E2F0] bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_minmax(180px,.8fr)_minmax(180px,.8fr)_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[#98A2B3]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search policy, insurer or partner code" className="h-10 w-full rounded-xl border border-[#D8DEE9] pl-9 pr-3 text-[10px] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></label>
          <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="h-10 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[10px]"><option value="all">All insurers</option>{insurers.map((name) => <option key={name} value={name}>{name}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value as LedgerStatus | "all")} className="h-10 rounded-xl border border-[#D8DEE9] bg-white px-3 text-[10px]"><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="button" onClick={() => { setQuery(""); setInsurer("all"); setStatus("all"); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D8DEE9] px-4 text-[9px] font-bold text-[#526277]"><Filter className="h-3.5 w-3.5" />Clear filters</button>
        </div>
      </section>

      <section className="rounded-2xl border border-[#D9E2F0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-[12px] font-semibold text-[#17365D]">Bulk control action</h2><p className="mt-1 text-[9px] text-[#667085]">Blank numeric fields remain unchanged. Explicit 0 is valid. Marking Not applicable records that decision instead of treating zero as missing.</p></div>
          <span className="rounded-full bg-[#EEF3F8] px-3 py-1.5 text-[9px] font-bold text-[#315B6B]">{selected.size} selected</span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label={side === "insurer" ? "OD Brokerage %" : "OD Payout %"} value={od} onChange={setOd} />
          <Field label={side === "insurer" ? "TP/CPA Brokerage %" : "TP/CPA Payout %"} value={tp} onChange={setTp} />
          {side === "insurer" ? <Field label="Scheme / incentive" value={scheme} onChange={setScheme} amount /> : <div className="hidden xl:block" />}
          <label><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.055em] text-[#667085]">Set control status</span><select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as CommercialStatus | "")} className="h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[9.5px]"><option value="">Leave unchanged</option><option value="entered">Entered</option><option value="reviewed">Reviewed</option><option value="needs_review">Needs review</option><option value="not_applicable">Not applicable</option></select></label>
          <label><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.055em] text-[#667085]">Control note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / reference" className="h-10 w-full rounded-xl border border-[#D8DEE9] px-3 text-[9.5px]" /></label>
          <div className="flex items-end"><button type="button" disabled={!selected.size || isPending} onClick={apply} className="h-10 w-full rounded-xl bg-[#17365D] px-4 text-[9.5px] font-bold text-white disabled:opacity-40">{isPending ? "Saving…" : "Apply control"}</button></div>
        </div>
        {message ? <p className="mt-3 rounded-lg bg-[#F0F7F6] px-3 py-2 text-[9px] font-semibold text-[#21645F]">{message}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
        <div className="overflow-auto max-h-[68vh]">
          {side === "insurer" ? <InsurerLedger rows={filteredRows} selected={selected} toggle={toggle} allSelected={allFilteredSelected} toggleAll={toggleFiltered} /> : <PartnerLedger rows={filteredRows} selected={selected} toggle={toggle} allSelected={allFilteredSelected} toggleAll={toggleFiltered} />}
        </div>
        <div className="flex items-center justify-between border-t border-[#EDF0F4] px-4 py-2 text-[8.5px] text-[#7A8798]"><span>{filteredRows.length.toLocaleString("en-IN")} rows shown</span><span>Commercial state is explicit; zero values are not treated as missing.</span></div>
      </section>
    </div>
  );
}

function InsurerLedger({ rows, selected, toggle, allSelected, toggleAll }: LedgerProps) {
  return <table className="w-full min-w-[1320px] text-[9px]"><thead className="sticky top-0 z-20 bg-[#F8FAFC] text-[7.5px] font-black uppercase tracking-[.06em] text-[#7C899B]"><tr><SelectHead checked={allSelected} onChange={toggleAll} /><th className="sticky left-[42px] z-30 bg-[#F8FAFC] px-3 py-3 text-left">Policy</th><th className="px-3 py-3 text-left">Insurer</th><th className="px-3 py-3 text-left">Issued</th><th className="px-3 py-3 text-right">OD Premium</th><th className="px-3 py-3 text-right">TP/CPA</th><th className="px-3 py-3 text-right">OD %</th><th className="px-3 py-3 text-right">TP %</th><th className="px-3 py-3 text-right">Scheme</th><th className="px-3 py-3 text-right">Projected Brokerage</th><th className="px-3 py-3 text-left">Control Status</th><th className="px-3 py-3 text-left">Note / Last action</th><th className="px-3 py-3 text-center">Policy</th></tr></thead><tbody className="divide-y divide-[#EDF0F4]">{rows.map((row) => <tr key={row.id} className="hover:bg-[#FBFCFE]"><SelectCell row={row} checked={selected.has(row.id)} toggle={toggle} /><PolicyCell row={row} /><td className="px-3 py-3">{row.insurerName}</td><td className="px-3 py-3 whitespace-nowrap">{date(row.issuanceDate)}</td><MoneyCell value={row.odPremium} /><MoneyCell value={row.tpCpaPremium} /><PercentCell value={row.projectedOdPercent} /><PercentCell value={row.projectedTpPercent} /><MoneyCell value={row.schemeAmount} /><td className="px-3 py-3 text-right font-bold text-[#315B9A] tabular-nums">{money.format(row.projectedTotal)}</td><td className="px-3 py-3"><StatusBadge status={row.insurerStatus} /></td><AuditCell note={row.insurerNote} action={row.insurerLastAction} at={row.insurerLastActionAt ?? row.insurerUpdatedAt} /><OpenCell row={row} /></tr>)}</tbody></table>;
}

function PartnerLedger({ rows, selected, toggle, allSelected, toggleAll }: LedgerProps) {
  return <table className="w-full min-w-[1280px] text-[9px]"><thead className="sticky top-0 z-20 bg-[#F8FAFC] text-[7.5px] font-black uppercase tracking-[.06em] text-[#7C899B]"><tr><SelectHead checked={allSelected} onChange={toggleAll} /><th className="sticky left-[42px] z-30 bg-[#F8FAFC] px-3 py-3 text-left">Policy</th><th className="px-3 py-3 text-left">Insurer</th><th className="px-3 py-3 text-left">Partner</th><th className="px-3 py-3 text-right">OD Premium</th><th className="px-3 py-3 text-right">TP/CPA</th><th className="px-3 py-3 text-right">OD %</th><th className="px-3 py-3 text-right">TP %</th><th className="px-3 py-3 text-right">Agreed Payout</th><th className="px-3 py-3 text-left">Control Status</th><th className="px-3 py-3 text-left">Note / Last action</th><th className="px-3 py-3 text-center">Policy</th></tr></thead><tbody className="divide-y divide-[#EDF0F4]">{rows.map((row) => <tr key={row.id} className="hover:bg-[#FBFCFE]"><SelectCell row={row} checked={selected.has(row.id)} toggle={toggle} /><PolicyCell row={row} /><td className="px-3 py-3">{row.insurerName}</td><td className="px-3 py-3"><div className="font-semibold text-[#26364F]">{row.partnerCode || "—"}</div><div className="text-[7.5px] text-[#7A8798]">{row.partnerType || "No linked intermediary"}</div></td><MoneyCell value={row.odPremium} /><MoneyCell value={row.tpCpaPremium} /><PercentCell value={row.payoutOdPercent} /><PercentCell value={row.payoutTpPercent} /><td className="px-3 py-3 text-right font-bold text-[#5D4E9C] tabular-nums">{money.format(row.payoutTotal)}</td><td className="px-3 py-3"><StatusBadge status={row.partnerStatus} /></td><AuditCell note={row.partnerNote} action={row.partnerLastAction} at={row.partnerLastActionAt ?? row.partnerUpdatedAt} /><OpenCell row={row} /></tr>)}</tbody></table>;
}

type LedgerProps = { rows: CommercialReviewRow[]; selected: Set<string>; toggle: (id: string) => void; allSelected: boolean; toggleAll: () => void };
function SelectHead({ checked, onChange }: { checked: boolean; onChange: () => void }) { return <th className="sticky left-0 z-30 w-[42px] bg-[#F8FAFC] px-3 py-3 text-left"><input aria-label="Select visible policies" type="checkbox" checked={checked} onChange={onChange} /></th>; }
function SelectCell({ row, checked, toggle }: { row: CommercialReviewRow; checked: boolean; toggle: (id: string) => void }) { return <td className="sticky left-0 z-10 bg-white px-3 py-3"><input aria-label={`Select ${row.policyNo}`} type="checkbox" checked={checked} onChange={() => toggle(row.id)} /></td>; }
function PolicyCell({ row }: { row: CommercialReviewRow }) { return <td className="sticky left-[42px] z-10 bg-white px-3 py-3"><div className="font-bold text-[#1E2D49]">{row.policyNo}</div><div className="text-[7.5px] text-[#98A2B3]">{date(row.issuanceDate)}</div></td>; }
function MoneyCell({ value }: { value: number }) { return <td className="px-3 py-3 text-right tabular-nums">{money.format(value)}</td>; }
function PercentCell({ value }: { value: number }) { return <td className="px-3 py-3 text-right font-semibold tabular-nums">{value.toFixed(2)}%</td>; }
function AuditCell({ note, action, at }: { note: string; action: string | null; at: string | null }) { return <td className="max-w-[240px] px-3 py-3"><div className="truncate font-medium text-[#475467]" title={note}>{note || "—"}</div><div className="mt-0.5 text-[7.5px] text-[#98A2B3]">{action ? action.replaceAll("_", " ") : "No control event"}{at ? ` · ${dateTime(at)}` : ""}</div></td>; }
function OpenCell({ row }: { row: CommercialReviewRow }) { return <td className="px-3 py-3 text-center"><Link href={`/policies/${row.id}/edit`} className="rounded-lg border border-[#D8E2EF] px-2.5 py-1.5 text-[8px] font-bold text-[#315B9A]">Open</Link></td>; }

function StatusBadge({ status }: { status: LedgerStatus }) {
  const styles: Record<LedgerStatus, string> = { not_entered: "bg-[#F2F4F7] text-[#667085]", needs_review: "bg-[#FFF4D8] text-[#A96A00]", entered: "bg-[#EAF2FF] text-[#315B9A]", reviewed: "bg-[#E8F7EF] text-[#137A4A]", not_applicable: "bg-[#F2F4F7] text-[#667085]" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[7.5px] font-bold ${styles[status]}`}>{statusLabels[status]}</span>;
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof CheckCircle2; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-bold ${active ? "bg-[#17365D] text-white shadow-sm" : "text-[#526277] hover:bg-white"}`}><Icon className="h-3.5 w-3.5" />{children}</button>; }
function StatusCard({ label, value, active, onClick, tone }: { label: string; value: number; active: boolean; onClick: () => void; tone: "slate" | "amber" | "blue" | "green" }) { const toneClass = { slate: "border-[#DDE3EA]", amber: "border-[#F0D59A]", blue: "border-[#BFD1EC]", green: "border-[#B9DFC8]" }[tone]; return <button type="button" onClick={onClick} className={`rounded-xl border bg-white px-3 py-3 text-left transition hover:-translate-y-0.5 ${toneClass} ${active ? "ring-2 ring-[#17365D]/20" : ""}`}><div className="text-[7.5px] font-black uppercase tracking-[.06em] text-[#7A8798]">{label}</div><div className="mt-1 text-[18px] font-semibold text-[#17365D]">{value.toLocaleString("en-IN")}</div></button>; }
function Field({ label, value, onChange, amount = false }: { label: string; value: string; onChange: (value: string) => void; amount?: boolean }) { return <label><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[.055em] text-[#667085]">{label}</span><input type="number" min="0" max={amount ? undefined : "100"} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder={amount ? "₹ 0.00" : "0.00"} className="h-10 w-full rounded-xl border border-[#D8DEE9] px-3 text-[9.5px] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></label>; }
function date(value: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-IN"); }
function dateTime(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
