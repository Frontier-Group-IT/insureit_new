from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
old = '''function CompactSourceMeta({label,value,source}:{label:string;value:string;source?:string}){return <div className="mt-1.5 min-h-[15px] px-0.5 leading-none"><div className="flex min-w-0 items-center gap-1.5 text-[7.5px] font-semibold tracking-[.02em] text-[#7A8CA5]"><span className="shrink-0">{label}</span>{source?<span className="text-[6.5px] font-bold uppercase tracking-[.08em] text-[#4F8C7A]">{source}</span>:null}<span className={`min-w-0 truncate text-[8.5px] font-semibold ${value&&value!=="Select lead source"?"text-[#526A87]":"text-[#A0AAB8]"}`}>· {value}</span></div></div>;}'''
new = '''function CompactSourceMeta({label,value,source}:{label:string;value:string;source?:string}){const sourceTone=source==="Auto"?"text-[#16825D]":source==="Assigned"?"text-[#3B6EA8]":source==="Master"?"text-[#7657A6]":"text-[#718096]";const hasValue=Boolean(value&&value!=="Select lead source");return <div className="mt-1.5 min-h-[18px] px-0.5"><div className="flex min-w-0 items-center gap-1.5 leading-[1.15]"><span className="shrink-0 text-[8.5px] font-semibold tracking-[.015em] text-[#718096]">{label}</span>{source?<span className={`shrink-0 text-[7.5px] font-bold uppercase tracking-[.07em] ${sourceTone}`}>{source}</span>:null}<span className="shrink-0 text-[8.5px] font-semibold text-[#C1CAD6]">·</span><span className={`min-w-0 truncate text-[10px] font-semibold tracking-[.005em] ${hasValue?"text-[#244C73]":"text-[#98A2B3]"}`}>{value}</span></div></div>;}'''
if old not in text:
    raise SystemExit('CompactSourceMeta source block not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
