from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

old = '  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n'
new = '''  const policyTypeOptions=["Motor","Health","Life","Travel","Personal Accident","Fire","Marine","Engineering","Liability","Cyber","Property","Agriculture / Crop","Other / Miscellaneous"];\n  const isMotorPolicy=form.businessLine==="Motor";\n  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n'''
if old not in text:
    raise SystemExit('headerTitle anchor not found')
text = text.replace(old, new, 1)

old = '<div><Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select policy type" required/></div>'
new = '<div><Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={policyTypeOptions} placeholder="Select policy type" required/></div>'
if old not in text:
    raise SystemExit('policy type select anchor not found')
text = text.replace(old, new, 1)

old = 'className="sticky top-[72px] z-50 mb-4 flex gap-1 overflow-x-auto rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 px-3 py-2 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur"'
new = 'className={`${isMotorPolicy?"sticky top-[72px] z-50 mb-4 flex":"hidden"} gap-1 overflow-x-auto rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 px-3 py-2 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur`}'
if old not in text:
    raise SystemExit('navigator class anchor not found')
text = text.replace(old, new, 1)

old = '<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">'
new = '<div className={`grid gap-4 ${isMotorPolicy?"xl:grid-cols-[minmax(0,1fr)_300px]":""}`}><div className={`space-y-4 ${isMotorPolicy?"":"[&>#policy-section-2]:hidden [&>#policy-section-3]:hidden [&>#policy-section-4]:hidden [&>#policy-section-5]:hidden"}`}>'
if old not in text:
    raise SystemExit('main policy grid anchor not found')
text = text.replace(old, new, 1)

old = '''      </Section>\n    </div><LiveSummary completion={Math.round(sectionProgress.reduce((sum,item)=>sum+item.filled,0)/sectionProgress.reduce((sum,item)=>sum+item.total,0)*100)} net={calculations.net} gst={calculations.gst} gross={calculations.gross} projectedOd={calculations.projectedOd} projectedTp={calculations.projectedTp} scheme={numeric(form.insurerScheme)} totalPayin={calculations.totalPayin} tds={calculations.tds} payinAfterTds={calculations.payinAfterTds} retention={calculations.indicativeMargin} grossPayout={calculations.grossPayout}/></div>\n'''
new = '''      </Section>\n      {!isMotorPolicy?<PolicyTypeDevelopmentNotice policyType={form.businessLine}/>:null}\n    </div>{isMotorPolicy?<LiveSummary completion={Math.round(sectionProgress.reduce((sum,item)=>sum+item.filled,0)/sectionProgress.reduce((sum,item)=>sum+item.total,0)*100)} net={calculations.net} gst={calculations.gst} gross={calculations.gross} projectedOd={calculations.projectedOd} projectedTp={calculations.projectedTp} scheme={numeric(form.insurerScheme)} totalPayin={calculations.totalPayin} tds={calculations.tds} payinAfterTds={calculations.payinAfterTds} retention={calculations.indicativeMargin} grossPayout={calculations.grossPayout}/>:null}</div>\n'''
if old not in text:
    raise SystemExit('live summary anchor not found')
text = text.replace(old, new, 1)

old = '<div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"><div className="mx-auto flex max-w-[1480px] justify-end gap-2">'
new = '<div className={isMotorPolicy?"fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur":"hidden"}><div className="mx-auto flex max-w-[1480px] justify-end gap-2">'
if old not in text:
    raise SystemExit('bottom action anchor not found')
text = text.replace(old, new, 1)

anchor = 'function Section({number,title,subtitle,badge,action,children}'
notice = '''function PolicyTypeDevelopmentNotice({policyType}:{policyType:string}){return <section className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[#D9E2F0] bg-white px-6 py-10 text-center shadow-sm"><div className="max-w-md"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#EEF3FA] text-[#315B9A]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg></div><h2 className="mt-4 text-[15px] font-semibold text-[#17365D]">{policyType} onboarding</h2><p className="mt-2 text-[11px] leading-5 text-[#667085]">Onboarding page for this Policy type is still in development.</p><p className="mt-1 text-[9px] text-[#98A2B3]">Select Motor in Policy type above to use the active onboarding workflow.</p></div></section>;}
'''
if anchor not in text:
    raise SystemExit('Section helper anchor not found')
text = text.replace(anchor, notice + anchor, 1)

path.write_text(text, encoding='utf-8')
