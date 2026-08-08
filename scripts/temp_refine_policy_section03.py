from pathlib import Path

form_path = Path('apps/web-portal/components/policy-unified-form.tsx')
ocr_path = Path('apps/web-portal/components/policy-ocr-import-panel.tsx')
text = form_path.read_text(encoding='utf-8')
ocr = ocr_path.read_text(encoding='utf-8')

# Move OCR trigger out of the global onboarding header.
old_header = '<div className="flex flex-wrap items-center gap-2"><PolicyOcrImportPanel/><button type="button" onClick={submitPolicy}'
new_header = '<div className="flex flex-wrap items-center gap-2"><button type="button" onClick={submitPolicy}'
if old_header not in text:
    raise SystemExit('Top OCR trigger not found')
text = text.replace(old_header, new_header, 1)

# Replace Section 03 with compact two-row layout.
start = text.index('      <Section number="03" title="Policy product, premium & validity"')
end = text.index('\n\n      <Section number="04"', start)
old = text[start:end]
new = '''      <Section number="03" title="Policy product, premium & validity" action={<PolicyOcrImportPanel variant="icon"/>}>
        <Select label="Policy product" value={form.policyProduct} onChange={e=>update("policyProduct",e.target.value)} options={policyProducts} placeholder="Select product" disabled={!form.vehicleClass} required/>
        <Field label="Policy number" value={form.policyNo} onChange={e=>update("policyNo",e.target.value.toUpperCase())} placeholder="Policy number" required/>
        <div><label className={labelClass}>Insurance company <Required/></label><select className={inputClass} value={form.insurerId} onChange={e=>update("insurerId",e.target.value)} required><option value="">Select insurer</option>{insurers.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
        <Field label="IDV" type="number" min="0" value={form.idv} onChange={e=>update("idv",e.target.value)} placeholder="₹ 0.00" required/>

        <Field label="OD premium" type="number" min="0" value={form.od} onChange={e=>update("od",e.target.value)} placeholder="₹ 0.00" required/>
        <Field label="TP premium" type="number" min="0" value={form.tp} onChange={e=>update("tp",e.target.value)} placeholder="₹ 0.00" required/>
        <Field label="CPA amount" type="number" min="0" value={form.cpa} onChange={e=>{const value=e.target.value;setForm(current=>({...current,cpa:value,cpaOpted:Number(value||0)>0?"Yes":"No"}));}} placeholder="₹ 0.00"/>
        <PolicyValidityField validFrom={form.validFrom} validUpto={form.validUpto} onFromChange={value=>update("validFrom",value)} onUptoChange={value=>update("validUpto",value)}/>
      </Section>'''
text = text[:start] + new + text[end:]

# Make Section support a right-side action.
old_section = 'function Section({number,title,subtitle,badge,children}:{number:string;title:string;subtitle?:string;badge?:string;children:ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle?<p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p>:null}</div></div>{badge?<span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span>:null}</div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;}'
new_section = 'function Section({number,title,subtitle,badge,action,children}:{number:string;title:string;subtitle?:string;badge?:string;action?:ReactNode;children:ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-start justify-between border-b bg-[#FBFCFE] px-4 py-3"><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle?<p className="mt-0.5 text-[9px] text-[#667085]">{subtitle}</p>:null}</div></div><div className="flex items-center gap-2">{badge?<span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span>:null}{action}</div></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;}'
if old_section not in text:
    raise SystemExit('Section helper not found')
text = text.replace(old_section, new_section, 1)

# Add unified validity control before Field helper.
anchor = 'function Field({label,required,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string})'
validity = '''function PolicyValidityField({validFrom,validUpto,onFromChange,onUptoChange}:{validFrom:string;validUpto:string;onFromChange:(value:string)=>void;onUptoChange:(value:string)=>void}){return <div><label className={labelClass}>Policy validity <Required/></label><div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl border border-[#D8DEE9] bg-white transition hover:border-[#B8C2D1] focus-within:border-[#315B9A] focus-within:ring-2 focus-within:ring-[#DCE8FA]"><label className="relative min-w-0 border-r border-[#E1E6ED]"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">From</span><input aria-label="Valid from" type="date" value={validFrom} onChange={e=>onFromChange(e.target.value)} required className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label><label className="relative min-w-0"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Upto</span><input aria-label="Valid upto" type="date" value={validUpto} onChange={e=>onUptoChange(e.target.value)} required className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label></div></div>;}
'''
if anchor not in text:
    raise SystemExit('Field helper anchor not found')
text = text.replace(anchor, validity + anchor, 1)

# Derive CPA opted from amount on initialization too.
old_cpa_init = 'cpaOpted: values?.cpaOpted ?? "Yes", cpa: values?.cpa ?? ""'
new_cpa_init = 'cpaOpted: Number(values?.cpa ?? 0)>0?"Yes":"No", cpa: values?.cpa ?? ""'
if old_cpa_init not in text:
    raise SystemExit('CPA init not found')
text = text.replace(old_cpa_init, new_cpa_init, 1)

form_path.write_text(text, encoding='utf-8')

# OCR: remove separate CPA opted application and add icon trigger variant.
ocr = ocr.replace('  "cpa_opted",\n', '')
ocr = ocr.replace('  cpa_opted: ["cpa opted"],\n', '')
ocr = ocr.replace('export function PolicyOcrImportPanel() {', 'export function PolicyOcrImportPanel({ variant = "header" }: { variant?: "header" | "icon" }) {', 1)
old_trigger = '    <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-white/20">Read Policy Copy</button>'
new_trigger = '''    {variant==="icon"?<button type="button" onClick={()=>setOpen(true)} aria-label="Read policy copy" title="Read policy copy" className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA] bg-white text-[#315B9A] shadow-sm transition hover:border-[#B8C8DC] hover:bg-[#F3F7FC] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA]"><PolicyReadIcon/></button>:<button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-white/20">Read Policy Copy</button>}'''
if old_trigger not in ocr:
    raise SystemExit('OCR trigger not found')
ocr = ocr.replace(old_trigger, new_trigger, 1)
icon_anchor = '\nfunction friendlyParserName(parserId: string) {'
icon_fn = '''\nfunction PolicyReadIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"/><path d="M14 2v6h6"/><path d="M9 13h3"/><path d="M9 17h2"/><circle cx="17" cy="16" r="3"/><path d="m19.2 18.2 2 2"/></svg>;}\n\nfunction friendlyParserName(parserId: string) {'''
if icon_anchor not in ocr:
    raise SystemExit('OCR icon anchor not found')
ocr = ocr.replace(icon_anchor, icon_fn, 1)
ocr_path.write_text(ocr, encoding='utf-8')
