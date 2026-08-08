from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx")
text = path.read_text()

old_call = '<SixStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} unlocked={unlocked} />'
new_call = '<SixStepNavigation viewStage={viewStage} documentsComplete={documentsComplete} registrationComplete={registrationComplete} trainingExamComplete={trainingExamComplete} agreementSigned={agreementSigned} iibUploaded={iibUploaded} />'
if old_call not in text:
    raise SystemExit("SixStepNavigation call pattern not found")
text = text.replace(old_call, new_call, 1)

old_fn = '''function SixStepNavigation({ applicationId, viewStage, documentsComplete, registrationComplete, trainingExamComplete, agreementSigned, iibUploaded, unlocked }: { applicationId: string; viewStage: ViewStage; documentsComplete: boolean; registrationComplete: boolean; trainingExamComplete: boolean; agreementSigned: boolean; iibUploaded: boolean; unlocked: Set<ViewStage> }) {
  const completion: Record<ViewStage, boolean> = { primary: true, documents: documentsComplete, registration: registrationComplete, training: trainingExamComplete, agreement: agreementSigned, iib: iibUploaded };
  const steps: Array<[ViewStage, string]> = [["primary", "Primary details"], ["documents", "Documents"], ["registration", "Registration"], ["training", "Training & Exam"], ["agreement", "Agreement"], ["iib", "IIB Upload"]];
  return (
    <nav className="-mt-2 overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-3 shadow-sm backdrop-blur">
      <div className="relative grid min-w-[900px] grid-cols-6 gap-0">
        {steps.map(([stage, label], index) => {
          const completed = completion[stage];
          const active = stage === viewStage && !completed;
          const available = unlocked.has(stage);
          const content = <IntermediaryJourneyStep label={label} completed={completed} active={active} index={index} />;
          return available ? <Link key={stage} href={`/intermediaries/applications/${applicationId}/workflow?stage=${stage}`} className="relative z-[1] min-w-0 text-center">{content}</Link> : <div key={stage} className="relative z-[1] min-w-0 cursor-not-allowed text-center opacity-75" aria-disabled="true">{content}</div>;
        })}
      </div>
    </nav>
  );
}'''
new_fn = '''function SixStepNavigation({ viewStage, documentsComplete, registrationComplete, trainingExamComplete, agreementSigned, iibUploaded }: { viewStage: ViewStage; documentsComplete: boolean; registrationComplete: boolean; trainingExamComplete: boolean; agreementSigned: boolean; iibUploaded: boolean }) {
  const completion: Record<ViewStage, boolean> = { primary: true, documents: documentsComplete, registration: registrationComplete, training: trainingExamComplete, agreement: agreementSigned, iib: iibUploaded };
  const steps: Array<[ViewStage, string]> = [["primary", "Primary details"], ["documents", "Documents"], ["registration", "Registration"], ["training", "Training & Exam"], ["agreement", "Agreement"], ["iib", "IIB Upload"]];
  return (
    <nav className="-mt-2 overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-3 shadow-sm backdrop-blur" aria-label="Onboarding progress">
      <div className="relative grid min-w-[900px] grid-cols-6 gap-0">
        {steps.map(([stage, label], index) => {
          const completed = completion[stage];
          const active = stage === viewStage && !completed;
          return <div key={stage} className="relative z-[1] min-w-0 cursor-default text-center" aria-current={active ? "step" : undefined}><IntermediaryJourneyStep label={label} completed={completed} active={active} index={index} /></div>;
        })}
      </div>
    </nav>
  );
}'''
if old_fn not in text:
    raise SystemExit("SixStepNavigation function pattern not found")
text = text.replace(old_fn, new_fn, 1)

assert "requestedStage && unlocked.has(requestedStage)" in text
assert "unlocked.has(stage)" not in text.split("function SixStepNavigation(", 1)[1]
assert 'aria-current={active ? "step" : undefined}' in text
path.write_text(text)
