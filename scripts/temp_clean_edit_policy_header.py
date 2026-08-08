from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
old = '''  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n  const headerBadge=isEdit?"Existing policy":"";\n  const headerMeta=isEdit?`${initialValues?.policyCode||form.policyNo||"Policy"} · prototype_v1 calculations`:"";\n  const headerText=isEdit?"Update policy and financial details while preserving the linked customer and vehicle master records.":"";\n'''
new = '''  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n'''
if old not in text:
    raise SystemExit('edit policy header constants not found')
text = text.replace(old, new, 1)
old_render = '''        <div>{isEdit&&headerBadge?<div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">{headerBadge}</span>{headerMeta?<span className="text-[9px] text-white/70">{headerMeta}</span>:null}</div>:null}<h1 className={isEdit?"mt-2 text-[18px] font-semibold":"text-[18px] font-semibold"}>{headerTitle}</h1>{headerText?<p className="mt-0.5 text-[10px] text-white/70">{headerText}</p>:null}</div>\n'''
new_render = '''        <div><h1 className="text-[18px] font-semibold">{headerTitle}</h1></div>\n'''
if old_render not in text:
    raise SystemExit('edit policy header render block not found')
text = text.replace(old_render, new_render, 1)
path.write_text(text, encoding='utf-8')
