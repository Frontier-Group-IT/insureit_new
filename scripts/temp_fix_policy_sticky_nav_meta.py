from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')

# Simplify derived source metadata.
old_rm = '<CompactSourceMeta label="RM" value={form.rmName||"Select lead source"} source={form.rmName?"Assigned":undefined}/>'
new_rm = '<CompactSourceMeta label="RM" value={form.rmName||"Select lead source"}/>'
if old_rm not in text:
    raise SystemExit('RM metadata block not found')
text = text.replace(old_rm, new_rm, 1)

old_code = '<CompactSourceMeta label="Intermediary code" value={form.intermediaryCode||"Select lead source"} source={form.intermediaryCode?"Master":undefined}/>'
new_code = '<CompactSourceMeta label="ID" value={form.intermediaryCode||"Select lead source"}/>'
if old_code not in text:
    raise SystemExit('Intermediary code metadata block not found')
text = text.replace(old_code, new_code, 1)

# Move sticky section navigator outside of the overflow-hidden blue-header container.
old_open = '<div className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">\n      <div className="border-b border-[#E7ECF3] bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-3.5 text-white">'
new_open = '<div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">\n      <div className="bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-3.5 text-white">'
if old_open not in text:
    raise SystemExit('Header container opening not found')
text = text.replace(old_open, new_open, 1)

old_nav_prefix = '      <div className="sticky top-[72px] z-40 flex gap-1 overflow-x-auto border-b border-[#E3E9F2] bg-white/95 px-3 py-2 shadow-[0_7px_18px_rgba(15,23,42,.07)] backdrop-blur">'
new_nav_prefix = '    </div>\n    <div className="sticky top-[72px] z-50 mb-4 flex gap-1 overflow-x-auto rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 px-3 py-2 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur">'
if old_nav_prefix not in text:
    raise SystemExit('Sticky navigator not found')
text = text.replace(old_nav_prefix, new_nav_prefix, 1)

# The old header wrapper closing follows the navigator; remove only that now-extra close.
needle = '</button>})}</div>\n    </div>\n\n    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">'
replacement = '</button>})}</div>\n\n    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">'
if needle not in text:
    raise SystemExit('Header wrapper closing pattern not found')
text = text.replace(needle, replacement, 1)

path.write_text(text, encoding='utf-8')
