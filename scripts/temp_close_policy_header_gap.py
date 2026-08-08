from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
old = 'className="sticky top-[72px] z-50 mb-4 flex gap-1 overflow-x-auto rounded-b-2xl'
new = 'className="sticky top-[72px] z-50 -mt-5 mb-4 flex gap-1 overflow-x-auto rounded-b-2xl'
if old not in text:
    raise SystemExit('policy navigator class not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
