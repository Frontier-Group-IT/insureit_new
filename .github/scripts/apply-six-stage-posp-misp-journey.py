from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
source = path.read_text()

old_journey = '''function registrationJourney(context: AccountContext, profile: Profile, assignment: Assignment | null, app: Application): JourneyItem[] { const agreement = assignment?.agreement_status === "signed"; const iib = app.registration_status === "iib_registered"; const training = assignment?.training_status === "completed"; const exam = assignment?.exam_status === "passed"; return [{ label: "Partner linked", done: true, active: false }, { label: "Training", done: training, active: !training }, { label: "Exam", done: exam, active: training && !exam }, { label: "Agreement", done: agreement, active: exam && !agreement }, { label: `${context.toUpperCase()} active`, done: iib, active: agreement && !iib }]; }'''
new_journey = '''function registrationJourney(_context: AccountContext, profile: Profile, assignment: Assignment | null, app: Application): JourneyItem[] {
  const trainingAndExam = assignment?.training_status === "completed" && assignment?.exam_status === "passed";
  const agreement = assignment?.agreement_status === "signed";
  const iibUploaded = Boolean(profile.iib_uploaded || profile.iib_uploaded_at || app.registration_status === "iib_registered");

  return [
    { label: "Primary details", done: true, active: false },
    { label: "Documents", done: true, active: false },
    { label: "Registration", done: true, active: false },
    { label: "Training & Exam", done: trainingAndExam, active: !trainingAndExam },
    { label: "Agreement", done: agreement, active: trainingAndExam && !agreement },
    { label: "IIB Upload", done: iibUploaded, active: agreement && !iibUploaded },
  ];
}'''

old_components = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) { return <section className="bg-transparent px-0 py-1"><h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2><div className={`relative grid gap-0 ${journey.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-5"} before:absolute before:left-[10%] before:right-[10%] before:top-[13px] before:h-px before:bg-[#CBD5E1] before:content-['']`}>{journey.map((item) => <Journey key={item.label} {...item} />)}</div></section>; }
function Journey({ label, done, active }: JourneyItem) { return <div className="relative z-[1] min-w-0 text-center"><div className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold shadow-[0_0_0_6px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{done ? "✓" : active ? "•" : "-"}</div><p className="mt-2 text-[10px] font-semibold text-[#24345A]">{label}</p></div>; }'''
new_components = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
  const detailedStatus = journey.length === 6;
  return (
    <section className="overflow-x-auto bg-transparent px-0 py-1">
      <h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2>
      <div className={`relative grid min-w-[720px] gap-0 ${journey.length === 2 ? "sm:min-w-0 sm:grid-cols-2" : "sm:grid-cols-6"} before:absolute before:left-[8.333%] before:right-[8.333%] before:top-[21px] before:h-px before:bg-[#D6DEE9] before:content-['']`}>
        {journey.map((item, index) => <Journey key={item.label} {...item} index={index} detailedStatus={detailedStatus} />)}
      </div>
    </section>
  );
}
function Journey({ label, done, active, index, detailedStatus }: JourneyItem & { index: number; detailedStatus: boolean }) {
  const status = done ? "Completed" : active ? "Current" : "Pending";
  return (
    <div className="relative z-[1] min-w-0 text-center">
      <div className={`mx-auto grid h-11 w-11 place-items-center rounded-full border text-[12px] font-bold shadow-[0_0_0_7px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{done ? "✓" : index + 1}</div>
      <p className={`mt-2 text-[11px] font-semibold ${done ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</p>
      {detailedStatus ? <p className={`mt-0.5 text-[9px] font-medium ${done ? "text-emerald-700" : active ? "text-[#64748B]" : "text-[#94A3B8]"}`}>{status}</p> : null}
    </div>
  );
}'''

if old_journey not in source:
    raise SystemExit("registrationJourney source did not match")
if old_components not in source:
    raise SystemExit("JourneyCard source did not match")

path.write_text(source.replace(old_journey, new_journey).replace(old_components, new_components))
