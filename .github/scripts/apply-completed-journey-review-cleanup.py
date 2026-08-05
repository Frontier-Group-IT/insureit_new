from pathlib import Path

workflow_path = Path("apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx")
review_path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
editor_path = Path("apps/web-portal/app/customers/applications/posp-misp-application-editor.tsx")

workflow = workflow_path.read_text()
workflow = workflow.replace('import { AccountReviewBackLink } from "@/app/intermediaries/applications/account-review-back-link";\n', '')
workflow = workflow.replace(
    '  const iibCleared = iibStatus.code === "cleared";\n',
    '  const iibCleared = iibStatus.code === "cleared";\n  const onboardingComplete = context === "partner"\n    ? application.partner_status === "active_partner"\n    : application.registration_status === "iib_registered" || Boolean(profile.iib_uploaded || profile.iib_uploaded_at);\n',
)
old_header = '''            <div>\n              <AccountReviewBackLink href={`/intermediaries/applications/${id}`} />\n              <div className="mt-2 flex flex-wrap items-center gap-2.5">\n                <h1 className="text-xl font-semibold text-[#0F172A]">{title}</h1>\n                {permanentReference ? <span className="rounded-lg border border-[#D7E0EB] bg-white px-2.5 py-1 text-[9.5px] font-medium text-[#475569]">{permanentReference}</span> : null}\n              </div>\n            </div>'''
new_header = '''            <div className="flex flex-wrap items-center gap-2.5">\n              <h1 className="text-xl font-semibold text-white">{title}</h1>\n              {permanentReference ? <span className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[9.5px] font-semibold text-white">{permanentReference}</span> : null}\n              {onboardingComplete ? <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-2.5 py-1 text-[9px] font-bold text-emerald-50">✓ Onboarding complete</span> : null}\n            </div>'''
if old_header not in workflow:
    raise SystemExit("workflow header source did not match")
workflow = workflow.replace(old_header, new_header)
old_navigation = '''        {context === "partner" ? (\n          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={showDocuments} partnerActive={application.partner_status === "active_partner"} />\n        ) : (\n          <SixStepNavigation applicationId={id} viewStage={viewStage} registrationStatus={application.registration_status} documentsComplete={showDocuments} agreementSigned={assignment?.agreement_status === "signed"} />\n        )}'''
new_navigation = '''        {!onboardingComplete ? (context === "partner" ? (\n          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={showDocuments} partnerActive={application.partner_status === "active_partner"} />\n        ) : (\n          <SixStepNavigation applicationId={id} viewStage={viewStage} registrationStatus={application.registration_status} documentsComplete={showDocuments} agreementSigned={assignment?.agreement_status === "signed"} />\n        )) : null}'''
if old_navigation not in workflow:
    raise SystemExit("workflow navigation source did not match")
workflow = workflow.replace(old_navigation, new_navigation)
workflow = workflow.replace(
    '          const completed = number < current || (number === 1 && current > 1) || (number === 2 && documentsComplete && partnerActive);',
    '          const completed = partnerActive || number < current || (number === 1 && current > 1) || (number === 2 && documentsComplete);',
)
workflow_path.write_text(workflow)

review = review_path.read_text()
review = review.replace(
    '  const journey = isPartner ? partnerJourney(profile, documents ?? [], activePartner) : registrationJourney(accountContext, profile, assignment, application);\n',
    '  const journey = isPartner ? partnerJourney(profile, documents ?? [], activePartner) : registrationJourney(accountContext, profile, assignment, application);\n  const onboardingComplete = isPartner ? activePartner : application.registration_status === "iib_registered" || Boolean(profile.iib_uploaded || profile.iib_uploaded_at);\n',
)
review = review.replace(
    '{registrationId ? <Id value={registrationId} /> : null}',
    '{registrationId ? <Id value={registrationId} active={onboardingComplete} /> : null}',
)
review = review.replace(
    '          <JourneyCard title={isPartner ? "Partner onboarding journey" : `${kind} account journey`} journey={journey} />',
    '          {!onboardingComplete ? <JourneyCard title={isPartner ? "Partner onboarding journey" : `${kind} account journey`} journey={journey} /> : null}',
)
review_path.write_text(review)

editor = editor_path.read_text()
old_editor_header = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b bg-[#F8FAFC] px-4 py-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#071D49] text-[9px] font-bold text-white">{number}</span><div><h3 className="text-[12.5px] font-semibold">{title}</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p></div></div>; }'
new_editor_header = 'function Header({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b border-[#E2E8F0] !bg-white px-4 py-3 !text-[#0F172A]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF2F7] text-[9px] font-bold text-[#071D49]">{number}</span><div><h3 className="text-[12.5px] font-semibold text-[#0F172A]">{title}</h3><p className="mt-0.5 text-[9.8px] text-[#64748B]">{subtitle}</p></div></div>; }'
if old_editor_header not in editor:
    raise SystemExit("editor header source did not match")
editor = editor.replace(old_editor_header, new_editor_header)
editor_path.write_text(editor)
