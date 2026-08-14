from pathlib import Path

page_path = Path('apps/web-portal/app/policies/new/page.tsx')
page = page_path.read_text()
page = page.replace(
'''  const manufacturerOptions = makeNames.map((name) => ({ value: name, label: name }));''',
'''  const manufacturerOptions = makeNames;'''
)
page_path.write_text(page)

form_path = Path('apps/web-portal/components/policy-unified-form.tsx')
form = form_path.read_text()
form = form.replace(
'''  manufacturers: SelectOption[];''',
'''  manufacturers?: string[];'''
)
form = form.replace(
'''export function PolicyUnifiedForm({ mode, insurers, rms, sources, manufacturers, initialValues }: Props) {''',
'''export function PolicyUnifiedForm({ mode, insurers, rms, sources, manufacturers = [], initialValues }: Props) {'''
)
form_path.write_text(form)
