from pathlib import Path

# Remove remarks from legacy onboarding UI.
p = Path('apps/web-portal/app/customers/posp-misp/legacy-onboarding-fields.tsx')
s = p.read_text()
start = s.index('      <label className="mt-4 block">\n        <span className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">Migration verification remarks *')
end = s.index('      <label className="mt-4 flex items-start gap-3', start)
s = s[:start] + s[end:]
p.write_text(s)

# Remove remarks validation/storage from legacy onboarding server action.
p = Path('apps/web-portal/app/customers/posp-misp/legacy-manual-actions.ts')
s = p.read_text()
s = s.replace('  const remarks = text(data, "legacy_migration_remarks");\n', '')
s = s.replace('  if (!remarks || remarks.length < 10) return { error: "Enter a clear migration verification remark.", field: "legacy_migration_remarks", applicationId: null };\n', '')
s = s.replace('    legacy_migration_remarks: remarks,\n', '')
p.write_text(s)

# Remove remarks from existing migration editor and copy.
p = Path('apps/web-portal/app/intermediaries/applications/[id]/existing-intermediary-migration-editor.tsx')
s = p.read_text()
s = s.replace('Maintain historical IDs, original dates, workflow completion and verification notes imported from previous records.', 'Maintain historical IDs, original dates and workflow completion imported from previous records.')
start = s.index('        <div>\n          <label className={labelClass} htmlFor="legacy_verification_remarks">Verification Remarks</label>')
end = s.index('      </form>', start)
s = s[:start] + s[end:]
p.write_text(s)

# Stop overwriting legacy remarks from edit-details autosave.
p = Path('apps/web-portal/app/intermediaries/applications/[id]/existing-intermediary-migration-actions.ts')
s = p.read_text()
s = s.replace('    legacy_verification_remarks: optionalText(formData, "legacy_verification_remarks"),\n', '')
s = s.replace('    legacy_migration_remarks: optionalText(formData, "legacy_verification_remarks"),\n', '')
p.write_text(s)

# Allow externally rendered submit buttons to show a forced pending state.
p = Path('apps/web-portal/components/form-submit-button.tsx')
s = p.read_text()
s = s.replace('  form,\n}: {', '  form,\n  forcePending = false,\n  onSubmitStart,\n}: {', 1)
s = s.replace('  form?: string;\n}) {', '  form?: string;\n  forcePending?: boolean;\n  onSubmitStart?: () => void;\n}) {', 1)
s = s.replace('  const isCurrentSubmission = pending && (!name || !value || data?.get(name) === value);', '  const isCurrentSubmission = forcePending || (pending && (!name || !value || data?.get(name) === value));')
s = s.replace('  const isDisabled = disabled || pending || (requireChange && !formChanged);', '  const isDisabled = disabled || pending || forcePending || (requireChange && !formChanged);')
s = s.replace('      onClick={preserveSubmitIntent}', '      onClick={() => { preserveSubmitIntent(); onSubmitStart?.(); }}')
p.write_text(s)

# Track submit intent across the redirect for the portalled Partner action bar.
p = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')
s = p.read_text()
s = s.replace('  const [missingDocument, setMissingDocument] = useState<string | null>(null);', '  const [missingDocument, setMissingDocument] = useState<string | null>(null);\n  const [submittingIntent, setSubmittingIntent] = useState<string | null>(null);')
s = s.replace('    if (submitter?.dataset.skipValidation === "true") return;', '    if (submitter?.dataset.skipValidation === "true") return;\n    const intent = submitter instanceof HTMLButtonElement ? submitter.value || "save" : "save";\n    setSubmittingIntent(intent);')
s = s.replace('      event.preventDefault();\n      return;\n    }\n    if (!showDocuments) return;', '      event.preventDefault();\n      setSubmittingIntent(null);\n      return;\n    }\n    if (!showDocuments) return;', 1)
s = s.replace('      event.preventDefault();\n      focusDocument(missing.key);', '      event.preventDefault();\n      setSubmittingIntent(null);\n      focusDocument(missing.key);', 1)
s = s.replace('<FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…"', '<FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" forcePending={submittingIntent === "exit"} onSubmitStart={() => setSubmittingIntent("exit")}', 1)
s = s.replace('<FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…"', '<FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" forcePending={submittingIntent === "documents"} onSubmitStart={() => setSubmittingIntent("documents")}', 1)
p.write_text(s)

# Replace persistent review-page success banner with the existing 4-second toast.
p = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
s = p.read_text()
s = s.replace('import { IdSuccessModal } from "./id-success-modal";', 'import { IdSuccessModal } from "./id-success-modal";\nimport { WorkflowSuccessToast } from "../workflow-success-toast";')
s = s.replace('{query.success && !modalSuccessEvents.has(query.success) ? <Notice tone="success" text={successMessage(query.success)} /> : null}', '{query.success && !modalSuccessEvents.has(query.success) ? <WorkflowSuccessToast message={successMessage(query.success)} durationMs={4000} /> : null}')
p.write_text(s)
