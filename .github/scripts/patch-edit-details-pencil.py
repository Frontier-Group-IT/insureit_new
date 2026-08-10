from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
text = path.read_text()
old = '{isPartner ? <CompactLink href={`/intermediaries/applications/${id}/workflow?stage=primary`} label="Edit details" secondary /> : null}'
new = '{isPartner ? <Link href={`/intermediaries/applications/${id}/workflow?stage=primary`} aria-label="Edit details" title="Edit details" className={`${compactLightActionClassName} h-9 w-9 px-0`}><PencilIcon /></Link> : null}'
if old not in text:
    raise SystemExit('Edit details render target not found')
text = text.replace(old, new, 1)
marker = '''function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
'''
insert = marker + '''function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-white/75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}
'''
if marker not in text:
    raise SystemExit('EyeIcon marker not found')
text = text.replace(marker, insert, 1)
path.write_text(text)
