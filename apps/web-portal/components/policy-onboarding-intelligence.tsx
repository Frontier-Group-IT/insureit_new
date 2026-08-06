"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  rcTone: string;
  customerState: string;
  vehicleState: string;
  grossPremium: number;
  payinAfterTds: number;
  partnerPayout: number;
  margin: number;
  marginPercent: number | null;
  marginTone: "neutral" | "healthy" | "warning" | "danger";
};
type Position = { left: number; width: number; top: number; maxHeight: number };

const SECTION_LABELS = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout"];
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
    const fixedWrapper = card?.parentElement;
    if (fixedWrapper instanceof HTMLElement && fixedWrapper.classList.contains("fixed")) fixedWrapper.style.display = "none";
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
  const net = od + tp + cpa;
  const gst = vehicleClass === "GCV" ? ((od + cpa) * 0.18) + (tp * 0.05) : net * 0.18;
  const grossPremium = net + gst;
  const projectedOd = od * numberFor(root, "Projected OD pay-in %") / 100;
  const projectedTp = tp * numberFor(root, "Projected TP pay-in %") / 100;
  const scheme = numberFor(root, "Any insurer scheme");
  const totalPayin = projectedOd + projectedTp + scheme;
  const payinAfterTds = totalPayin - totalPayin * 0.1;
  const retention = numberFor(root, "Retention");
  const payoutOd = od * numberFor(root, "Payout OD %") / 100;
  const payoutTp = tp * numberFor(root, "Payout TP %") / 100;
  const partnerPayout = Math.max(0, payoutOd + payoutTp - retention);
  const margin = payinAfterTds - partnerPayout;
  const marginPercent = payinAfterTds > 0 ? (margin / payinAfterTds) * 100 : null;
  const marginTone = marginPercent === null ? "neutral" : marginPercent < 5 ? "danger" : marginPercent < 15 ? "warning" : "healthy";

  const text = root.textContent ?? "";
  const rcState = text.includes("AuthBridge details applied") ? "RC verified" : text.includes("Fetching RC") ? "Checking RC…" : text.includes("Provider response opens") && registration ? "RC not checked" : "Waiting for registration";
  const rcTone = rcState === "RC verified" ? "success" : rcState === "RC not checked" ? "warning" : "neutral";
  const alerts: AlertItem[] = [];
  sections.forEach((section, index) => section.missing.slice(0, 2).forEach((item) => alerts.push({ section: index, tone: index < 3 ? "error" : "info", text: item })));
  if (validFrom && validUpto && validUpto < validFrom) alerts.unshift({ section: 2, tone: "error", text: "Policy end date is before the start date" });
  if (registration && rcState !== "RC verified") alerts.push({ section: 1, tone: "warning", text: "RC details have not been verified" });
  if (grossPremium <= 0 && (policyProduct || policyNumber)) alerts.push({ section: 2, tone: "warning", text: "Gross premium is currently zero" });
  if (partnerPayout > payinAfterTds && partnerPayout > 0) alerts.unshift({ section: 4, tone: "error", text: "Partner payout exceeds pay-in after TDS" });
  if (text.includes("Possible Customer Matches")) alerts.unshift({ section: 1, tone: "warning", text: "Customer match confirmation is required" });
  if (text.includes("Vehicle Ownership Conflict")) alerts.unshift({ section: 1, tone: "error", text: "Vehicle ownership conflict must be resolved" });

  return {
    completion,
    ready: mandatoryRemaining === 0 && !(validFrom && validUpto && validUpto < validFrom),
    mandatoryRemaining,
    sections,
    alerts,
    rcState,
    rcTone,
    customerState: insuredName && phone.length === 10 ? "Resolve on booking" : "Waiting for identity",
    vehicleState: registration ? "Resolve on booking" : "Waiting for registration",
    grossPremium,
    payinAfterTds,
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
        const top = Math.max(sourceSection.getBoundingClientRect().top, safeTop);
        setPosition({ left: rect.left, width: rect.width, top, maxHeight: Math.max(360, window.innerHeight - top - 72) });
      });
    };

    const onInteraction = () => refresh();
    document.addEventListener("input", onInteraction, true);
    document.addEventListener("change", onInteraction, true);
    document.addEventListener("click", onInteraction, true);
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    refresh();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("input", onInteraction, true);
      document.removeEventListener("change", onInteraction, true);
      document.removeEventListener("click", onInteraction, true);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      observer.disconnect();
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
  const marginClass = state.marginTone === "healthy" ? "bg-emerald-50 text-emerald-800" : state.marginTone === "warning" ? "bg-amber-50 text-amber-800" : state.marginTone === "danger" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-600";
  return <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_14px_38px_rgba(15,23,42,.12)]">
    <div className="shrink-0 border-b bg-[linear-gradient(135deg,#F8FAFF,#EEF4FB)] px-5 py-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#4F46E5]">Policy intelligence</p><h3 className="mt-1 text-[14px] font-bold text-[#102A4C]">Booking control centre</h3></div><span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${state.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{state.ready ? "Ready" : "In progress"}</span></div>
      <div className="mt-4 flex items-end justify-between"><div><p className="text-[9px] text-[#667085]">Mandatory completion</p><p className="mt-0.5 text-[22px] font-bold text-[#17365D]">{state.completion}%</p></div><p className="max-w-[175px] text-right text-[8.5px] leading-4 text-[#667085]">{state.ready ? "Core booking details are complete." : `${state.mandatoryRemaining} mandatory items remaining`}</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4F46E5,#14B8A6)] transition-all" style={{ width: `${state.completion}%` }} /></div>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <PanelBlock title="Workflow progress"><div className="space-y-1.5">{state.sections.map((section, index) => <button key={section.label} type="button" onClick={() => onNavigate(index)} className="flex w-full items-center justify-between rounded-xl border border-[#E6EBF2] bg-[#FBFCFE] px-3 py-2 text-left transition hover:border-[#AFC2DB] hover:bg-white"><span className="text-[9.5px] font-semibold text-[#344054]">{section.label}</span><span className={`rounded-full px-2 py-0.5 text-[7.5px] font-bold ${section.missing.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{section.missing.length ? `${section.missing.length} remaining` : "Complete"}</span></button>)}</div></PanelBlock>
      <PanelBlock title="Attention"><div className="space-y-2">{state.alerts.length ? state.alerts.slice(0, 5).map((alert, index) => <button key={`${alert.text}-${index}`} type="button" onClick={() => onNavigate(alert.section)} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left ${alert.tone === "error" ? "border-red-100 bg-red-50/70" : alert.tone === "warning" ? "border-amber-100 bg-amber-50/70" : "border-blue-100 bg-blue-50/70"}`}><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${alert.tone === "error" ? "bg-red-500" : alert.tone === "warning" ? "bg-amber-500" : "bg-blue-500"}`} /><span className="text-[8.5px] font-semibold leading-4 text-[#344054]">{alert.text}</span></button>) : <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-[9px] font-semibold text-emerald-700">No blocking attention items.</div>}</div></PanelBlock>
      <PanelBlock title="Verification & resolution"><div className="grid gap-2"><StatusLine label="RC verification" value={state.rcState} tone={state.rcTone} /><StatusLine label="Customer record" value={state.customerState} tone="neutral" /><StatusLine label="Vehicle record" value={state.vehicleState} tone="neutral" /></div></PanelBlock>
      <PanelBlock title="Financial outcome"><div className="grid grid-cols-2 gap-2"><MetricTile label="Gross premium" value={money.format(state.grossPremium)} /><MetricTile label="Pay-in after TDS" value={money.format(state.payinAfterTds)} /><MetricTile label="Partner payout" value={money.format(state.partnerPayout)} /><MetricTile label="Indicative margin" value={money.format(state.margin)} accent /></div><div className={`mt-3 rounded-xl px-3 py-2.5 ${marginClass}`}><div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.08em]">Margin health</span><span className="text-[10px] font-bold">{state.marginPercent === null ? "Waiting" : `${state.marginPercent.toFixed(1)}%`}</span></div><p className="mt-1 text-[8px] leading-3">{state.marginTone === "healthy" ? "Healthy indicative commercial margin." : state.marginTone === "warning" ? "Review payout before booking." : state.marginTone === "danger" ? "Commercial margin is critically low or negative." : "Enter pay-in details to calculate margin health."}</p></div></PanelBlock>
      <div className={`rounded-2xl border p-4 ${state.ready ? "border-emerald-200 bg-emerald-50" : "border-[#DCE5F0] bg-[#F8FAFD]"}`}><p className={`text-[9px] font-bold ${state.ready ? "text-emerald-800" : "text-[#17365D]"}`}>{state.ready ? "Ready for booking review" : "Booking readiness"}</p><p className="mt-1 text-[8.5px] leading-4 text-[#667085]">{state.ready ? "Mandatory details are complete. Review warnings and the financial outcome before booking." : "Complete the mandatory items above. Optional pay-in and payout guidance remains visible separately."}</p></div>
    </div>
  </div>;
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section><p className="mb-2 text-[8px] font-bold uppercase tracking-[.12em] text-[#52749E]">{title}</p>{children}</section>;
}
function StatusLine({ label, value, tone }: { label: string; value: string; tone: string }) {
  const toneClass = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600";
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E6EBF2] px-3 py-2.5"><span className="text-[8.5px] font-semibold text-[#667085]">{label}</span><span className={`rounded-full px-2 py-1 text-[7.5px] font-bold ${toneClass}`}>{value}</span></div>;
}
function MetricTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border px-3 py-2.5 ${accent ? "border-indigo-100 bg-indigo-50" : "border-[#E6EBF2] bg-[#FBFCFE]"}`}><p className="text-[7.5px] font-semibold text-[#667085]">{label}</p><p className={`mt-1 text-[10px] font-bold ${accent ? "text-indigo-700" : "text-[#102A4C]"}`}>{value}</p></div>;
}
