from pathlib import Path
import re

path = Path("apps/web-portal/components/policy-form-authbridge.tsx")
text = path.read_text(encoding="utf-8")

text = text.replace(
    'const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout", "Review"];',
    'const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout"];\nconst sectionIds = ["policy-source", "policy-customer-vehicle", "policy-premium", "policy-payin", "policy-payout"];'
)

marker = '  const vehicleMeta = vehicleClassMap[form.vehicleClass];\n  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP" ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"] : ["Package", "Third Party", "SAOD"];\n'
replacement = '''  const vehicleMeta = vehicleClassMap[form.vehicleClass];
  const policyProducts = form.vehicleClass === "PCP" || form.vehicleClass === "TWP" ? ["Package", "Third Party", "SAOD", "Bundled", "Long Term Package", "Long Term Third Party"] : ["Package", "Third Party", "SAOD"];

  const workflow = useMemo(() => {
    const sourceMissing = [!form.rmName && "Select RM", !form.intermediaryType && "Select intermediary type", !form.leadSource && "Select lead source", !form.intermediaryCode && "Resolve intermediary code"].filter(Boolean) as string[];
    const vehicleMissing = [!form.registrationNo && "Enter registration number", !form.insuredName && "Enter insured name", form.phoneNo.length !== 10 && "Enter valid mobile number", !form.vehicleClass && "Select vehicle class"].filter(Boolean) as string[];
    const premiumMissing = [!form.policyProduct && "Select policy product", !form.idv && "Enter IDV / sum insured", !form.policyNo && "Enter policy number", !form.insurerId && "Select insurance company", !form.validFrom && "Enter policy start date", !form.validUpto && "Enter policy end date"].filter(Boolean) as string[];
    const payinMissing = [!form.projectedOdPercent && "Enter projected OD pay-in", !form.projectedTpPercent && "Enter projected TP pay-in"].filter(Boolean) as string[];
    const payoutMissing = [!form.payoutOdPercent && "Enter payout OD rate", form.payoutBasis !== "OD" && !form.payoutTpPercent && "Enter payout TP rate"].filter(Boolean) as string[];
    const groups = [sourceMissing, vehicleMissing, premiumMissing, payinMissing, payoutMissing];
    const requiredTotal = 4 + 4 + 6;
    const requiredComplete = requiredTotal - sourceMissing.length - vehicleMissing.length - premiumMissing.length;
    return {
      groups,
      completion: Math.max(0, Math.min(100, Math.round((requiredComplete / requiredTotal) * 100))),
      ready: sourceMissing.length === 0 && vehicleMissing.length === 0 && premiumMissing.length === 0,
    };
  }, [form]);

  const intelligenceAlerts = useMemo(() => {
    const alerts: Array<{ section: number; tone: "error" | "warning" | "info"; text: string }> = [];
    workflow.groups.forEach((missing, section) => missing.slice(0, 2).forEach((text) => alerts.push({ section, tone: section < 3 ? "error" : "info", text })));
    if (form.validFrom && form.validUpto && form.validUpto < form.validFrom) alerts.unshift({ section: 2, tone: "error", text: "Policy end date is before the start date" });
    if (form.registrationNo && !appliedRc && !isLookingUp) alerts.push({ section: 1, tone: "warning", text: "RC details have not been verified" });
    if (lookupError) alerts.unshift({ section: 1, tone: "warning", text: "RC verification needs attention" });
    if (calculations.gross <= 0 && (form.policyProduct || form.policyNo)) alerts.push({ section: 2, tone: "warning", text: "Gross premium is currently zero" });
    if (calculations.grossPayout > calculations.payinAfterTds && calculations.grossPayout > 0) alerts.unshift({ section: 4, tone: "error", text: "Partner payout exceeds pay-in after TDS" });
    if (customerCandidates) alerts.unshift({ section: 1, tone: "warning", text: "Customer match confirmation is required" });
    if (ownershipConflict) alerts.unshift({ section: 1, tone: "error", text: "Vehicle ownership conflict must be resolved" });
    if (submitError) alerts.unshift({ section: 0, tone: "error", text: submitError });
    return alerts;
  }, [workflow, form, appliedRc, isLookingUp, lookupError, calculations, customerCandidates, ownershipConflict, submitError]);

  function goToSection(index: number) {
    setActiveSection(index);
    document.getElementById(sectionIds[index])?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
'''
if marker not in text:
    raise SystemExit("vehicle marker not found")
text = text.replace(marker, replacement)

old_nav = '<div className="flex gap-1 overflow-x-auto px-3 py-2">{sections.map((section,index)=><button key={section} type="button" onClick={()=>setActiveSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6]"}`}>{index+1}</span>{section}</button>)}</div>'
new_nav = '<div className="flex gap-1 overflow-x-auto px-3 py-2">{sections.map((section,index)=>{const complete=workflow.groups[index]?.length===0;return <button key={section} type="button" onClick={()=>goToSection(index)} className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold transition ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] ${complete?"bg-emerald-100 text-emerald-700":activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6]"}`}>{complete?"✓":index+1}</span>{section}{workflow.groups[index]?.length?<span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[7px] font-bold text-amber-700">{workflow.groups[index].length}</span>:null}</button>})}</div>'
if old_nav not in text:
    raise SystemExit("nav marker not found")
text = text.replace(old_nav, new_nav)

text = text.replace('xl:grid-cols-[minmax(0,1fr)_300px]', 'xl:grid-cols-[minmax(0,1fr)_390px]')

section_replacements = {
    '<Section number="01" title="Policy source & ownership"': '<Section id="policy-source" number="01" title="Policy source & ownership"',
    '<Section number="02" title="Insured & vehicle identification"': '<Section id="policy-customer-vehicle" number="02" title="Insured & vehicle identification"',
    '<Section number="03" title="Policy product, premium & validity"': '<Section id="policy-premium" number="03" title="Policy product, premium & validity"',
    '<Section number="04" title="Projected insurer pay-in"': '<Section id="policy-payin" number="04" title="Projected insurer pay-in"',
    '<Section number="05" title="Intermediary payout & settlement"': '<Section id="policy-payout" number="05" title="Intermediary payout & settlement"',
}
for old, new in section_replacements.items():
    if old not in text:
        raise SystemExit(f"section marker missing: {old}")
    text = text.replace(old, new)

old_live_call = '<LiveSummary net={calculations.net} gst={calculations.gst} gross={calculations.gross} payinAfterTds={calculations.payinAfterTds} grossPayout={calculations.grossPayout}/>'
new_live_call = '<LiveSummary calculations={calculations} workflow={workflow} alerts={intelligenceAlerts} rcState={isLookingUp?"checking":appliedRc?"verified":lookupError?"attention":"not_checked"} customerState={customerCandidates?"confirmation":pendingPayload?.resolution?.selectedCustomerId?"linked":"will_resolve"} vehicleState={ownershipConflict?"conflict":form.registrationNo?"will_resolve":"waiting"} onNavigate={goToSection}/>'
if old_live_call not in text:
    raise SystemExit("live summary call not found")
text = text.replace(old_live_call, new_live_call)

live_pattern = re.compile(r'function LiveSummary\([\s\S]*?\nfunction ModalShell', re.M)
new_live = r'''function LiveSummary({ calculations, workflow, alerts, rcState, customerState, vehicleState, onNavigate }: {
  calculations: { net:number; gst:number; gross:number; projectedOd:number; projectedTp:number; totalPayin:number; tds:number; payinAfterTds:number; grossPayout:number; shortPayout:number };
  workflow: { groups:string[][]; completion:number; ready:boolean };
  alerts:Array<{ section:number; tone:"error"|"warning"|"info"; text:string }>;
  rcState:"checking"|"verified"|"attention"|"not_checked";
  customerState:"confirmation"|"linked"|"will_resolve";
  vehicleState:"conflict"|"will_resolve"|"waiting";
  onNavigate:(index:number)=>void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left:number; width:number; top:number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (window.innerWidth < 1280 || !anchorRef.current) { setPosition(null); return; }
      const rect = anchorRef.current.getBoundingClientRect();
      const safeTop = 172;
      const availableHeight = Math.max(360, window.innerHeight - safeTop - 72);
      setPosition({ left: rect.left, width: rect.width, top: Math.max(rect.top, safeTop), height: availableHeight } as { left:number; width:number; top:number; height:number });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const observer = new ResizeObserver(updatePosition);
    if (anchorRef.current) observer.observe(anchorRef.current);
    observer.observe(document.documentElement);
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); observer.disconnect(); };
  }, []);

  const margin = calculations.payinAfterTds - calculations.grossPayout;
  const marginPercent = calculations.payinAfterTds > 0 ? (margin / calculations.payinAfterTds) * 100 : 0;
  const marginTone = calculations.payinAfterTds <= 0 ? "neutral" : marginPercent < 5 ? "danger" : marginPercent < 15 ? "warning" : "healthy";
  const statusLabel = (value:string) => ({ checking:"Checking RC…", verified:"RC verified", attention:"RC needs attention", not_checked:"RC not checked", confirmation:"Confirmation required", linked:"Existing record selected", will_resolve:"Resolve on booking", conflict:"Ownership conflict", waiting:"Waiting for registration" }[value] ?? value);
  const statusTone = (value:string) => value === "verified" || value === "linked" ? "bg-emerald-50 text-emerald-700" : value === "attention" || value === "confirmation" ? "bg-amber-50 text-amber-700" : value === "conflict" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";

  const card = <div className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_14px_38px_rgba(15,23,42,.12)]">
    <div className="shrink-0 border-b bg-[linear-gradient(135deg,#F8FAFF,#EEF4FB)] px-5 py-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.14em] text-[#4F46E5]">Policy intelligence</p><h3 className="mt-1 text-[14px] font-bold text-[#102A4C]">Booking control centre</h3></div><span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${workflow.ready?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-700"}`}>{workflow.ready?"Ready":"In progress"}</span></div>
      <div className="mt-4 flex items-end justify-between"><div><p className="text-[9px] text-[#667085]">Mandatory completion</p><p className="mt-0.5 text-[22px] font-bold text-[#17365D]">{workflow.completion}%</p></div><p className="max-w-[170px] text-right text-[8.5px] leading-4 text-[#667085]">{workflow.ready?"Core policy details are complete.":`${workflow.groups.slice(0,3).reduce((sum,items)=>sum+items.length,0)} mandatory items remaining`}</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[linear-gradient(90deg,#4F46E5,#14B8A6)] transition-all" style={{width:`${workflow.completion}%`}}/></div>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <PanelBlock title="Workflow progress"><div className="space-y-1.5">{sections.map((section,index)=>{const remaining=workflow.groups[index]?.length??0;return <button key={section} type="button" onClick={()=>onNavigate(index)} className="flex w-full items-center justify-between rounded-xl border border-[#E6EBF2] bg-[#FBFCFE] px-3 py-2 text-left transition hover:border-[#AFC2DB] hover:bg-white"><span className="text-[9.5px] font-semibold text-[#344054]">{section}</span><span className={`rounded-full px-2 py-0.5 text-[7.5px] font-bold ${remaining?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>{remaining?`${remaining} remaining`:"Complete"}</span></button>})}</div></PanelBlock>

      <PanelBlock title="Attention"><div className="space-y-2">{alerts.length?alerts.slice(0,5).map((alert,index)=><button key={`${alert.text}-${index}`} type="button" onClick={()=>onNavigate(alert.section)} className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left ${alert.tone==="error"?"border-red-100 bg-red-50/70":alert.tone==="warning"?"border-amber-100 bg-amber-50/70":"border-blue-100 bg-blue-50/70"}`}><span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${alert.tone==="error"?"bg-red-500":alert.tone==="warning"?"bg-amber-500":"bg-blue-500"}`}/><span className="text-[8.5px] font-semibold leading-4 text-[#344054]">{alert.text}</span></button>):<div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-[9px] font-semibold text-emerald-700">No blocking attention items.</div>}</div></PanelBlock>

      <PanelBlock title="Verification & resolution"><div className="grid gap-2"><StatusLine label="RC verification" value={statusLabel(rcState)} tone={statusTone(rcState)}/><StatusLine label="Customer record" value={statusLabel(customerState)} tone={statusTone(customerState)}/><StatusLine label="Vehicle record" value={statusLabel(vehicleState)} tone={statusTone(vehicleState)}/></div></PanelBlock>

      <PanelBlock title="Financial outcome"><div className="grid grid-cols-2 gap-2"><MetricTile label="Gross premium" value={money.format(calculations.gross)}/><MetricTile label="Pay-in after TDS" value={money.format(calculations.payinAfterTds)}/><MetricTile label="Partner payout" value={money.format(calculations.grossPayout)}/><MetricTile label="Indicative margin" value={money.format(margin)} accent/></div><div className={`mt-3 rounded-xl px-3 py-2.5 ${marginTone==="healthy"?"bg-emerald-50 text-emerald-800":marginTone==="warning"?"bg-amber-50 text-amber-800":marginTone==="danger"?"bg-red-50 text-red-800":"bg-slate-100 text-slate-600"}`}><div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase tracking-[.08em]">Margin health</span><span className="text-[10px] font-bold">{calculations.payinAfterTds>0?`${marginPercent.toFixed(1)}%`:"Waiting"}</span></div><p className="mt-1 text-[8px] leading-3">{marginTone==="healthy"?"Healthy indicative commercial margin.":marginTone==="warning"?"Review payout before booking.":marginTone==="danger"?"Commercial margin is critically low or negative.":"Enter pay-in details to calculate margin health."}</p></div></PanelBlock>

      <div className={`rounded-2xl border p-4 ${workflow.ready?"border-emerald-200 bg-emerald-50":"border-[#DCE5F0] bg-[#F8FAFD]"}`}><p className={`text-[9px] font-bold ${workflow.ready?"text-emerald-800":"text-[#17365D]"}`}>{workflow.ready?"Ready for booking review":"Booking readiness"}</p><p className="mt-1 text-[8.5px] leading-4 text-[#667085]">{workflow.ready?"Mandatory source, customer, vehicle and policy details are complete. Review warnings and financials before booking.":"Complete the mandatory items shown above. Optional pay-in and payout details remain visible as guidance."}</p></div>
    </div>
  </div>;

  return <aside className="xl:self-stretch"><div className="xl:hidden">{card}</div><div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true" />{position && typeof document !== "undefined" ? createPortal(<div className="fixed z-30" style={{left:position.left,width:position.width,top:position.top,maxHeight:`calc(100dvh - ${position.top + 72}px)`}}>{card}</div>,document.body):null}</aside>;
}
function PanelBlock({title,children}:{title:string;children:ReactNode}){return <section><p className="mb-2 text-[8px] font-bold uppercase tracking-[.12em] text-[#52749E]">{title}</p>{children}</section>}
function StatusLine({label,value,tone}:{label:string;value:string;tone:string}){return <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E6EBF2] px-3 py-2.5"><span className="text-[8.5px] font-semibold text-[#667085]">{label}</span><span className={`rounded-full px-2 py-1 text-[7.5px] font-bold ${tone}`}>{value}</span></div>}
function MetricTile({label,value,accent}:{label:string;value:string;accent?:boolean}){return <div className={`rounded-xl border px-3 py-2.5 ${accent?"border-indigo-100 bg-indigo-50":"border-[#E6EBF2] bg-[#FBFCFE]"}`}><p className="text-[7.5px] font-semibold text-[#667085]">{label}</p><p className={`mt-1 text-[10px] font-bold ${accent?"text-indigo-700":"text-[#102A4C]"}`}>{value}</p></div>}

function ModalShell'''
if not live_pattern.search(text):
    raise SystemExit("LiveSummary block not found")
text = live_pattern.sub(new_live, text, count=1)

old_section = 'function Section({ number,title,subtitle,badge,children }: { number:string;title:string;subtitle:string;badge:string;children:ReactNode }) { return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">'
new_section = 'function Section({ id,number,title,subtitle,badge,children }: { id?:string;number:string;title:string;subtitle:string;badge:string;children:ReactNode }) { return <section id={id} className="scroll-mt-44 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">'
if old_section not in text:
    raise SystemExit("Section helper marker not found")
text = text.replace(old_section, new_section)

path.write_text(text, encoding="utf-8")
print("patched", path)
