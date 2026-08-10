from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
text = path.read_text()
old = '{viewStage === "primary" ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><ExistingIntermediaryMigrationEditor applicationId={id} accountType={profile.partner_type} values={migrationValues} editable={editable} />{context === "partner" ? <div id={`partner-primary-actions-${id}`} className="mt-4" /> : null}</div> : null}'
new = '{viewStage === "primary" ? <div className="pb-4 sm:pb-5"><ExistingIntermediaryMigrationEditor applicationId={id} accountType={profile.partner_type} values={migrationValues} editable={editable} />{context === "partner" ? <div id={`partner-primary-actions-${id}`} className="mt-4" /> : null}</div> : null}'
if old not in text:
    raise SystemExit('target wrapper not found')
text = text.replace(old, new, 1)
path.write_text(text)
