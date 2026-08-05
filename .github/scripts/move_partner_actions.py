from pathlib import Path

button = Path('apps/web-portal/components/form-submit-button.tsx')
text = button.read_text()
text = text.replace('  value,\n}: {', '  value,\n  form,\n}: {', 1)
text = text.replace('  value?: string;\n}) {', '  value?: string;\n  form?: string;\n}) {', 1)
text = text.replace('    const form = buttonRef.current?.closest("form");', '    const form = buttonRef.current?.form;', 1)
text = text.replace('      type="submit"\n      name={name}', '      type="submit"\n      form={form}\n      name={name}', 1)
button.write_text(text)

editor = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')
text = editor.read_text()
text = text.replace('import { useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";\nimport { createPortal } from "react-dom";', 1)
text = text.replace('  legacyDocuments?: boolean;\n};', '  legacyDocuments?: boolean;\n  actionTargetId?: string;\n};', 1)
text = text.replace('export function PospMispApplicationEditor({ applicationId, profile, workflowStage = "pre_iib", viewStage, editable, salesManagers, banks, oems, documents, legacyDocuments = false }: Props) {', 'export function PospMispApplicationEditor({ applicationId, profile, workflowStage = "pre_iib", viewStage, editable, salesManagers, banks, oems, documents, legacyDocuments = false, actionTargetId }: Props) {', 1)
anchor = '  const formRef = useRef<HTMLFormElement>(null);\n'
replacement = anchor + '  const formId = `posp-misp-editor-${applicationId}`;\n  const [actionTarget, setActionTarget] = useState<HTMLElement | null>(null);\n\n  useEffect(() => {\n    setActionTarget(actionTargetId ? document.getElementById(actionTargetId) : null);\n  }, [actionTargetId]);\n'
text = text.replace(anchor, replacement, 1)
anchor = '  const documentsReady = requiredSlots.every((slot) => Boolean(findDocumentForSlot(slot, documents)) || selectedFiles[slot.key]);\n'
action = '''  const documentsReady = requiredSlots.every((slot) => Boolean(findDocumentForSlot(slot, documents)) || selectedFiles[slot.key]);
  const actionBar = editable && (showPrimary || showDocuments) ? (
    <div className={`${actionTargetId ? "flex flex-col gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" : "sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur"}`}>
      {showDocuments ? <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="rounded-xl border px-4 py-2.5 text-[10.5px] font-semibold">Back to Primary</Link> : <span />}
      <div className="text-right">
        {showDocuments && !documentsReady ? <p className="mb-1 text-[8.5px] font-semibold text-amber-700">Attach every mandatory document before saving.</p> : null}
        {showPrimary ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
            <FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" />
          </div>
        ) : <FormSubmitButton form={formId} label="Save documents" pendingLabel="Saving" />}
      </div>
    </div>
  ) : null;
'''
text = text.replace(anchor, action, 1)
text = text.replace('  return (\n    <form ref={formRef}', '  return (\n    <>\n    <form id={formId} ref={formRef}', 1)
old = '      {editable && (showPrimary || showDocuments) ? <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur">{showDocuments ? <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="rounded-xl border px-4 py-2.5 text-[10.5px] font-semibold">Back to Primary</Link> : <span />}<div className="text-right">{showDocuments && !documentsReady ? <p className="mb-1 text-[8.5px] font-semibold text-amber-700">Attach every mandatory document before saving.</p> : null}{showPrimary ? <div className="flex flex-col gap-2 sm:flex-row"><FormSubmitButton name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" /><FormSubmitButton name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" /></div> : <FormSubmitButton label="Save documents" pendingLabel="Saving" />}</div></div> : null}\n    </form>\n'
new = '      {!actionTargetId ? actionBar : null}\n    </form>\n    {actionTargetId && actionTarget && actionBar ? createPortal(actionBar, actionTarget) : null}\n    </>\n'
if old not in text:
    raise SystemExit('Existing action bar block was not found')
text = text.replace(old, new, 1)
editor.write_text(text)

page = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
text = page.read_text()
old = '<PospMispApplicationEditor applicationId={id} profile={editProfile} workflowStage={profile.workflow_stage} viewStage={viewStage} editable={editable} salesManagers={associates.map((item) => ({ value: item.id, label: item.full_name ?? "Unnamed" }))} banks={(banks ?? []).map((item) => ({ value: item.id, label: item.name }))} oems={(oems ?? []).map((item) => ({ value: item.name, label: item.name }))} documents={docList} />'
new = '<PospMispApplicationEditor applicationId={id} profile={editProfile} workflowStage={profile.workflow_stage} viewStage={viewStage} editable={editable} salesManagers={associates.map((item) => ({ value: item.id, label: item.full_name ?? "Unnamed" }))} banks={(banks ?? []).map((item) => ({ value: item.id, label: item.name }))} oems={(oems ?? []).map((item) => ({ value: item.name, label: item.name }))} documents={docList} actionTargetId={context === "partner" && viewStage === "primary" ? `partner-primary-actions-${id}` : undefined} />'
if old not in text:
    raise SystemExit('Editor usage was not found')
text = text.replace(old, new, 1)
old = '{viewStage === "primary" ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><ExistingIntermediaryMigrationEditor applicationId={id} accountType={profile.partner_type} values={migrationValues} editable={editable} /></div> : null}'
new = '{viewStage === "primary" ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><ExistingIntermediaryMigrationEditor applicationId={id} accountType={profile.partner_type} values={migrationValues} editable={editable} />{context === "partner" ? <div id={`partner-primary-actions-${id}`} className="mt-4" /> : null}</div> : null}'
if old not in text:
    raise SystemExit('Migration editor wrapper was not found')
page.write_text(text.replace(old, new, 1))
