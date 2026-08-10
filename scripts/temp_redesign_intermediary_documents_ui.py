from pathlib import Path

workflow_path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
editor_path = Path('apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx')
css_path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/workflow-theme.module.css')

workflow = workflow_path.read_text()
editor = editor_path.read_text()
css = css_path.read_text()

workflow = workflow.replace('import { IntermediaryJourneyStep } from "@/app/intermediaries/applications/intermediary-journey-step";\n', '')

old_header = '''        <section className="rounded-2xl border border-[#DCE5EF] bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              {permanentReference ? <span className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[9.5px] font-semibold text-white">{permanentReference}</span> : null}
              {onboardingComplete ? <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-2.5 py-1 text-[9px] font-bold text-emerald-50">✓ Onboarding complete</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[15px] font-semibold tracking-wide text-[#334155]">{maskPan(verificationPan)}</span>
              <span title={iibStatus.detail ?? iibStatus.label} className={`rounded-lg px-3 py-1.5 text-[9.5px] font-semibold ${iibStatus.badgeClassName}`}>{iibStatus.code === "cleared" ? "✓ " : ""}{iibStatus.label}</span>
            </div>
          </div>
        </section>

        {query.success && !popupEvent ? <WorkflowSuccessToast message={successes[query.success] ?? "Saved successfully."} /> : null}

        {!onboardingComplete ? (context === "partner" ? (
          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} partnerActive={application.partner_status === "active_partner"} />
        ) : (
          <SixStepNavigation viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} />
        )) : null}
'''
new_header = '''        <section className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-white">{profile.partner_type.toUpperCase()} Onboarding</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[9.5px] font-medium text-white/75">
                <span className="truncate">{title}</span>
                {permanentReference ? <><span className="text-white/35">·</span><span>{permanentReference}</span></> : null}
                {onboardingComplete ? <><span className="text-white/35">·</span><span>Onboarding complete</span></> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-[11px] font-semibold tracking-wide text-white/90">{maskPan(verificationPan)}</span>
              <span title={iibStatus.detail ?? iibStatus.label} className={`rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-[9px] font-semibold text-white ${iibStatus.badgeClassName}`}>{iibStatus.code === "cleared" ? "✓ " : ""}{iibStatus.label}</span>
            </div>
          </div>
        </section>

        {!onboardingComplete ? (context === "partner" ? (
          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} partnerActive={application.partner_status === "active_partner"} />
        ) : (
          <SixStepNavigation viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} />
        )) : null}

        {query.success && !popupEvent ? <WorkflowSuccessToast message={successes[query.success] ?? "Saved successfully."} /> : null}
'''
if old_header not in workflow:
    raise SystemExit('workflow header target not found')
workflow = workflow.replace(old_header, new_header, 1)

partner_start = workflow.index('function PartnerTwoStepNavigation(')
six_start = workflow.index('function SixStepNavigation(', partner_start)
old_partner = workflow[partner_start:six_start]
new_partner = '''function PartnerTwoStepNavigation({ applicationId, viewStage, documentsComplete, partnerActive }: { applicationId: string; viewStage: ViewStage; documentsComplete: boolean; partnerActive: boolean }) {
  const steps = [
    ["primary", "Primary details", `/intermediaries/applications/${applicationId}/workflow?stage=primary`],
    ["documents", "Documents", `/intermediaries/applications/${applicationId}/workflow?stage=documents`],
  ] as const;
  return (
    <nav className="sticky top-[66px] z-30 mb-4 grid grid-cols-2 overflow-hidden rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur" aria-label="Onboarding progress">
      {steps.map(([stage, label, href], index) => {
        const completed = partnerActive || (stage === "primary" && viewStage !== "primary") || (stage === "documents" && documentsComplete);
        const active = stage === viewStage;
        return <Link key={stage} href={href} aria-current={active ? "step" : undefined} className={`flex min-w-0 items-center justify-center gap-2 px-3 py-2.5 text-[9.5px] font-semibold transition ${index === 0 ? "border-r border-[#E4EAF1]" : ""} ${active ? "bg-[#EEF2FF] text-[#3730A3]" : "text-[#526277] hover:bg-[#F7F9FC] hover:text-[#17365D]"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[8px] font-bold ${completed ? "bg-emerald-50 text-emerald-700" : active ? "bg-[#4F46E5] text-white" : "bg-[#EEF3F8] text-[#64748B]"}`}>{completed ? "✓" : index + 1}</span><span className="truncate">{label}</span>{completed ? <span className="hidden text-[8px] font-semibold text-emerald-700 sm:inline">Complete</span> : active ? <span className="hidden text-[8px] font-semibold text-[#4F46E5] sm:inline">Current</span> : null}</Link>;
      })}
    </nav>
  );
}

'''
workflow = workflow[:partner_start] + new_partner + workflow[six_start:]

six_start = workflow.index('function SixStepNavigation(')
old_six = workflow[six_start:]
# SixStepNavigation is the final function in this file today, so replace to EOF.
new_six = '''function SixStepNavigation({ viewStage, documentsComplete, registrationComplete, trainingExamComplete, agreementSigned, iibUploaded }: { viewStage: ViewStage; documentsComplete: boolean; registrationComplete: boolean; trainingExamComplete: boolean; agreementSigned: boolean; iibUploaded: boolean }) {
  const completion: Record<ViewStage, boolean> = { primary: true, documents: documentsComplete, registration: registrationComplete, training: trainingExamComplete, agreement: agreementSigned, iib: iibUploaded };
  const steps: Array<[ViewStage, string]> = [["primary", "Primary details"], ["documents", "Documents"], ["registration", "Registration"], ["training", "Training & Exam"], ["agreement", "Agreement"], ["iib", "IIB Upload"]];
  return (
    <nav className="sticky top-[66px] z-30 mb-4 overflow-x-auto rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur" aria-label="Onboarding progress">
      <div className="grid min-w-[780px] grid-cols-6">
        {steps.map(([stage, label], index) => {
          const completed = completion[stage];
          const active = stage === viewStage;
          return <div key={stage} aria-current={active ? "step" : undefined} className={`flex min-w-0 items-center justify-center gap-2 px-2.5 py-2.5 text-[9px] font-semibold ${index < steps.length - 1 ? "border-r border-[#E4EAF1]" : ""} ${active ? "bg-[#EEF2FF] text-[#3730A3]" : "text-[#526277]"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[8px] font-bold ${completed ? "bg-emerald-50 text-emerald-700" : active ? "bg-[#4F46E5] text-white" : "bg-[#EEF3F8] text-[#64748B]"}`}>{completed ? "✓" : index + 1}</span><span className="truncate">{label}</span></div>;
        })}
      </div>
    </nav>
  );
}
'''
workflow = workflow[:six_start] + new_six

old_counts = '''  const requiredSlots = slots.filter((slot) => slot.required);
  const documentsReady = requiredSlots.every((slot) => Boolean(findDocumentForSlot(slot, documents)) || selectedFiles[slot.key]);
'''
new_counts = '''  const requiredSlots = slots.filter((slot) => slot.required);
  const requiredUploadedCount = requiredSlots.filter((slot) => Boolean(findDocumentForSlot(slot, documents)) || selectedFiles[slot.key]).length;
  const requiredRemainingCount = Math.max(requiredSlots.length - requiredUploadedCount, 0);
  const documentsReady = requiredRemainingCount === 0;
'''
if old_counts not in editor:
    raise SystemExit('document count target not found')
editor = editor.replace(old_counts, new_counts, 1)

old_action = '''  const actionBar = editable && (showPrimary || showDocuments) ? (
    <div className={`${actionTargetId ? "flex flex-col gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" : "sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur"}`}>
      {showDocuments ? <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="rounded-xl border px-4 py-2.5 text-[10.5px] font-semibold">Back to Primary</Link> : <span />}
      <div className="text-right">
        {showDocuments && !documentsReady ? <p className="mb-1 text-[8.5px] font-semibold text-amber-700">Attach every mandatory document before saving.</p> : null}
        {showPrimary ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" forcePending={submittingIntent === "exit"} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
            <FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" forcePending={submittingIntent === "documents"} />
          </div>
        ) : <FormSubmitButton form={formId} label="Save documents" pendingLabel="Saving" />}
      </div>
    </div>
  ) : null;
'''
new_action = '''  const actionBar = editable && (showPrimary || showDocuments) ? (
    <div className={`${actionTargetId ? "flex flex-col gap-3 rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" : showDocuments ? "fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur" : "sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-[#DCE5EF] bg-white/95 px-5 py-3 backdrop-blur"}`}>
      {showDocuments ? (
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[9.5px] font-medium text-[#64748B]">
            <span className="font-semibold text-[#334155]">Required documents: {requiredUploadedCount}/{requiredSlots.length} uploaded</span>
            {!documentsReady ? <span className="ml-2 text-amber-700">· {requiredRemainingCount} left</span> : <span className="ml-2 text-emerald-700">· Complete</span>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]">Back to Primary</Link>
            <FormSubmitButton form={formId} label="Save Documents" pendingLabel="Saving documents…" className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10.5px] font-semibold text-white hover:bg-[#102A49]" />
          </div>
        </div>
      ) : <>
        <span />
        <div className="text-right">
          <div className="flex flex-col gap-2 sm:flex-row">
            <FormSubmitButton form={formId} name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" forcePending={submittingIntent === "exit"} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10.5px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
            <FormSubmitButton form={formId} name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" forcePending={submittingIntent === "documents"} />
          </div>
        </div>
      </>}
    </div>
  ) : null;
'''
if old_action not in editor:
    raise SystemExit('document action bar target not found')
editor = editor.replace(old_action, new_action, 1)

old_docs = '''        {showDocuments ? <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><Header number="2" title="Documents" /><div className="p-4"><IntermediaryDocumentGrid documents={documents} legacy={legacyDocuments} hasGst={Boolean(profile.gst_number)} editable={editable} missingDocument={missingDocument} onFileSelection={handleFileChange} /></div></section> : null}
'''
new_docs = '''        {showDocuments ? <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-[13px] font-semibold text-[#17203A]">Documents</h2><p className="mt-0.5 text-[9px] font-medium text-[#64748B]">{requiredUploadedCount} of {requiredSlots.length} required documents uploaded</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${documentsReady ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{documentsReady ? "Required complete" : `${requiredRemainingCount} required left`}</span></div><div className="p-4"><IntermediaryDocumentGrid documents={documents} legacy={legacyDocuments} hasGst={Boolean(profile.gst_number)} editable={editable} missingDocument={missingDocument} onFileSelection={handleFileChange} /></div></section> : null}
'''
if old_docs not in editor:
    raise SystemExit('documents section target not found')
editor = editor.replace(old_docs, new_docs, 1)

# Remove the legacy CSS override that intentionally stripped all visual styling from the workflow nav.
start_marker = '/* Stage rail: no card/background, only the step indicators and connector. */\n'
end_marker = '/* Remove the outer card treatment and use the same compact vertical rhythm as Account Review. */\n'
start = css.find(start_marker)
end = css.find(end_marker)
if start == -1 or end == -1 or end <= start:
    raise SystemExit('workflow nav css target not found')
css = css[:start] + '/* Workflow navigation now uses the compact sticky onboarding bar from the shared onboarding visual language. */\n\n' + css[end:]

workflow_path.write_text(workflow)
editor_path.write_text(editor)
css_path.write_text(css)
