from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

# Add indicative margin to the existing calculation result without feeding it back into payout.
old_calc = 'return{net,gst,gross,projectedOd,projectedTp,totalPayin,tds,payinAfterTds,grossPayout:Math.max(0,payoutOd+payoutTp-numeric(form.retention))};'
new_calc = 'const grossPayout=Math.max(0,payoutOd+payoutTp-numeric(form.retention)),indicativeMargin=payinAfterTds-grossPayout; return{net,gst,gross,projectedOd,projectedTp,totalPayin,tds,payinAfterTds,grossPayout,indicativeMargin};'
if old_calc not in text:
    raise SystemExit('Calculation return block not found')
text = text.replace(old_calc, new_calc, 1)

start = text.index('      <Section number="04" title="Projected insurer pay-in"')
end = text.index('\n\n      <Section number="05"', start)
new_section = '''      <Section number="04" title="Projected insurer pay-in">
        <div>
          <PercentField label="OD Pay-in %" value={form.projectedOdPercent} onChange={v=>update("projectedOdPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.projectedOd)}/>
        </div>
        <div>
          <PercentField label="TP Pay-in %" value={form.projectedTpPercent} onChange={v=>update("projectedTpPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.projectedTp)}/>
        </div>
        <Field label="Insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={e=>update("insurerScheme",e.target.value)} placeholder="₹ 0.00"/>
        <CalculatedField label="Indicative margin" value={money.format(calculations.indicativeMargin)} tone={calculations.indicativeMargin<0?"negative":calculations.indicativeMargin>0?"positive":"neutral"}/>
        <div className="md:col-span-2 xl:col-span-4"><PayinOutcomeLine total={calculations.totalPayin} tds={calculations.tds} net={calculations.payinAfterTds}/></div>
      </Section>'''
text = text[:start] + new_section + text[end:]

anchor = 'function PercentField({label,value,onChange,disabled}'
pos = text.index(anchor)
helpers = '''function CalculatedSubline({value}:{value:string}){return <div className="mt-1.5 flex items-center gap-1.5 px-0.5 text-[9px]"><span className="font-semibold text-[#315B6B]">{value}</span><span className="text-[7.5px] font-medium uppercase tracking-[.05em] text-[#98A2B3]">Calculated</span></div>;}
function CalculatedField({label,value,tone="neutral"}:{label:string;value:string;tone?:"positive"|"negative"|"neutral"}){const toneClass=tone==="positive"?"text-[#14845B]":tone==="negative"?"text-[#C63E45]":"text-[#17365D]";return <div><label className={labelClass}>{label}</label><div className="flex h-10 items-center rounded-xl border border-[#E1E7EF] bg-[#F8FAFC] px-3"><span className={`text-[11px] font-bold ${toneClass}`}>{value}</span><span className="ml-auto text-[7.5px] font-semibold uppercase tracking-[.05em] text-[#98A2B3]">Auto</span></div></div>;}
function PayinOutcomeLine({total,tds,net}:{total:number;tds:number;net:number}){return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#E4EAF1] pt-2 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Pay-in outcome</span><span className="text-[#98A2B3]">Total <strong className="font-semibold text-[#17365D]">{money.format(total)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TDS <strong className="font-semibold text-[#17365D]">{money.format(tds)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Net <strong className="font-bold text-[#315B9A]">{money.format(net)}</strong></span></div>;}
'''
text = text[:pos] + helpers + text[pos:]

path.write_text(text, encoding='utf-8')
