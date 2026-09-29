"use client";

import { useEffect, useState } from "react";
import { HandCoins, Loader2, ReceiptIndianRupee, X } from "lucide-react";
import {
  loadAccountsPolicyReconciliationDetailForRowAction,
  type AccountsPolicyReconciliationDetail,
  type AccountsPolicyReconciliationLookup,
} from "./accounts-reconciliation-detail-actions";

type Props = {
  lookup: AccountsPolicyReconciliationLookup | null;
  onClose: () => void;
};

export function AccountsPolicyReconciliationDrawer({ lookup, onClose }: Props) {
  const [detail, setDetail] = useState<AccountsPolicyReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lookup) {
      setDetail(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setError("");

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
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [lookup, onClose]);

  if (!lookup) return null;

  return <div className="fixed inset-0 z-[80] flex justify-end bg-[#14213c]/30 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label="Policy reconciliation history" className="h-full w-full max-w-[620px] overflow-y-auto border-l border-[#dbe3ee] bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[#e7edf4] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">Policy reconciliation</p>
          <h2 className="mt-0.5 truncate text-[14px] font-semibold text-[#17365D]">{detail?.policyNumber || lookup.policyNumber}</h2>
          <p className="mt-0.5 truncate text-[8px] font-medium text-[#7c899b]">{detail ? [detail.insuredName, detail.registrationNumber, detail.insurerName].filter(Boolean).join(" · ") : "Loading policy details…"}</p>
        </div>
        <button type="button" onClick={onClose} title="Close reconciliation history" aria-label="Close reconciliation history" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#dce4ee] bg-white text-[#667085] transition hover:bg-[#f8fafc] hover:text-[#17365D]">
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
            footnote={detail.tds ? `TDS ${money(detail.tds)}` : undefined}
          />
          <ReconciliationSummaryCard
            icon={HandCoins}
            title="Payout"
            projected={detail.projectedPayout}
            actualLabel="Paid"
            actual={detail.cumulativePaidAmount}
            remaining={detail.payoutDifference}
          />
        </section>

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

        <div className="rounded-xl border border-dashed border-[#ccd7e5] bg-[#f8fafc] px-3 py-2 text-[8px] font-medium leading-4 text-[#667085]">
          This phase is read-only. Direct Add Pay-In and Add Payout will use the same policy history without overwriting earlier installments.
        </div>
      </div> : null}
    </aside>
  </div>;
}

function ReconciliationSummaryCard({ icon: Icon, title, projected, actualLabel, actual, remaining, footnote }: { icon: typeof ReceiptIndianRupee; title: string; projected: number; actualLabel: string; actual: number; remaining: number; footnote?: string }) {
  const status = reconciliationStatus(projected, actual);
  const remainingTone = remaining < -0.01 ? "text-[#b42318]" : remaining > 0.01 ? "text-[#9a6700]" : "text-[#0f766e]";
  return <article className="rounded-xl border border-[#dbe3ee] bg-[#fbfcfe] p-3">
    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span><div><p className="text-[9px] font-bold text-[#17365D]">{title}</p><p className="text-[7px] font-semibold text-[#7c899b]">{status}</p></div></div><span className={`text-[10px] font-bold tabular-nums ${remainingTone}`}>{money(remaining)} remaining</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#e7edf4] pt-2.5"><Metric label="Projected" value={money(projected)} /><Metric label={actualLabel} value={money(actual)} /></div>
    {footnote ? <p className="mt-2 text-[7px] font-semibold text-[#7c899b]">{footnote}</p> : null}
  </article>;
}

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

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function date(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(parsed);
}
