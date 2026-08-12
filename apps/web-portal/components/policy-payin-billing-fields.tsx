"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  billNumber: string;
  billedAmount: string;
  billDate: string;
  status: string;
  calculatedAmount: number;
  onBillNumberChange: (value: string) => void;
  onBilledAmountChange: (value: string) => void;
  onBillDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
};

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";

function normalizeMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function statusFor(amount: number, billNumber: string, billDate: string) {
  const hasNumber = Boolean(billNumber.trim());
  const hasDate = Boolean(billDate);
  if (!hasNumber && !hasDate) return "Unbilled";
  if (amount > 0 && hasNumber && hasDate) return "Billed";
  return "Billing details incomplete";
}

export function PolicyPayinBillingFields({
  billNumber,
  billedAmount,
  billDate,
  status,
  calculatedAmount,
  onBillNumberChange,
  onBilledAmountChange,
  onBillDateChange,
  onStatusChange,
}: Props) {
  const initialAmount = Number(billedAmount || 0);
  const [amountOverridden, setAmountOverridden] = useState(
    () => Boolean(billedAmount) && Math.abs(initialAmount - calculatedAmount) > 0.005,
  );

  useEffect(() => {
    if (amountOverridden) return;
    const next = normalizeMoney(calculatedAmount);
    if (billedAmount !== next) onBilledAmountChange(next);
  }, [amountOverridden, billedAmount, calculatedAmount, onBilledAmountChange]);

  const automaticStatus = useMemo(
    () => statusFor(Number(billedAmount || 0), billNumber, billDate),
    [billedAmount, billDate, billNumber],
  );

  useEffect(() => {
    if (status === "Received") return;
    if (status !== automaticStatus) onStatusChange(automaticStatus);
  }, [automaticStatus, onStatusChange, status]);

  function resetAmount() {
    setAmountOverridden(false);
    onBilledAmountChange(normalizeMoney(calculatedAmount));
  }

  const statusTone = status === "Received"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Billed"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : status === "Billing details incomplete"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className={labelClass}>PayIn Billed Amt Rs.</label>
          {amountOverridden ? (
            <button type="button" onClick={resetAmount} className="mb-1.5 text-[8px] font-semibold text-[#315B9A] hover:text-[#17365D]">
              Reset to calculated
            </button>
          ) : null}
        </div>
        <input
          className={inputClass}
          type="number"
          min="0"
          step="0.01"
          value={billedAmount}
          onChange={(event) => {
            setAmountOverridden(true);
            onBilledAmountChange(event.target.value);
          }}
          placeholder="₹ 0.00"
        />
        <p className="mt-1.5 px-0.5 text-[8.5px] text-[#7A8798]">
          Default: OD pay-in + TP pay-in + insurer scheme.
        </p>
      </div>

      <div>
        <label className={labelClass}>PayIn Bill No.</label>
        <input
          className={inputClass}
          value={billNumber}
          onChange={(event) => onBillNumberChange(event.target.value.toUpperCase())}
          placeholder="Bill / invoice number"
        />
      </div>

      <div>
        <label className={labelClass}>PayIn Bill Date</label>
        <input className={inputClass} type="date" value={billDate} onChange={(event) => onBillDateChange(event.target.value)} />
      </div>

      <div>
        <label className={labelClass}>PayIn Status</label>
        <div className={`flex h-10 items-center justify-between gap-2 rounded-xl border px-3 ${statusTone}`}>
          <span className="truncate text-[10px] font-bold">{status || "Unbilled"}</span>
          {status === "Billed" ? (
            <button
              type="button"
              onClick={() => onStatusChange("Received")}
              className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[8px] font-bold text-emerald-700 hover:bg-emerald-50"
            >
              Mark Received
            </button>
          ) : (
            <span className="shrink-0 text-[7.5px] font-semibold uppercase tracking-[.05em] opacity-70">
              {status === "Received" ? "Complete" : "Auto"}
            </span>
          )}
        </div>
        {status === "Received" ? <p className="mt-1.5 text-[8.5px] font-medium text-emerald-700">Pay-in receipt recorded.</p> : null}
      </div>
    </>
  );
}
