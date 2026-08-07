from pathlib import Path

path = Path('apps/web-portal/components/policy-form-authbridge.tsx')
text = path.read_text(encoding='utf-8')
old = '<Select label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} options={[]} placeholder="RM not assigned" />'
new = '<Field label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} />'
if old not in text:
    raise SystemExit('Hidden RM select not found')
text = text.replace(old, new, 1)
required = [
    'label="Policy issuance date"',
    'label="Policy type"',
    'label="Intermediary type"',
    'label="Lead source"',
    '<Field label="RM name"',
    'label="Intermediary code"',
    'function CompactSourceMeta',
    'onboardPolicy(payload)',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required token after patch: {token}')
path.write_text(text, encoding='utf-8')
