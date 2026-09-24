"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

type PeriodKey = "mtd" | "last_month" | "last_6_months" | "custom";

const OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "mtd", label: "MTD" },
  { key: "last_month", label: "Last Month" },
  { key: "last_6_months", label: "Last 6 Months" },
  { key: "custom", label: "Custom" },
];

export function ReportOverviewPeriodControl({
  period,
  fromDate,
  toDate,
}: {
  period: PeriodKey;
  fromDate: string;
  toDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const label = OPTIONS.find((option) => option.key === period)?.label ?? "MTD";

  function choose(next: PeriodKey) {
    setOpen(false);
    if (next === "custom") {
      setFrom(fromDate);
      setTo(toDate);
      setCustomOpen(true);
      return;
    }
    router.push(`/reports?period=${next}`);
  }

  function applyCustom() {
    if (!from || !to) return;
    const fromValue = from <= to ? from : to;
    const toValue = from <= to ? to : from;
    const params = new URLSearchParams({ period: "custom", from: fromValue, to: toValue });
    setCustomOpen(false);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <>
      <div className="ov-period" ref={rootRef}>
        <button
          type="button"
          className="ov-control"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{label}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {open ? (
          <div className="ov-period-menu" role="menu">
            {OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                className={`ov-period-option ${option.key === period ? "ov-period-option--active" : ""}`}
                onClick={() => choose(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {customOpen ? (
        <div className="ov-period-modal-backdrop" role="presentation" onMouseDown={() => setCustomOpen(false)}>
          <section
            className="ov-period-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-period-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="report-period-title">select the period for report</h2>
            <div className="ov-period-fields">
              <label>
                <span>From Date</span>
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </label>
              <label>
                <span>To Date</span>
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </label>
            </div>
            <div className="ov-period-modal-actions">
              <button type="button" className="ov-period-ok" disabled={!from || !to} onClick={applyCustom}>OK</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
