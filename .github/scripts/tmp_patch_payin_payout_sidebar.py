from pathlib import Path
import re

path = Path('apps/web-portal/components/policy-unified-form.tsx')
source = path.read_text()

import_anchor = 'import { createPortal } from "react-dom";\n'
lucide_import = 'import { ArrowDownToLine, CheckCircle2, ChevronRight, HandCoins, IndianRupee } from "lucide-react";\n'
if lucide_import not in source:
    if import_anchor not in source:
        raise SystemExit('React DOM import anchor not found')
    source = source.replace(import_anchor, import_anchor + lucide_import, 1)

if 'xl:grid-cols-[minmax(0,1fr)_300px]' not in source:
    raise SystemExit('Expected 300px summary rail not found')
source = source.replace('xl:grid-cols-[minmax(0,1fr)_300px]', 'xl:grid-cols-[minmax(0,1fr)_336px]', 1)

old_block = '''      {isMotorPolicy?<CommercialCard access={commercialAccess} payinEntered={payinEntered} payoutEntered={payoutEntered} totalPayin={calculations.totalPayin} totalPayout={calculations.grossPayout} onOpen={setCommercialModal}/>:null}\n      {!isMotorPolicy?<PolicyTypeDevelopmentNotice policyType={form.businessLine}/>:null}\n    </div>{isMotorPolicy?<LiveSummary completion={completion} net={calculations.net} gst={calculations.gst} gross={calculations.gross}/>:null}</div>'''
new_block = '''      {!isMotorPolicy?<PolicyTypeDevelopmentNotice policyType={form.businessLine}/>:null}\n    </div>{isMotorPolicy?<LiveSummary completion={completion} net={calculations.net} gst={calculations.gst} gross={calculations.gross} access={commercialAccess} payinEntered={payinEntered} payoutEntered={payoutEntered} totalPayin={calculations.totalPayin} totalPayout={calculations.grossPayout} payinOd={form.projectedOdPercent} payinTp={form.projectedTpPercent} payoutOd={form.payoutOdPercent} payoutTp={form.payoutTpPercent} onOpen={setCommercialModal}/>:null}</div>'''
if old_block not in source:
    raise SystemExit('Main form CommercialCard/LiveSummary block not found')
source = source.replace(old_block, new_block, 1)

commercial_pattern = re.compile(r'\nfunction CommercialCard\([\s\S]*?\nfunction ProjectedPayinModal')
if not commercial_pattern.search(source):
    raise SystemExit('CommercialCard definition not found')
source = commercial_pattern.sub('\nfunction ProjectedPayinModal', source, count=1)

live_pattern = re.compile(r'function LiveSummary\([\s\S]*?\nfunction SummaryRow')
if not live_pattern.search(source):
    raise SystemExit('LiveSummary definition not found')

live_summary = '''function LiveSummary({completion,net,gst,gross,access,payinEntered,payoutEntered,totalPayin,totalPayout,payinOd,payinTp,payoutOd,payoutTp,onOpen}:{completion:number;net:number;gst:number;gross:number;access:boolean;payinEntered:boolean;payoutEntered:boolean;totalPayin:number;totalPayout:number;payinOd:string;payinTp:string;payoutOd:string;payoutTp:string;onOpen:(kind:Exclude<CommercialModal,null>)=>void}){const anchorRef=useRef<HTMLDivElement>(null);const boundaryRef=useRef<HTMLElement>(null);const[position,setPosition]=useState<{left:number;width:number;top:number}|null>(null);useEffect(()=>{let frame=0;const boundaryElement=boundaryRef.current;if(!boundaryElement){setPosition(null);return;}const updatePosition=()=>{if(window.innerWidth<1280||!anchorRef.current){setPosition(null);return;}const anchorRect=anchorRef.current.getBoundingClientRect();const boundaryRect=boundaryElement.getBoundingClientRect();const fixedCard=document.getElementById("policy-summary-fixed-card");const cardHeight=fixedCard?.getBoundingClientRect().height??0;const preferredTop=Math.max(anchorRect.top,172);const boundaryTop=cardHeight>0?boundaryRect.bottom-cardHeight:preferredTop;setPosition({left:anchorRect.left,width:anchorRect.width,top:Math.min(preferredTop,boundaryTop)});};const scheduleUpdate=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(updatePosition);};updatePosition();frame=requestAnimationFrame(updatePosition);window.addEventListener("resize",scheduleUpdate);window.addEventListener("scroll",scheduleUpdate,true);const observer=new ResizeObserver(scheduleUpdate);observer.observe(boundaryElement);observer.observe(document.documentElement);return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",scheduleUpdate);window.removeEventListener("scroll",scheduleUpdate,true);observer.disconnect();};},[]);const complete=completion>=100;const payinRates=payinEntered?`OD ${payinOd||"0"}% · TP/CPA ${payinTp||"0"}%`:"Add projected insurer terms";const payoutRates=payoutEntered?`OD ${payoutOd||"0"}% · TP/CPA ${payoutTp||"0"}%`:"Add agreed partner payout";const card=<div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">Policy status</p><h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><CompletionRing value={completion}/><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${complete?"bg-[#E8F7EF] text-[#14845B]":"bg-[#FFF3CD] text-[#A96A00]"}`}>{complete?"Complete":"In progress"}</span></div><div className="px-4 py-3"><div className="mb-1.5 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><IndianRupee className="h-3.5 w-3.5" strokeWidth={2}/></span><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Premium</p></div><div className="divide-y divide-[#E8EDF3]"><SummaryRow label="Net premium" value={money.format(net)}/><SummaryRow label="GST" value={money.format(gst)}/><SummaryRow label="Gross premium" value={money.format(gross)} bold accent/></div></div>{access?<div className="border-t border-[#E8EDF3] px-3.5 py-3"><div className="mb-2"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Payin–Payout</p><p className="mt-0.5 text-[8px] text-[#98A2B3]">Sensitive terms · popup entry</p></div><div className="space-y-2"><button type="button" onClick={()=>onOpen("payin")} className="group flex w-full items-center gap-2.5 rounded-xl border border-[#DCE6F1] bg-[#F8FBFE] px-2.5 py-2.5 text-left transition hover:border-[#AFC5DE] hover:bg-[#F2F7FC]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E4F7F5] text-[#11857E]"><ArrowDownToLine className="h-4 w-4" strokeWidth={2}/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#17365D]">Insurer Pay-in{payinEntered?<CheckCircle2 className="h-3.5 w-3.5 text-[#159566]" strokeWidth={2.2}/>:null}</span><span className="mt-0.5 block truncate text-[8.5px] text-[#667085]">{payinRates}</span></span><span className="flex shrink-0 items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[7.5px] font-bold ${payinEntered?"bg-[#EAF7F2] text-[#18794E]":"bg-[#F1F4F8] text-[#7A8798]"}`}>{payinEntered?money.format(totalPayin):"Not entered"}</span><ChevronRight className="h-3.5 w-3.5 text-[#8A98AA] transition group-hover:translate-x-0.5" strokeWidth={2}/></span></button><button type="button" onClick={()=>onOpen("payout")} className="group flex w-full items-center gap-2.5 rounded-xl border border-[#E3DEF1] bg-[#FBFAFE] px-2.5 py-2.5 text-left transition hover:border-[#C4B8DF] hover:bg-[#F7F4FC]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F0EAFE] text-[#6B54B6]"><HandCoins className="h-4 w-4" strokeWidth={2}/></span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#17365D]">Partner Payout{payoutEntered?<CheckCircle2 className="h-3.5 w-3.5 text-[#159566]" strokeWidth={2.2}/>:null}</span><span className="mt-0.5 block truncate text-[8.5px] text-[#667085]">{payoutRates}</span></span><span className="flex shrink-0 items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[7.5px] font-bold ${payoutEntered?"bg-[#EAF7F2] text-[#18794E]":"bg-[#F1F4F8] text-[#7A8798]"}`}>{payoutEntered?money.format(totalPayout):"Not entered"}</span><ChevronRight className="h-3.5 w-3.5 text-[#8A98AA] transition group-hover:translate-x-0.5" strokeWidth={2}/></span></button></div></div>:null}</div>;return <aside ref={boundaryRef} className="xl:self-stretch"><div className="xl:hidden">{card}</div><div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true"/>{position&&typeof document!=="undefined"?createPortal(<div id="policy-summary-fixed-card" className="fixed z-30" style={{left:position.left,width:position.width,top:position.top}}>{card}</div>,document.body):null}</aside>;}
function SummaryRow'''
source = live_pattern.sub(live_summary, source, count=1)

source = source.replace('subtitle="Commercial expectation only. This does not create billing or confirm what the insurer will actually pay."', 'subtitle="Projected pay-in only. This does not create billing or confirm what the insurer will actually pay."')
source = source.replace('Blank means the commercial has not been entered.', 'Blank means the pay-in has not been entered.')
source = source.replace('subtitle="Actual agreed payout commercial for this policy. It remains independent from insurer actual pay-in."', 'subtitle="Actual agreed partner payout for this policy. It remains independent from insurer actual pay-in."')

if 'Commercials</h2>' in source or 'Commercial details restricted' in source or 'separate commercial popups' in source:
    raise SystemExit('Legacy user-facing Commercials copy remains')
path.write_text(source)

regression_path = Path('apps/web-portal/scripts/policy-ocr-onboarding-import-regression.mjs')
regression = regression_path.read_text()
anchor = '  ["Header wires parent reset callback", form, /onClearForm=\\{clearPolicyForm\\}/],\n'
additions = '''  ["Payin-Payout is integrated into summary rail", form, /function LiveSummary\\([\\s\\S]*Payin–Payout[\\s\\S]*Insurer Pay-in[\\s\\S]*Partner Payout/],\n  ["Summary rail restored to wider desktop width", form, /xl:grid-cols-\\[minmax\\(0,1fr\\)_336px\\]/],\n'''
if 'Payin-Payout is integrated into summary rail' not in regression:
    if anchor not in regression:
        raise SystemExit('Regression insertion anchor not found')
    regression = regression.replace(anchor, anchor + additions, 1)
marker = 'console.log("PASS: clear form reset is parent-owned and reload-free");\n'
extra = '''if (form.includes("function CommercialCard")) throw new Error("FAIL: legacy full-width Commercials card must not remain");\nif (form.includes(">Commercials<")) throw new Error("FAIL: user-facing Commercials label must be replaced by Payin-Payout");\nconsole.log("PASS: Payin-Payout controls live only in the compact summary rail");\n\n'''
if 'Payin-Payout controls live only in the compact summary rail' not in regression:
    if marker not in regression:
        raise SystemExit('Regression marker not found')
    regression = regression.replace(marker, marker + '\n' + extra, 1)
regression_path.write_text(regression)
