from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace(
'      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Master linked">',
'      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified.">'
)

old_section2 = '''      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":"Verify the registration, then review and apply approved RC details."} badge={isEdit?"Linked master · read-only":"AuthBridge API"}>
        <div>
          <label className={labelClass}>Registration number <Required/><Tag text={isEdit?"Master":"AuthBridge"} tone={isEdit?"green":"amber"}/></label>
          <div className="flex gap-2">
            <input className={`${inputClass} min-w-0 uppercase`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} className="shrink-0 rounded-xl bg-[#17365D] px-3 text-[9px] font-bold text-white disabled:opacity-40">{isLookingUp?"Fetching…":"Fetch RC"}</button>:null}
          </div>
'''
new_section2 = '''      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":undefined}>
        <div>
          <label className={labelClass}>Registration No. <Required/></label>
          <div className="flex">
            <input className={`${inputClass} min-w-0 rounded-r-none border-r-0 uppercase focus:z-10`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} aria-label={isLookingUp?"Fetching RC details":"Fetch RC details"} title={isLookingUp?"Fetching RC details":"Fetch RC details"} className="group grid h-10 w-11 shrink-0 place-items-center rounded-l-none rounded-r-xl border border-[#17365D] bg-[#17365D] text-white transition hover:bg-[#214A7A] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#A8B4C3] disabled:bg-[#A8B4C3] disabled:opacity-70">{isLookingUp?<RcFetchSpinner/>:<RcFetchIcon/>}</button>:null}
          </div>
'''
if old_section2 not in text:
    raise SystemExit('Section 02 registration block not found')
text = text.replace(old_section2, new_section2)

text = text.replace(
'      <Section number="03" title="Policy product, premium & validity" subtitle="Premium calculations are saved with calculation version prototype_v1." badge="Manual + calculated">',
'      <Section number="03" title="Policy product, premium & validity">'
)
text = text.replace(
'      <Section number="04" title="Projected insurer pay-in" subtitle="Projected receivable and billing values are saved separately." badge="prototype_v1">',
'      <Section number="04" title="Projected insurer pay-in">'
)
text = text.replace(
'      <Section number="05" title="Intermediary payout & settlement" subtitle="Stores the proposed partner payout and settlement status." badge="Finance workflow">',
'      <Section number="05" title="Intermediary payout & settlement">'
)

old_section_fn = 'function Section({number,title,subtitle,badge,children}:{number:string;title:string;subtitle:string;badge:string;children:ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2><p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p></div></div><span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;}'
new_section_fn = 'function Section({number,title,subtitle,badge,children}:{number:string;title:string;subtitle?:string;badge?:string;children:ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle?<p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p>:null}</div></div>{badge?<span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span>:null}</div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;}'
if old_section_fn not in text:
    raise SystemExit('Section helper not found')
text = text.replace(old_section_fn, new_section_fn)

# Tag is no longer needed after removing the RC label badge.
tag_fn = 'function Tag({text,tone}:{text:string;tone:"amber"|"green"}){return <span className={`rounded px-1.5 py-0.5 text-[7px] font-bold normal-case ${tone==="amber"?"bg-amber-50 text-amber-700":"bg-emerald-50 text-emerald-700"}`}>{text}</span>;}'
text = text.replace(tag_fn + '\n', '')

anchor = 'function Required(){return <span className="text-red-500">*</span>;}\n'
icons = '''function Required(){return <span className="text-red-500">*</span>;}\nfunction RcFetchIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="13" cy="12" r="4"/><path d="m16 15 3 3"/></svg>;}\nfunction RcFetchSpinner(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px] animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>;}\n'''
if anchor not in text:
    raise SystemExit('Required helper anchor not found')
text = text.replace(anchor, icons, 1)

path.write_text(text, encoding='utf-8')
