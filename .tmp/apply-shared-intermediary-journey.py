from pathlib import Path

review = Path('apps/web-portal/app/intermediaries/applications/[id]/page.tsx')
workflow = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
shared = Path('apps/web-portal/app/intermediaries/applications/intermediary-journey-step.tsx')

review_text = review.read_text()
workflow_text = workflow.read_text()

review_import = 'import { WorkflowSuccessToast } from "../workflow-success-toast";\n'
review_new_import = review_import + 'import { IntermediaryJourneyStep } from "../intermediary-journey-step";\n'
assert review_import in review_text
assert 'IntermediaryJourneyStep' not in review_text
review_text = review_text.replace(review_import, review_new_import, 1)

workflow_import = 'import { WorkflowSuccessToast } from "@/app/intermediaries/applications/workflow-success-toast";\n'
workflow_new_import = workflow_import + 'import { IntermediaryJourneyStep } from "@/app/intermediaries/applications/intermediary-journey-step";\n'
assert workflow_import in workflow_text
assert 'IntermediaryJourneyStep' not in workflow_text
workflow_text = workflow_text.replace(workflow_import, workflow_new_import, 1)

old_review_grid = 'detailedStatus ? "min-w-[900px] sm:grid-cols-6 before:top-[17px]" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:top-[21px]"'
new_review_grid = 'detailedStatus ? "min-w-[900px] sm:grid-cols-6 before:top-[9px]" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:top-[21px]"'
assert old_review_grid in review_text
review_text = review_text.replace(old_review_grid, new_review_grid, 1)

old_review_detailed = '''  if (detailedStatus) {\n    return (\n      <div className="relative z-[1] flex min-w-0 items-center justify-center gap-2 px-2">\n        <p className={`whitespace-nowrap bg-[#F8FAFC] px-1 text-[11px] font-semibold ${done ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</p>\n        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[11px] font-bold shadow-[0_0_0_6px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8]"}`}>{done ? "✓" : index + 1}</div>\n      </div>\n    );\n  }'''
new_review_detailed = '''  if (detailedStatus) {\n    return <IntermediaryJourneyStep label={label} completed={done} active={active} index={index} />;\n  }'''
assert old_review_detailed in review_text
review_text = review_text.replace(old_review_detailed, new_review_detailed, 1)

old_workflow_grid = 'before:top-[17px] before:h-px before:bg-[#CBD5E1]'
new_workflow_grid = 'before:top-[9px] before:h-px before:bg-[#CBD5E1]'
assert old_workflow_grid in workflow_text
workflow_text = workflow_text.replace(old_workflow_grid, new_workflow_grid, 1)

old_content = 'const content = <span className="inline-flex items-center justify-center gap-2 bg-[#F8FAFC] px-2"><span className={`truncate text-[10.5px] font-semibold ${active ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-[#64748B]"}`}>{label}</span><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10.5px] font-bold transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#071D49] bg-[#071D49] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span></span>;'
new_content = 'const content = <IntermediaryJourneyStep label={label} completed={completed} active={active} index={index} />;'
assert old_content in workflow_text
workflow_text = workflow_text.replace(old_content, new_content, 1)

shared.write_text('''type IntermediaryJourneyStepProps = {\n  label: string;\n  completed: boolean;\n  active: boolean;\n  index: number;\n};\n\nexport function IntermediaryJourneyStep({ label, completed, active, index }: IntermediaryJourneyStepProps) {\n  return (\n    <span className="relative z-[1] inline-flex min-w-0 items-center justify-center gap-1.5 px-2">\n      <span className={`whitespace-nowrap text-[11px] font-semibold ${completed ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</span>\n      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[8px] font-bold leading-none transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-transparent text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span>\n    </span>\n  );\n}\n''')

review.write_text(review_text)
workflow.write_text(workflow_text)

assert 'bg-[#F8FAFC] px-1 text-[11px]' not in review_text
assert 'inline-flex items-center justify-center gap-2 bg-[#F8FAFC] px-2' not in workflow_text
assert 'h-[18px] w-[18px]' in shared.read_text()
