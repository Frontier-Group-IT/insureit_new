from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
old = 'className="bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-3.5 text-white"'
new = 'className="flex min-h-[88px] items-center bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-3.5 text-white"'
if old not in text:
    raise SystemExit('policy header class not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
