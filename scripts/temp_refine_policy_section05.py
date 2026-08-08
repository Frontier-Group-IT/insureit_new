from pathlib import Path

form_path = Path('apps/web-portal/components/policy-unified-form.tsx')
edit_path = Path('apps/web-portal/app/policies/policy-edit-actions.ts')
text = form_path.read_text(encoding='utf-8')
edit = edit_path.read_text(encoding='utf-8')

# Expand payout calculations and stop subtracting retention from partner payout.
old_calc = 'const payoutOd=od*numeric(form.payoutOdPercent)/100,payoutTp=form.payoutBasis==="OD"?0:tp*numeric(form.payoutTpPercent)/100; const grossPayout=Math.max(0,payoutOd+payoutTp-numeric(form.retention)),indicativeMargin=payinAfterTds-grossPayout; return{net,gst,gross,projectedOd,projectedTp,totalPayin,tds,payinAfterTds,grossPayout,indicativeMargin};'
new_calc = 'const payoutOd=od*numeric(form.payoutOdPercent)/100,payoutTp=form.payoutBasis==="OD"?0:tp*numeric(form.payoutTpPercent)/100; const grossPayout=Math.max(0,payoutOd+payoutTp),indicativeMargin=payinAfterTds-grossPayout; return{net,gst,gross,projectedOd,projectedTp,totalPayin,tds,payinAfterTds,payoutOd,payoutTp,grossPayout,indicativeMargin};'
if old_calc not in text:
    raise SystemExit('Calculation block not found')
text = text.replace(old_calc, new_calc, 1)

# Retention is derived; send the calculated value to create/edit payloads.
text = text.replace('payout:{retention:form.retention,odPercent:form.payoutOdPercent', 'payout:{retention:String(calculations.indicativeMargin),odPercent:form.payoutOdPercent', 1)
text = text.replace('payout:{retention:form.retention,odPercent:form.payoutOdPercent', 'payout:{retention:String(calculations.indicativeMargin),odPercent:form.payoutOdPercent', 1)

# Add optional remarks expansion state.
state_anchor = '  const [form,setForm]=useState<FormState>(()=>stateFrom(initialValues));\n'
if state_anchor not in text:
    raise SystemExit('Form state anchor not found')
text = text.replace(state_anchor, state_anchor + '  const [remarksOpen,setRemarksOpen]=useState(()=>Boolean(initialValues?.remarks));\n', 1)

# Replace Section 05 with compact single-row settlement layout.
start = text.index('      <Section number="05" title="Intermediary payout & settlement">')
end = text.index('\n    </div><LiveSummary', start)
new_section = '''      <Section number="05" title="Intermediary payout & settlement">
        <div>
          <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.payoutOd)}/>
        </div>
        <div>
          <PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"}/>
          <CalculatedSubline value={money.format(calculations.payoutTp)}/>
        </div>
        <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status"/>
        <SettlementField date={form.payoutDate} voucher={form.payoutVoucherNo} onDateChange={value=>update("payoutDate",value)} onVoucherChange={value=>update("payoutVoucherNo",value.toUpperCase())}/>
        <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EAF1] pt-2">
          <button type="button" onClick={()=>setRemarksOpen(open=>!open)} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#526277] transition hover:text-[#17365D]" aria-expanded={remarksOpen}><span className="text-[13px] font-light leading-none">{remarksOpen?"−":"+"}</span>{remarksOpen?"Hide remarks":"Add remarks"}</button>
          <PayoutOutcomeLine od={calculations.payoutOd} tp={calculations.payoutTp} total={calculations.grossPayout}/>
        </div>
        {remarksOpen?<div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-16 w-full rounded-xl border border-[#D8DEE9] px-3 py-2 text-[11px] outline-none focus:border-[#315B9A]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy, billing or payout notes"/></div>:null}
      </Section>'''
text = text[:start] + new_section + text[end:]

# Add settlement and outcome helpers before PercentField.
anchor = 'function PercentField({label,value,onChange,disabled}'
pos = text.index(anchor)
helpers = '''function SettlementField({date,voucher,onDateChange,onVoucherChange}:{date:string;voucher:string;onDateChange:(value:string)=>void;onVoucherChange:(value:string)=>void}){return <div><label className={labelClass}>Settlement</label><div className="grid h-10 grid-cols-[.88fr_1.12fr] overflow-hidden rounded-xl border border-[#D8DEE9] bg-white transition hover:border-[#B8C2D1] focus-within:border-[#315B9A] focus-within:ring-2 focus-within:ring-[#DCE8FA]"><label className="relative min-w-0 border-r border-[#E1E6ED]"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Date</span><input aria-label="Payout date" type="date" value={date} onChange={e=>onDateChange(e.target.value)} className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label><label className="relative min-w-0"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Voucher</span><input aria-label="Payout voucher number" value={voucher} onChange={e=>onVoucherChange(e.target.value)} placeholder="Reference" className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none placeholder:text-[#B0BAC8]"/></label></div></div>;}
function PayoutOutcomeLine({od,tp,total}:{od:number;tp:number;total:number}){return <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Payout outcome</span><span className="text-[#98A2B3]">OD <strong className="font-semibold text-[#17365D]">{money.format(od)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TP <strong className="font-semibold text-[#17365D]">{money.format(tp)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Total <strong className="font-bold text-[#315B9A]">{money.format(total)}</strong></span></div>;}
'''
text = text[:pos] + helpers + text[pos:]
form_path.write_text(text, encoding='utf-8')

# Retention is derived and may be negative; do not validate it as user-entered non-negative money.
old_edit = '''    payload.payin.scheme,\n    payload.payout.retention,\n  ];'''
new_edit = '''    payload.payin.scheme,\n  ];'''
if old_edit not in edit:
    raise SystemExit('Edit retention validation block not found')
edit = edit.replace(old_edit, new_edit, 1)
edit_path.write_text(edit, encoding='utf-8')
