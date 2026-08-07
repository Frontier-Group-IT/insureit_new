from pathlib import Path

path = Path("apps/web-portal/app/intermediaries/applications/[id]/page.tsx")
text = path.read_text()

old = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
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
}
'''

new = '''function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
  const detailedStatus = journey.length === 6;
  return (
    <section className="overflow-x-auto bg-transparent px-0 py-1">
      <h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2>
      <div className={`relative grid gap-0 ${detailedStatus ? "min-w-[900px] sm:grid-cols-6 before:top-[17px]" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:top-[21px]"} before:absolute before:left-[8.333%] before:right-[8.333%] before:h-px before:bg-[#D6DEE9] before:content-['']`}>
        {journey.map((item, index) => <Journey key={item.label} {...item} index={index} detailedStatus={detailedStatus} />)}
      </div>
    </section>
  );
}
function Journey({ label, done, active, index, detailedStatus }: JourneyItem & { index: number; detailedStatus: boolean }) {
  if (detailedStatus) {
    return (
      <div className="relative z-[1] flex min-w-0 items-center justify-center gap-2 px-2">
        <p className={`whitespace-nowrap bg-[#F8FAFC] px-1 text-[11px] font-semibold ${done ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</p>
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[11px] font-bold shadow-[0_0_0_6px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#94A3B8]"}`}>{done ? "✓" : index + 1}</div>
      </div>
    );
  }
  return (
    <div className="relative z-[1] min-w-0 text-center">
      <div className={`mx-auto grid h-11 w-11 place-items-center rounded-full border text-[12px] font-bold shadow-[0_0_0_7px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{done ? "✓" : index + 1}</div>
      <p className={`mt-2 text-[11px] font-semibold ${done ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</p>
    </div>
  );
}
'''

if text.count(old) != 1:
    raise SystemExit("Expected exactly one JourneyCard/Journey block")

text = text.replace(old, new, 1)

assert 'const status = done ? "Completed"' not in text
assert '>Completed<' not in text
assert 'min-w-[900px]' in text
assert 'flex min-w-0 items-center justify-center gap-2' in text
path.write_text(text)
