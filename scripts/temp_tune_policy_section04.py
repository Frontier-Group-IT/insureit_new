from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace('CalculatedField label="Indicative margin"', 'CalculatedField label="Retention"', 1)

old_subline = 'function CalculatedSubline({value}:{value:string}){return <div className="mt-1.5 flex items-center gap-1.5 px-0.5 text-[9px]"><span className="font-semibold text-[#315B6B]">{value}</span><span className="text-[7.5px] font-medium uppercase tracking-[.05em] text-[#98A2B3]">Calculated</span></div>;}'
new_subline = 'function CalculatedSubline({value}:{value:string}){return <div className="mt-1.5 px-0.5 text-[9px] text-[#7A8798]">Calculated Amt. : <span className="font-semibold text-[#315B6B]">{value}</span></div>;}'
if old_subline not in text:
    raise SystemExit('CalculatedSubline helper not found')
text = text.replace(old_subline, new_subline, 1)

old_outcome = 'function PayinOutcomeLine({total,tds,net}:{total:number;tds:number;net:number}){return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#E4EAF1] pt-2 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Pay-in outcome</span><span className="text-[#98A2B3]">Total <strong className="font-semibold text-[#17365D]">{money.format(total)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TDS <strong className="font-semibold text-[#17365D]">{money.format(tds)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Net <strong className="font-bold text-[#315B9A]">{money.format(net)}</strong></span></div>;}'
new_outcome = 'function PayinOutcomeLine({total,tds,net}:{total:number;tds:number;net:number}){return <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-[#E4EAF1] pt-2 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Pay-in outcome</span><span className="text-[#98A2B3]">Total <strong className="font-semibold text-[#17365D]">{money.format(total)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TDS <strong className="font-semibold text-[#17365D]">{money.format(tds)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Net <strong className="font-bold text-[#315B9A]">{money.format(net)}</strong></span></div>;}'
if old_outcome not in text:
    raise SystemExit('PayinOutcomeLine helper not found')
text = text.replace(old_outcome, new_outcome, 1)

path.write_text(text, encoding='utf-8')
