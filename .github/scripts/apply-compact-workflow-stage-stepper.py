from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx')
text = path.read_text()
old = '''      <div className="relative grid min-w-[760px] grid-cols-6 gap-0 before:absolute before:left-[8.4%] before:right-[8.4%] before:top-[18px] before:h-px before:bg-[#CBD5E1] before:content-['']">
        {steps.map(([stage, label], index) => {
          const completed = completion[stage];
          const active = stage === viewStage && !completed;
          const available = unlocked.has(stage);
          const content = <><span className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-[11px] font-bold shadow-[0_0_0_7px_#F8FAFC] transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#071D49] bg-[#071D49] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span><span className={`mt-2 block truncate text-[10.5px] font-semibold ${active ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-[#64748B]"}`}>{label}</span><span className="mt-0.5 block text-[8.5px] font-medium text-[#64748B]">{completed ? "Completed" : active ? "Current" : "Upcoming"}</span></>;
          return available ? <Link key={stage} href={`/intermediaries/applications/${applicationId}/workflow?stage=${stage}`} className="relative z-[1] min-w-0 text-center">{content}</Link> : <div key={stage} className="relative z-[1] min-w-0 cursor-not-allowed text-center opacity-75" aria-disabled="true">{content}</div>;
        })}
      </div>'''
new = '''      <div className="relative grid min-w-[900px] grid-cols-6 gap-0 before:absolute before:left-[8.4%] before:right-[8.4%] before:top-[17px] before:h-px before:bg-[#CBD5E1] before:content-['']">
        {steps.map(([stage, label], index) => {
          const completed = completion[stage];
          const active = stage === viewStage && !completed;
          const available = unlocked.has(stage);
          const content = <span className="inline-flex items-center justify-center gap-2 bg-[#F8FAFC] px-2"><span className={`truncate text-[10.5px] font-semibold ${active ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-[#64748B]"}`}>{label}</span><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10.5px] font-bold transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#071D49] bg-[#071D49] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{completed ? "✓" : index + 1}</span></span>;
          return available ? <Link key={stage} href={`/intermediaries/applications/${applicationId}/workflow?stage=${stage}`} className="relative z-[1] min-w-0 text-center">{content}</Link> : <div key={stage} className="relative z-[1] min-w-0 cursor-not-allowed text-center opacity-75" aria-disabled="true">{content}</div>;
        })}
      </div>'''
if old not in text:
    raise SystemExit('Target six-step workflow stage renderer was not found exactly.')
text = text.replace(old, new, 1)
if 'completed ? "Completed" : active ? "Current" : "Upcoming"' in text[text.find(new):text.find(new)+4000]:
    raise SystemExit('Secondary status text still present in updated six-step renderer.')
path.write_text(text)
