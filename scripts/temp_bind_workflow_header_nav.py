from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
text = path.read_text()

old = '''      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">\n        <section className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">'''
new = '''      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">\n        <div>\n        <section className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">'''
if old not in text:
    raise SystemExit('header wrapper start target not found')
text = text.replace(old, new, 1)

old = '''        {!onboardingComplete ? (context === "partner" ? (\n          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} partnerActive={application.partner_status === "active_partner"} />\n        ) : (\n          <SixStepNavigation viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} />\n        )) : null}\n\n        {query.success && !popupEvent ? <WorkflowSuccessToast message={successes[query.success] ?? "Saved successfully."} /> : null}'''
new = '''        {!onboardingComplete ? (context === "partner" ? (\n          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} partnerActive={application.partner_status === "active_partner"} />\n        ) : (\n          <SixStepNavigation viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} />\n        )) : null}\n        </div>\n\n        {query.success && !popupEvent ? <WorkflowSuccessToast message={successes[query.success] ?? "Saved successfully."} /> : null}'''
if old not in text:
    raise SystemExit('header wrapper end target not found')
text = text.replace(old, new, 1)

text = text.replace('sticky top-[66px] z-30 mb-4 grid grid-cols-2', 'sticky top-[66px] z-30 grid grid-cols-2', 1)
text = text.replace('sticky top-[66px] z-30 mb-4 overflow-x-auto', 'sticky top-[66px] z-30 overflow-x-auto', 1)

path.write_text(text)
