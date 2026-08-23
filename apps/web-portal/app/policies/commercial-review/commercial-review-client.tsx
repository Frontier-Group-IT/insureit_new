"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { bulkSavePolicyCommercials } from "@/app/policies/commercial-review/actions";

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
  payoutOdPercent: number;
  payoutTpPercent: number;
  projectedTotal: number;
  payoutTotal: number;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function CommercialReviewClient({ rows }: { rows: CommercialReviewRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"payin" | "payout">("payin");
  const [od, setOd] = useState("");
  const [tp, setTp] = useState("");
  const [scheme, setScheme] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function apply() {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkSavePolicyCommercials({
        policyIds: Array.from(selected),
        projectedOdPercent: mode === "payin" ? od : undefined,
        projectedTpPercent: mode === "payin" ? tp : undefined,
        schemeAmount: mode === "payin" ? scheme : undefined,
        payoutOdPercent: mode === "payout" ? od : undefined,
        payoutTpPercent: mode === "payout" ? tp : undefined,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`${result.updated} polic${result.updated === 1 ? "y" : "ies"} updated.`);
      setSelected(new Set());
      setOd("");
      setTp("");
      setScheme("");
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#D9E2F0] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[#17365D]">Bulk commercial update</h2>
            <p className="mt-1 text-[9.5px] leading-4 text-[#667085]">Blank fields are left unchanged. Entering 0 explicitly writes 0%, which is valid.</p>
          </div>
          <div className="rounded-full bg-[#F2F4F7] px-3 py-1.5 text-[9px] font-bold text-[#475467]">{selected.size} selected</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("payin")} className={`rounded-lg px-3 py-2 text-[9px] font-bold ${mode === "payin" ? "bg-[#17365D] text-white" : "border border-[#D9E2F0] text-[#526277]"}`}>Projected Pay-in</button>
          <button type="button" onClick={() => setMode("payout")} className={`rounded-lg px-3 py-2 text-[9px] font-bold ${mode === "payout" ? "bg-[#17365D] text-white" : "border border-[#D9E2F0] text-[#526277]"}`}>Partner Payout</button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Field label={mode === "payin" ? "OD Pay-in %" : "OD Payout %"} value={od} onChange={setOd} />
          <Field label={mode === "payin" ? "TP/CPA Pay-in %" : "TP/CPA Payout %"} value={tp} onChange={setTp} />
          {mode === "payin" ? <Field label="Scheme amount" value={scheme} onChange={setScheme} amount /> : null}
          <div className="flex items-end">
            <button type="button" disabled={!selected.size || isPending} onClick={apply} className="h-10 w-full rounded-xl bg-[#17365D] px-4 text-[10px] font-bold text-white disabled:opacity-40">{isPending ? "Applying…" : "Apply to selected"}</button>
          </div>
        </div>
        {message ? <p className="mt-3 text-[9.5px] font-semibold text-[#315B6B]">{message}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[9.5px]">
            <thead className="bg-[#F8FAFC] text-[8px] font-black uppercase tracking-[.06em] text-[#7C899B]">
              <tr>
                <th className="px-4 py-3 text-left"><input aria-label="Select all policies" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))} /></th>
                <th className="px-3 py-3 text-left">Policy</th>
                <th className="px-3 py-3 text-left">Insurer</th>
                <th className="px-3 py-3 text-left">Issued</th>
                <th className="px-3 py-3 text-right">OD Premium</th>
                <th className="px-3 py-3 text-right">TP/CPA</th>
                <th className="px-3 py-3 text-right">Pay-in OD%</th>
                <th className="px-3 py-3 text-right">Pay-in TP%</th>
                <th className="px-3 py-3 text-right">Projected Total</th>
                <th className="px-3 py-3 text-right">Payout OD%</th>
                <th className="px-3 py-3 text-right">Payout TP%</th>
                <th className="px-3 py-3 text-right">Payout</th>
                <th className="px-4 py-3 text-center">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF0F4]">
              {rows.map((row) => {
                const payinNeedsReview = row.projectedOdPercent === 0 && row.projectedTpPercent === 0 && row.schemeAmount === 0;
                const payoutNeedsReview = row.payoutOdPercent === 0 && row.payoutTpPercent === 0;
                return (
                  <tr key={row.id} className="hover:bg-[#FBFCFE]">
                    <td className="px-4 py-3"><input aria-label={`Select ${row.policyNo}`} type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
                    <td className="px-3 py-3"><div className="font-bold text-[#1E2D49]">{row.policyNo}</div><div className="mt-0.5 flex gap-1.5">{payinNeedsReview ? <Badge>Pay-in review</Badge> : null}{payoutNeedsReview ? <Badge>Payout review</Badge> : null}</div></td>
                    <td className="px-3 py-3">{row.insurerName}</td>
                    <td className="px-3 py-3">{row.issuanceDate || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money.format(row.odPremium)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money.format(row.tpCpaPremium)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.projectedOdPercent}%</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.projectedTpPercent}%</td>
                    <td className="px-3 py-3 text-right font-bold text-[#315B9A]">{money.format(row.projectedTotal)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.payoutOdPercent}%</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.payoutTpPercent}%</td>
                    <td className="px-3 py-3 text-right font-bold text-[#5D4E9C]">{money.format(row.payoutTotal)}</td>
                    <td className="px-4 py-3 text-center"><Link href={`/policies/${row.id}/edit`} className="rounded-lg border border-[#D8E2EF] px-2.5 py-1.5 text-[8.5px] font-bold text-[#315B9A]">Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length ? <div className="px-5 py-10 text-center text-[10px] text-[#7A8798]">No policy records found.</div> : null}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, amount = false }: { label: string; value: string; onChange: (value: string) => void; amount?: boolean }) {
  return <label><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-[.055em] text-[#667085]">{label}</span><input type="number" min="0" max={amount ? undefined : "100"} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} placeholder={amount ? "₹ 0.00" : "0.00"} className="h-10 w-full rounded-xl border border-[#D8DEE9] px-3 text-[10px] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" /></label>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#FFF4D8] px-1.5 py-0.5 text-[7px] font-bold text-[#A96A00]">{children}</span>;
}
