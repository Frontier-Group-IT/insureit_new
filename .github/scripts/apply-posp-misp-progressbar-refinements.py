from pathlib import Path

root = Path(__file__).resolve().parents[2]
review = root / "apps/web-portal/app/intermediaries/applications/[id]/page.tsx"
workflow = root / "apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx"
shared = root / "apps/web-portal/app/intermediaries/applications/intermediary-journey-step.tsx"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    text = text.replace(old, new, 1)
    path.write_text(text)

replace_once(
    shared,
    '      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[8px] font-bold leading-none transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-transparent text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span>',
    '      <span\n        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[8px] font-bold leading-none transition ${completed ? "text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-transparent text-[#94A3B8]"}`}\n        style={completed ? { backgroundColor: "#059669", borderColor: "#059669", color: "#FFFFFF" } : undefined}\n      >{completed ? "✓" : index + 1}</span>'
)

replace_once(
    review,
    '        <section id="overview" className="space-y-4">',
    '        <section id="overview" className={!isPartner && !onboardingComplete ? "-mt-2 space-y-4" : "space-y-4"}>'
)

old_review_journey = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
  const detailedStatus = journey.length === 6;
  return (
    <section className="overflow-x-auto bg-transparent px-0 py-1">
      <h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2>
      <div className={`relative grid gap-0 ${detailedStatus ? "min-w-[900px] sm:grid-cols-6 before:top-[9px]" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:top-[21px]"} before:absolute before:left-[8.333%] before:right-[8.333%] before:h-px before:bg-[#D6DEE9] before:content-['']`}>
        {journey.map((item, index) => <Journey key={item.label} {...item} index={index} detailedStatus={detailedStatus} />)}
      </div>
    </section>
  );
}'''
new_review_journey = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
  const detailedStatus = journey.length === 6;
  return (
    <section className={`overflow-x-auto bg-transparent px-0 ${detailedStatus ? "py-0" : "py-1"}`}>
      {!detailedStatus ? <h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2> : null}
      <div className={`relative grid gap-0 ${detailedStatus ? "min-w-[900px] sm:grid-cols-6" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:absolute before:left-[25%] before:right-[25%] before:top-[21px] before:h-px before:bg-[#D6DEE9] before:content-['']"}`}>
        {journey.map((item, index) => <Journey key={item.label} {...item} index={index} detailedStatus={detailedStatus} />)}
      </div>
    </section>
  );
}'''
replace_once(review, old_review_journey, new_review_journey)

replace_once(
    workflow,
    '    <nav className="overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-5 shadow-sm backdrop-blur">\n      <div className="relative grid min-w-[900px] grid-cols-6 gap-0 before:absolute before:left-[8.4%] before:right-[8.4%] before:top-[9px] before:h-px before:bg-[#CBD5E1] before:content-[\'\']">',
    '    <nav className="-mt-2 overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-3 shadow-sm backdrop-blur">\n      <div className="relative grid min-w-[900px] grid-cols-6 gap-0">'
)

# Guardrails for the requested UI-only scope.
shared_text = shared.read_text()
review_text = review.read_text()
workflow_text = workflow.read_text()
assert 'backgroundColor: "#059669"' in shared_text
assert 'POSP account journey' not in review_text
assert 'MISP account journey' not in review_text
assert 'detailedStatus ? "min-w-[900px] sm:grid-cols-6"' in review_text
assert 'relative grid min-w-[900px] grid-cols-6 gap-0">' in workflow_text
assert 'py-3 shadow-sm' in workflow_text
assert 'before:top-[9px]' not in workflow_text

print("Applied POSP/MISP progressbar UI refinements")
