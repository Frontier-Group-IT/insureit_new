from pathlib import Path

path = Path('apps/web-portal/components/policy-unified-form.tsx')
text = path.read_text(encoding='utf-8')
old = '<SummaryRow label="Retention" value={money.format(retention)} tone={retention<0?"negative":retention>0?"positive":"neutral"}/><SummaryRow label="Partner payout" value={money.format(grossPayout)} bold/>'
new = '<SummaryRow label="Partner payout" value={money.format(grossPayout)} bold/><SummaryRow label="Retention" value={money.format(retention)} tone={retention<0?"negative":retention>0?"positive":"neutral"}/>'
if old not in text:
    raise SystemExit('sidebar bottom rows not found in expected order')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
