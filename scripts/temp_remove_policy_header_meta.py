from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

old = '''  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n  const headerBadge=isEdit?"Existing policy":"Database enabled";\n  const headerMeta=isEdit?`${initialValues?.policyCode||form.policyNo||"Policy"} · prototype_v1 calculations`:"AuthBridge UAT · prototype_v1 calculations";\n  const headerText=isEdit?"Update policy and financial details while preserving the linked customer and vehicle master records.":"Creates or links the customer and vehicle, then books the policy and financial details in one transaction.";'''
new = '''  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";\n  const headerBadge=isEdit?"Existing policy":"";\n  const headerMeta=isEdit?`${initialValues?.policyCode||form.policyNo||"Policy"} · prototype_v1 calculations`:"";\n  const headerText=isEdit?"Update policy and financial details while preserving the linked customer and vehicle master records.":"";'''
if old not in text:
    raise SystemExit('Header state block not found')
text = text.replace(old, new, 1)

old_markup = '''        <div><div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">{headerBadge}</span><span className="text-[9px] text-white/70">{headerMeta}</span></div><h1 className="mt-2 text-[18px] font-semibold">{headerTitle}</h1><p className="mt-0.5 text-[10px] text-white/70">{headerText}</p></div>'''
new_markup = '''        <div>{isEdit&&headerBadge?<div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.14em]">{headerBadge}</span>{headerMeta?<span className="text-[9px] text-white/70">{headerMeta}</span>:null}</div>:null}<h1 className={isEdit?"mt-2 text-[18px] font-semibold":"text-[18px] font-semibold"}>{headerTitle}</h1>{headerText?<p className="mt-0.5 text-[10px] text-white/70">{headerText}</p>:null}</div>'''
if old_markup not in text:
    raise SystemExit('Header markup block not found')
text = text.replace(old_markup, new_markup, 1)

path.write_text(text, encoding='utf-8')
