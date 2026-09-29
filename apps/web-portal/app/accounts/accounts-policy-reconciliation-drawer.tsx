"use client";

import { useEffect, useState } from "react";
import { HandCoins, Loader2, Plus, ReceiptIndianRupee, X } from "lucide-react";
import {
  loadAccountsPolicyReconciliationDetailForRowAction,
  type AccountsPolicyReconciliationDetail,
  type AccountsPolicyReconciliationLookup,
} from "./accounts-reconciliation-detail-actions";
import { postAccountsDirectPayinAction, postAccountsDirectPayoutAction } from "./accounts-reconciliation-post-actions";

type Props = {
  lookup: AccountsPolicyReconciliationLookup | null;
  onClose: () => void;
  onPosted?: () => void | Promise<void>;
};

type EntryMode = "payin" | "payout" | null;

export function AccountsPolicyReconciliationDrawer({ lookup, onClose, onPosted }: Props) {
  const [detail, setDetail] = useState<AccountsPolicyReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<EntryMode>(null);
  const [saving, setSaving] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState(todayIndia());
  const [actualTds, setActualTds] = useState("");
  const [payinRemarks, setPayinRemarks] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState(todayIndia());
  const [reference, setReference] = useState("");
  const [payoutRemarks, setPayoutRemarks] = useState("");

  useEffect(() => {
    if (!lookup) {
      setDetail(null);
      setError("");
      setMode(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setError("");
    setMode(null);
    setEntryError("");

    void loadAccountsPolicyReconciliationDetailForRowAction(lookup)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error && reason.message ? reason.message : "Unable to load reconciliation history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lookup]);

  useEffect(() => {
    if (!lookup) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        if (mode) setMode(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lookup, mode, onClose, saving]);

  const openMode = (nextMode: Exclude<EntryMode, null>) => {
    setEntryError("");
    setMode(nextMode);
    if (nextMode === "payin") {
      setBillNumber("");
      setBillAmount("");
      setBillDate(todayIndia());
      setActualTds("");
      setPayinRemarks("");
    } else {
      setPaidAmount("");
      setPaidDate(todayIndia());
      setReference("");
      setPayoutRemarks("");
    }
  };

  const submitPayin = async () => {
    if (!lookup || !detail || saving) return;
    const amount = numeric(billAmount);
    const tds = numeric(actualTds);
    if (!billNumber.trim()) return setEntryError("Bill Number is required.");
    if (!billDate) return setEntryError("Choose a Bill Date.");
    if (amount <= 0) return setEntryError("Bill Amount must be greater than zero.");
    if (tds < 0 || tds > amount) return setEntryError("TDS must be between zero and the Bill Amount.");

    setSaving(true);
    setEntryError("");
    try {
      const updated = await postAccountsDirectPayinAction({
        lookup,
        billNumber: billNumber.trim(),
        billAmount: amount,
        billDate,
        actualTds: tds,
        remarks: payinRemarks.trim(),
      });
      setDetail(updated);
      setMode(null);
      await onPosted?.();
    } catch (reason: unknown) {
      setEntryError(reason instanceof Error && reason.message ? reason.message : "Pay-In could not be posted.");
    } finally {
      setSaving(false);
    }
  };

  const submitPayout = async () => {
    if (!lookup || !detail || saving) return;
    const amount = numeric(paidAmount);
    if (!paidDate) return setEntryError("Choose a Paid Date.");
    if (!reference.trim()) return setEntryError("UTR / reference is required.");
    if (amount <= 0) return setEntryError("Paid Amount must be greater than zero.");
    if (detail.payoutDifference > 0.01 && amount > detail.payoutDifference + 0.01) return setEntryError("Paid Amount exceeds the remaining payable balance.");

    setSaving(true);
    setEntryError("");
    try {
      const updated = await postAccountsDirectPayoutAction({
        lookup,
        paidAmount: amount,
        paidDate,
        reference: reference.trim(),
        remarks: payoutRemarks.trim(),
      });
      setDetail(updated);
      setMode(null);
      await onPosted?.();
    } catch (reason: unknown) {
      setEntryError(reason instanceof Error && reason.message ? reason.message : "Payout could not be posted.");
    } finally {
      setSaving(false);
    }
  };

  if (!lookup) return null;

  return <div className="fixed inset-0 z-[80] flex justify-end bg-[#14213c]/30 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label="Policy reconciliation" className="h-full w-full max-w-[660px] overflow-y-auto border-l border-[#dbe3ee] bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#e7edf4] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">Policy reconciliation</p>
          <h2 className="mt-0.5 truncate text-[14px] font-semibold text-[#17365D]">{detail?.policyNumber || lookup.policyNumber}</h2>
          <p className="mt-0.5 truncate text-[8px] font-medium text-[#7c899b]">{detail ? [detail.insuredName, detail.registrationNumber, detail.insurerName].filter(Boolean).join(" · ") : "Loading policy details…"}</p>
        </div>
        <button type="button" disabled={saving} onClick={onClose} title="Close reconciliation" aria-label="Close reconciliation" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#dce4ee] bg-white text-[#667085] transition hover:bg-[#f8fafc] hover:text-[#17365D] disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? <div className="grid min-h-[360px] place-items-center px-6 py-14 text-center">
        <div><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#17365D]" /><p className="mt-2 text-[9px] font-semibold text-[#667085]">Loading reconciliation history…</p></div>
      </div> : null}

      {!loading && error ? <div className="m-4 rounded-xl border border-[#f3c7c3] bg-[#fff5f4] px-4 py-3 text-[9px] font-semibold text-[#b42318]">{error}</div> : null}

      {!loading && !error && detail ? <div className="space-y-3 p-4">
        <section className="grid gap-2 sm:grid-cols-2">
          <ReconciliationSummaryCard
            icon={ReceiptIndianRupee}
            title="Pay-In"
            projected={detail.projectedPayin}
            actualLabel="Received"
            actual={detail.cumulativeBillAmount}
            remaining={detail.payinDifference}
            footnote={detail.tds ? `Projected TDS ${money(detail.tds)}` : undefined}
            actionLabel="Add Pay-In"
            onAction={() => openMode("payin")}
            active={mode === "payin"}
          />
          <ReconciliationSummaryCard
            icon={HandCoins}
            title="Payout"
            projected={detail.projectedPayout}
            actualLabel="Paid"
            actual={detail.cumulativePaidAmount}
            remaining={detail.payoutDifference}
            actionLabel="Add Payout"
            onAction={() => openMode("payout")}
            active={mode === "payout"}
            disabled={!detail.payoutId}
            disabledTitle={!detail.payoutId ? "A single eligible payout record is required for direct posting." : undefined}
          />
        </section>

        {mode === "payin" ? <EntryPanel title="Add Pay-In" onCancel={() => { setMode(null); setEntryError(""); }} onSave={() => void submitPayin()} saving={saving} error={entryError}>
          <div className="grid gap-2 sm:grid-cols-2">
            <EntryField label="Bill Number"><input value={billNumber} onChange={(event) => { setBillNumber(event.target.value); setEntryError(""); }} disabled={saving} autoFocus className={inputClass} placeholder="Enter bill number" /></EntryField>
            <EntryField label="Bill Date"><input type="date" value={billDate} onChange={(event) => { setBillDate(event.target.value); setEntryError(""); }} disabled={saving} className={inputClass} /></EntryField>
            <EntryField label="Bill Amount"><input inputMode="decimal" value={billAmount} onChange={(event) => { setBillAmount(event.target.value); setEntryError(""); }} disabled={saving} className={inputClass} placeholder="0.00" /></EntryField>
            <EntryField label="Actual TDS"><input inputMode="decimal" value={actualTds} onChange={(event) => { setActualTds(event.target.value); setEntryError(""); }} disabled={saving} className={inputClass} placeholder="0.00" /></EntryField>
          </div>
          <EntryField label="Remarks · optional"><input value={payinRemarks} onChange={(event) => setPayinRemarks(event.target.value)} disabled={saving} className={inputClass} placeholder="Optional reconciliation note" /></EntryField>
          <PreviewStrip projected={detail.projectedPayin} current={detail.cumulativeBillAmount} next={numeric(billAmount)} actualLabel="Already received" />
        </EntryPanel> : null}

        {mode === "payout" ? <EntryPanel title="Add Payout" onCancel={() => { setMode(null); setEntryError(""); }} onSave={() => void submitPayout()} saving={saving} error={entryError}>
          <div className="grid gap-2 sm:grid-cols-3">
            <EntryField label="Paid Amount"><input inputMode="decimal" value={paidAmount} onChange={(event) => { setPaidAmount(event.target.value); setEntryError(""); }} disabled={saving} autoFocus className={inputClass} placeholder="0.00" /></EntryField>
            <EntryField label="Paid Date"><input type="date" value={paidDate} onChange={(event) => { setPaidDate(event.target.value); setEntryError(""); }} disabled={saving} className={inputClass} /></EntryField>
            <EntryField label="UTR / Reference"><input value={reference} onChange={(event) => { setReference(event.target.value); setEntryError(""); }} disabled={saving} className={inputClass} placeholder="Enter UTR / reference" /></EntryField>
          </div>
          <EntryField label="Remarks · optional"><input value={payoutRemarks} onChange={(event) => setPayoutRemarks(event.target.value)} disabled={saving} className={inputClass} placeholder="Optional reconciliation note" /></EntryField>
          <PreviewStrip projected={detail.projectedPayout} current={detail.cumulativePaidAmount} next={numeric(paidAmount)} actualLabel="Already paid" />
        </EntryPanel> : null}

        <HistorySection title="Pay-In history" count={detail.payinHistory.length}>
          {detail.payinHistory.length ? <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc]"><tr><HistoryHead>Date</HistoryHead><HistoryHead>Bill no.</HistoryHead><HistoryHead right>Amount</HistoryHead><HistoryHead>Status</HistoryHead></tr></thead>
              <tbody>{detail.payinHistory.map((item) => <tr key={item.id} className="border-t border-[#edf1f5]">
                <HistoryCell>{date(item.billDate)}</HistoryCell>
                <HistoryCell strong>{item.billNumber || "—"}</HistoryCell>
                <HistoryCell right strong>{money(item.billAmount)}</HistoryCell>
                <HistoryCell><StatusPill label={item.status || "Posted"} /></HistoryCell>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyHistory label="No Pay-In entries have been posted for this policy." />}
        </HistorySection>

        <HistorySection title="Payout history" count={detail.payoutHistory.length}>
          {detail.payoutHistory.length ? <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc]"><tr><HistoryHead>Date</HistoryHead><HistoryHead>UTR / reference</HistoryHead><HistoryHead right>Amount</HistoryHead></tr></thead>
              <tbody>{detail.payoutHistory.map((item) => <tr key={item.id} className="border-t border-[#edf1f5]">
                <HistoryCell>{date(item.paidDate)}</HistoryCell>
                <HistoryCell strong>{item.reference || "—"}</HistoryCell>
                <HistoryCell right strong>{money(item.paidAmount)}</HistoryCell>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyHistory label="No Payout entries have been posted for this policy." />}
        </HistorySection>
      </div> : null}
    </aside>
  </div>;
}

function ReconciliationSummaryCard({ icon: Icon, title, projected, actualLabel, actual, remaining, footnote, actionLabel, onAction, active, disabled = false, disabledTitle }: { icon: typeof ReceiptIndianRupee; title: string; projected: number; actualLabel: string; actual: number; remaining: number; footnote?: string; actionLabel: string; onAction: () => void; active: boolean; disabled?: boolean; disabledTitle?: string }) {
  const status = reconciliationStatus(projected, actual);
  const remainingTone = remaining < -0.01 ? "text-[#b42318]" : remaining > 0.01 ? "text-[#9a6700]" : "text-[#0f766e]";
  return <article className={`rounded-xl border p-3 ${active ? "border-[#9fb4ca] bg-[#f7faff]" : "border-[#dbe3ee] bg-[#fbfcfe]"}`}>
    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span><div><p className="text-[9px] font-bold text-[#17365D]">{title}</p><p className="text-[7px] font-semibold text-[#7c899b]">{status}</p></div></div><span className={`text-[10px] font-bold tabular-nums ${remainingTone}`}>{money(remaining)} remaining</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e7edf4] pt-2.5"><Metric label="Projected" value={money(projected)} /><Metric label={actualLabel} value={money(actual)} /></div>
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className="min-w-0 truncate text-[7px] font-semibold text-[#7c899b]">{footnote || "Append-only transaction history"}</p>
      <button type="button" disabled={disabled} title={disabledTitle || actionLabel} onClick={onAction} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[#c9d6e4] bg-white px-2 text-[7.5px] font-bold text-[#17365D] transition hover:bg-[#f3f7fb] disabled:cursor-not-allowed disabled:opacity-45"><Plus className="h-3 w-3" />{actionLabel}</button>
    </div>
  </article>;
}

function EntryPanel({ title, children, onCancel, onSave, saving, error }: { title: string; children: React.ReactNode; onCancel: () => void; onSave: () => void; saving: boolean; error: string }) {
  return <section className="rounded-xl border border-[#b9cadc] bg-[#f8fbff] p-3 shadow-sm">
    <div className="flex items-center justify-between gap-2"><h3 className="text-[10px] font-semibold text-[#17365D]">{title}</h3><span className="text-[7px] font-semibold uppercase tracking-[.06em] text-[#7c899b]">New transaction</span></div>
    <div className="mt-2.5 space-y-2">{children}</div>
    {error ? <p className="mt-2 rounded-lg border border-[#f3c7c3] bg-[#fff5f4] px-2.5 py-2 text-[8px] font-semibold text-[#b42318]">{error}</p> : null}
    <div className="mt-3 flex justify-end gap-1.5 border-t border-[#e3eaf2] pt-2.5">
      <button type="button" disabled={saving} onClick={onCancel} className="h-8 rounded-lg border border-[#dce4ee] bg-white px-3 text-[8px] font-bold text-[#667085] hover:bg-[#f8fafc] disabled:opacity-50">Cancel</button>
      <button type="button" disabled={saving} onClick={onSave} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#17365D] px-3 text-[8px] font-bold text-white shadow-sm hover:bg-[#234b7a] disabled:cursor-wait disabled:opacity-60">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{saving ? "Posting…" : "Save transaction"}</button>
    </div>
  </section>;
}

function PreviewStrip({ projected, current, next, actualLabel }: { projected: number; current: number; next: number; actualLabel: string }) {
  const after = roundMoney(current + Math.max(0, next));
  const remaining = roundMoney(projected - after);
  const status = reconciliationStatus(projected, after);
  return <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-[#dde6ef] bg-white px-2.5 py-2 sm:grid-cols-4">
    <PreviewValue label="Projected" value={money(projected)} />
    <PreviewValue label={actualLabel} value={money(current)} />
    <PreviewValue label="After entry" value={money(after)} />
    <PreviewValue label={status} value={`${money(remaining)} remaining`} emphasis={remaining < -0.01 ? "danger" : remaining > 0.01 ? "warning" : "success"} />
  </div>;
}

function PreviewValue({ label, value, emphasis = "neutral" }: { label: string; value: string; emphasis?: "neutral" | "warning" | "success" | "danger" }) {
  const tone = emphasis === "danger" ? "text-[#b42318]" : emphasis === "warning" ? "text-[#9a6700]" : emphasis === "success" ? "text-[#0f766e]" : "text-[#344054]";
  return <div className="min-w-0"><p className="truncate text-[6.5px] font-black uppercase tracking-[.05em] text-[#98a2b3]">{label}</p><p className={`mt-0.5 truncate text-[8.5px] font-semibold tabular-nums ${tone}`} title={value}>{value}</p></div>;
}

function EntryField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[6.8px] font-black uppercase tracking-[.05em] text-[#7c899b]">{label}</span>{children}</label>;
}

const inputClass = "h-9 w-full rounded-lg border border-[#d8e1eb] bg-white px-2.5 text-[9px] font-semibold text-[#344054] outline-none transition placeholder:text-[#b0bac7] focus:border-[#17365D] disabled:bg-[#f5f7fa] disabled:text-[#98a2b3]";

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[6.8px] font-black uppercase tracking-[.06em] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-[11px] font-semibold tabular-nums text-[#344054]">{value}</p></div>;
}

function HistorySection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section><div className="mb-1.5 flex items-center justify-between"><h3 className="text-[10px] font-semibold text-[#17365D]">{title}</h3><span className="rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2 py-0.5 text-[7px] font-bold tabular-nums text-[#667085]">{count}</span></div>{children}</section>;
}

function HistoryHead({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-[6.8px] font-black uppercase tracking-[.05em] text-[#7c899b] ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function HistoryCell({ children, right = false, strong = false }: { children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return <td className={`px-3 py-2 text-[8px] text-[#475467] ${right ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold text-[#243b5a]" : "font-medium"}`}>{children}</td>;
}

function EmptyHistory({ label }: { label: string }) {
  return <div className="rounded-xl border border-dashed border-[#d8e1eb] bg-[#fafbfd] px-4 py-6 text-center text-[8px] font-medium text-[#98a2b3]">{label}</div>;
}

function StatusPill({ label }: { label: string }) {
  return <span className="inline-flex rounded-full border border-[#cfe5dc] bg-[#f0faf6] px-1.5 py-0.5 text-[6.8px] font-bold text-[#0f766e]">{label}</span>;
}

function reconciliationStatus(projected: number, actual: number) {
  if (projected <= 0.01) return actual > 0.01 ? "Variance" : "Not applicable";
  if (actual > projected + 0.01) return "Variance";
  if (Math.abs(actual - projected) <= 0.01) return "Reconciled";
  if (actual > 0.01) return "Partial";
  return "Pending";
}

function numeric(value: string) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function date(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(parsed);
}

function todayIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
