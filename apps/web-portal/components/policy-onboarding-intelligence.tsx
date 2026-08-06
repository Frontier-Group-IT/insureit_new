"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type AlertTone = "error" | "warning" | "info";
type AlertItem = { section: number; tone: AlertTone; text: string };
type SectionState = { label: string; missing: string[] };
type PanelState = {
  completion: number;
  ready: boolean;
  mandatoryRemaining: number;
  sections: SectionState[];
  alerts: AlertItem[];
  rcState: string;
  rcTone: "success" | "warning" | "neutral";
  netPremium: number;
  gst: number;
  grossPremium: number;
  projectedOd: number;
  projectedTp: number;
  scheme: number;
  totalPayin: number;
  tds: number;
  payinAfterTds: number;
  retention: number;
  partnerPayout: number;
  margin: number;
  marginPercent: number | null;
  marginTone: "neutral" | "healthy" | "warning" | "danger";
};

type Position = { left: number; width: number; top: number; maxHeight: number };

const SECTION_LABELS = ["Source", "Customer", "Premium", "Pay-in", "Payout"];
const SECTION_TITLES = [
  "Policy source & ownership",
  "Insured & vehicle identification",
  "Policy product, premium & validity",
  "Projected insurer pay-in",
  "Intermediary payout & settlement",
];
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function controlForLabel(root: ParentNode, labelText: string) {
  const labels = Array.from(root.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  return label?.parentElement?.querySelector("input,select,textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
}

function valueFor(root: ParentNode, labelText: string) {
  return normalize(controlForLabel(root, labelText)?.value);
}

function numberFor(root: ParentNode, labelText: string) {
  const parsed = Number(valueFor(root, labelText).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sectionElements(root: HTMLElement) {
  return SECTION_TITLES.map((title, index) => {
    const heading = Array.from(root.querySelectorAll("h2")).find((item) => item.textContent?.trim() === title);
    const section = heading?.closest("section") as HTMLElement | null;
    if (section) section.id = `policy-intelligence-section-${index}`;
    return section;
  });
}

function hideLegacySummary() {
  for (const node of Array.from(document.querySelectorAll("p"))) {
    if (node.textContent?.trim().toLowerCase() !== "live summary") continue;
    const card = node.closest("div.overflow-hidden") as HTMLElement | null;
    if (card) card.style.display = "none";
    const wrapper = card?.parentElement;
    if (wrapper instanceof HTMLElement && wrapper.classList.contains("fixed")) wrapper.style.display = "none";
  }
}

function calculate(root: HTMLElement): PanelState {
  const rm = valueFor(root, "RM name");
  const intermediaryType = valueFor(root, "Intermediary type");
  const leadSource = valueFor(root, "Lead source");
  const intermediaryCode = valueFor(root, "Intermediary code");
  const registration = valueFor(root, "Registration number");
  const insuredName = valueFor(root, "Insured name");
  const phone = valueFor(root, "Phone number").replace(/\D/g, "");
  const vehicleClass = valueFor(root, "Class of vehicle");
  const policyProduct = valueFor(root, "Policy product");
  const idv = valueFor(root, "IDV / Sum insured");
  const policyNumber = valueFor(root, "Policy number");
  const insurer = valueFor(root, "Insurance company");
  const validFrom = valueFor(root, "Valid from");
  const validUpto = valueFor(root, "Valid upto");
  const projectedOdPercent = valueFor(root, "Projected OD pay-in %");
  const projectedTpPercent = valueFor(root, "Projected TP pay-in %");
  const payoutOdPercent = valueFor(root, "Payout OD %");
  const payoutTpPercent = valueFor(root, "Payout TP %");

  const sourceMissing = [!rm && "Select RM", !intermediaryType && "Select intermediary type", !leadSource && "Select lead source", !intermediaryCode && "Resolve intermediary code"].filter(Boolean) as string[];
  const vehicleMissing = [!registration && "Enter registration number", !insuredName && "Enter insured name", phone.length !== 10 && "Enter valid mobile number", !vehicleClass && "Select vehicle class"].filter(Boolean) as string[];
  const premiumMissing = [!policyProduct && "Select policy product", !idv && "Enter IDV / sum insured", !policyNumber && "Enter policy number", !insurer && "Select insurance company", !validFrom && "Enter policy start date", !validUpto && "Enter policy end date"].filter(Boolean) as string[];
  const payinMissing = [!projectedOdPercent && "Enter projected OD pay-in", !projectedTpPercent && "Enter projected TP pay-in"].filter(Boolean) as string[];
  const payoutMissing = [!payoutOdPercent && "Enter payout OD rate", !payoutTpPercent && "Enter payout TP rate"].filter(Boolean) as string[];
  const sections = [sourceMissing, vehicleMissing, premiumMissing, payinMissing, payoutMissing].map((missing, index) => ({ label: SECTION_LABELS[index], missing }));

  const mandatoryTotal = 14;
  const mandatoryRemaining = sourceMissing.length + vehicleMissing.length + premiumMissing.length;
  const completion = Math.max(0, Math.min(100, Math.round(((mandatoryTotal - mandatoryRemaining) / mandatoryTotal) * 100)));

  const od = numberFor(root, "OD premium");
  const tp = numberFor(root, "Third party premium");
  const cpaOpted = valueFor(root, "CPA opted").toLowerCase() !== "no";
  const cpa = cpaOpted ? numberFor(root, "CPA amount") : 0;
  const netPremium = od + tp + cpa;
  const gst = vehicleClass === "GCV" ? ((od + cpa) * 0.18) + (tp * 0.05) : netPremium * 0.18;
  const grossPremium = netPremium + gst;
  const projectedOd = od * numberFor(root, "Projected OD pay-in %") / 100;
  const projectedTp = tp * numberFor(root, "Projected TP pay-in %") / 100;
  const scheme = numberFor(root, "Any insurer scheme");
  const totalPayin = projectedOd + projectedTp + scheme;
  const tds = totalPayin * 0.1;
  const payinAfterTds = totalPayin - tds;
  const retention = numberFor(root, "Retention");
  const payoutOd = od * numberFor(root, "Payout OD %") / 100;
  const payoutTp = tp * numberFor(root, "Payout TP %") / 100;
  const partnerPayout = Math.max(0, payoutOd + payoutTp - retention);
  const margin = payinAfterTds - partnerPayout;
  const marginPercent = payinAfterTds > 0 ? (margin / payinAfterTds) * 100 : null;
  const marginTone = marginPercent === null ? "neutral" : marginPercent < 5 ? "danger" : marginPercent < 15 ? "warning" : "healthy";

  const text = root.textContent ?? "";
  const rcState = text.includes("AuthBridge details applied") ? "RC verified" : text.includes("Fetching RC") ? "Checking RC" : registration ? "RC pending" : "RC waiting";
  const rcTone: PanelState["rcTone"] = rcState === "RC verified" ? "success" : rcState === "RC pending" ? "warning" : "neutral";
  const alerts: AlertItem[] = [];
  sections.forEach((section, index) => section.missing.slice(0, 1).forEach((item) => alerts.push({ section: index, tone: index < 3 ? "error" : "info", text: item })));
  if (validFrom && validUpto && validUpto < validFrom) alerts.unshift({ section: 2, tone: "error", text: "Policy end date is before start date" });
  if (registration && rcState !== "RC verified") alerts.push({ section: 1, tone: "warning", text: "RC verification pending" });
  if (grossPremium <= 0 && (policyProduct || policyNumber)) alerts.push({ section: 2, tone: "warning", text: "Gross premium is zero" });
  if (partnerPayout > payinAfterTds && partnerPayout > 0) alerts.unshift({ section: 4, tone: "error", text: "Payout exceeds pay-in" });

  return {
    completion,
    ready: mandatoryRemaining === 0 && !(validFrom && validUpto && validUpto < validFrom),
    mandatoryRemaining,
    sections,
    alerts,
    rcState,
    rcTone,
    netPremium,
    gst,
    grossPremium,
    projectedOd,
    projectedTp,
    scheme,
    totalPayin,
    tds,
    payinAfterTds,
    retention,
    partnerPayout,
    margin,
    marginPercent,
    marginTone,
  };
}

export function PolicyOnboardingIntelligence() {
  const [state, setState] = useState<PanelState | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    let root: HTMLElement | null = null;
    let aside: HTMLElement | null = null;
    let sourceSection: HTMLElement | null = null;
    let grid: HTMLElement | null = null;
    let frame = 0;

    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const heading = Array.from(document.querySelectorAll("h1")).find((item) => item.textContent?.trim() === "Policy Onboarding");
        root = heading?.closest(".mx-auto") as HTMLElement | null;
        if (!root) return;
        const sections = sectionElements(root);
        sourceSection = sections[0];
        aside = root.querySelector("aside") as HTMLElement | null;
        grid = aside?.parentElement as HTMLElement | null;
        hideLegacySummary();
        setState(calculate(root));

        if (window.innerWidth < 1280 || !aside || !sourceSection) {
          if (grid) grid.style.removeProperty("grid-template-columns");
          setPosition(null);
          return;
        }

        if (grid) grid.style.gridTemplateColumns = "minmax(0, 1fr) 390px";
        const rect = aside.getBoundingClientRect();
        const safeTop = 172;
        const actionBar = Array.from(document.querySelectorAll("div.fixed.bottom-0"))[0] as HTMLElement | undefined;
        const actionBarTop = actionBar?.getBoundingClientRect().top ?? window.innerHeight - 64;
        const top = Math.max(sourceSection.getBoundingClientRect().top, safeTop);
        const maxHeight = Math.max(420, actionBarTop - top - 12);
        setPosition({ left: rect.left, width: rect.width, top, maxHeight });
      });
    };

    const onInteraction = () => refresh();
    document.addEventListener("input", onInteraction, true);
    document.addEventListener("change", onInteraction, true);
    document.addEventListener("click", onInteraction, true);
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    const interval = window.setInterval(refresh, 700);
    refresh();

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener("input", onInteraction, true);
      document.removeEventListener("change", onInteraction, true);
      document.removeEventListener("click", onInteraction, true);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      if (grid) grid.style.removeProperty("grid-template-columns");
    };
  }, []);

  function navigate(index: number) {
    document.getElementById(`policy-intelligence-section-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!state || !position || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed z-30" style={{ left: position.left, width: position.width, top: position.top, maxHeight: position.maxHeight }}>
      <IntelligenceCard state={state} onNavigate={navigate} />
    </div>,
    document.body,
  );
}

function IntelligenceCard({ state, onNavigate }: { state: PanelState; onNavigate: (index: number) => void }) {
  const marginText = state.marginTone === "healthy" ? "text-emerald-700" : state.marginTone === "warning" ? "text-amber-700" : state.marginTone === "danger" ? "text-red-700" : "text-slate-500";
  const visibleAlerts = state.alerts.slice(0, 3);

  return <div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_14px_38px_rgba(15,23,42,.12)]">
    <div className="border-b bg-[linear-gradient(135deg,#F8FAFF,#EEF4FB)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[7.5px] font-bold uppercase tracking-[.14em] text-[#4F46E5]">Policy intelligence</p><h3 className="mt-0.5 text-[13px] font-bold text-[#102A4C]">Booking control centre</h3></div>
        <span className={`rounded-full px-2.5 py-1 text-[7.5px] font-bold ${state.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{state.ready ? "✓ Ready" : "● In progress"}</span>
      </div>
      <div className="mt-3 flex items-center gap-3"><strong className="text-[20px] text-[#17365D]">{state.completion}%</strong><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4F46E5,#14B8A6)]" style={{ width: `${state.completion}%` }} /></div><span className="text-[8px] font-semibold text-[#667085]">{state.mandatoryRemaining} left</span></div>
    </div>

    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-1 border-b border-[#E8EDF4] pb-3">
        {state.sections.map((section, index) => {
          const complete = section.missing.length === 0;
          return <button key={section.label} type="button" onClick={() => onNavigate(index)} className="group flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <span className={`grid h-6 w-6 place-items-center rounded-full border text-[8px] font-bold ${complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{complete ? "✓" : section.missing.length}</span>
            <span className="truncate text-[7.5px] font-semibold text-[#667085] group-hover:text-[#17365D]">{section.label}</span>
          </button>;
        })}
      </div>

      <div className="border-b border-[#E8EDF4] py-3">
        <div className="flex items-center justify-between"><p className="text-[7.5px] font-bold uppercase tracking-[.12em] text-[#52749E]">Attention</p><StatusPill value={state.rcState} tone={state.rcTone} /></div>
        <div className="mt-2 space-y-1.5">
          {visibleAlerts.length ? visibleAlerts.map((alert, index) => <button key={`${alert.text}-${index}`} type="button" onClick={() => onNavigate(alert.section)} className="flex w-full items-center gap-2 text-left"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${alert.tone === "error" ? "bg-red-500" : alert.tone === "warning" ? "bg-amber-500" : "bg-blue-500"}`} /><span className="truncate text-[8.5px] font-medium text-[#475467]">{alert.text}</span></button>) : <p className="text-[8.5px] font-semibold text-emerald-700">✓ No blocking items</p>}
          {state.alerts.length > visibleAlerts.length ? <p className="pl-3.5 text-[7.5px] text-[#98A2B3]">+{state.alerts.length - visibleAlerts.length} more</p> : null}
        </div>
      </div>

      <div className="pt-3">
        <p className="mb-1.5 text-[7.5px] font-bold uppercase tracking-[.12em] text-[#52749E]">Financial ledger</p>
        <LedgerRow label="Net premium" value={money.format(state.netPremium)} />
        <LedgerRow label="GST" value={money.format(state.gst)} muted />
        <LedgerRow label="Gross premium" value={money.format(state.grossPremium)} strong />
        <LedgerDivider />
        <LedgerRow label="Projected OD pay-in" value={money.format(state.projectedOd)} />
        <LedgerRow label="Projected TP pay-in" value={money.format(state.projectedTp)} />
        <LedgerRow label="Insurer scheme" value={money.format(state.scheme)} muted />
        <LedgerRow label="Total pay-in" value={money.format(state.totalPayin)} strong />
        <LedgerRow label="TDS" value={`− ${money.format(state.tds)}`} muted />
        <LedgerRow label="Pay-in after TDS" value={money.format(state.payinAfterTds)} strong />
        <LedgerDivider />
        <LedgerRow label="Retention" value={`− ${money.format(state.retention)}`} muted />
        <LedgerRow label="Partner payout" value={money.format(state.partnerPayout)} />
        <LedgerRow label="Indicative margin" value={money.format(state.margin)} valueClass={marginText} strong suffix={state.marginPercent === null ? "Waiting" : `${state.marginPercent.toFixed(1)}%`} />
      </div>
    </div>
  </div>;
}

function StatusPill({ value, tone }: { value: string; tone: "success" | "warning" | "neutral" }) {
  const classes = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-1 text-[7px] font-bold ${classes}`}>{value}</span>;
}

function LedgerRow({ label, value, muted, strong, valueClass = "", suffix }: { label: string; value: string; muted?: boolean; strong?: boolean; valueClass?: string; suffix?: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#F0F3F7] py-1.5 last:border-b-0"><span className={`text-[8.5px] ${muted ? "text-[#98A2B3]" : strong ? "font-bold text-[#344054]" : "text-[#667085]"}`}>{label}</span><span className="flex items-center gap-2"><span className={`text-[9px] ${strong ? "font-bold" : "font-semibold"} ${valueClass || "text-[#102A4C]"}`}>{value}</span>{suffix ? <span className={`min-w-[42px] text-right text-[7.5px] font-bold ${valueClass || "text-[#667085]"}`}>{suffix}</span> : null}</span></div>;
}

function LedgerDivider() {
  return <div className="my-1 border-t border-dashed border-[#D8E0EA]" />;
}
