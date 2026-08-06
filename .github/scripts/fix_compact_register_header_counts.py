from pathlib import Path

path = Path('apps/web-portal/app/intermediaries/structured-account-register.tsx')
text = path.read_text()

old_counts = '''        <section className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DCE5EF] bg-white p-1.5 shadow-sm">\n          <Metric label="All" value={rows.length} active />\n          <Metric label="Active" value={counts.active} />\n          <Metric label="Onboarding" value={counts.onboarding} />\n        </section>\n\n'''
if old_counts not in text:
    raise SystemExit('Standalone count section not found')
text = text.replace(old_counts, '', 1)

old_header = '''          <div className="flex items-center justify-between border-b border-[#E7ECF3] bg-[#FAFBFD] px-4 py-3">\n            <h2 className="text-[12px] font-semibold text-[#17203A]">{title} Register</h2>\n            <span className="text-[9.5px] font-medium text-[#64748B]">{rows.length} records</span>\n          </div>'''
new_header = '''          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7ECF3] bg-[#FAFBFD] px-4 py-3">\n            <h2 className="text-[12px] font-semibold text-[#17203A]">{title} Register</h2>\n            <div className="flex items-center gap-3 text-[9.5px] font-medium text-[#64748B]">\n              <span>All <strong className="ml-1 text-[#0F2A55]">{rows.length}</strong></span>\n              <span>Active <strong className="ml-1 text-emerald-700">{counts.active}</strong></span>\n              <span>Onboarding <strong className="ml-1 text-amber-700">{counts.onboarding}</strong></span>\n            </div>\n          </div>'''
if old_header not in text:
    raise SystemExit('Register header not found')
text = text.replace(old_header, new_header, 1)

text = text.replace('''              <table className="w-full min-w-[980px] table-fixed text-left text-[10.5px]">''', '''              <table className="w-full min-w-[840px] table-fixed text-left text-[10.5px]">''', 1)
text = text.replace('''                  <th className="px-3 py-3.5">Current stage</th>\n''', '', 1)
text = text.replace('''                  <th className="px-3 py-3.5">Action</th>''', '''                  <th className="px-3 py-3.5 text-right">Action</th>''', 1)
text = text.replace('''                    <td className="px-3 py-3.5"><StageBadge value={stage} /></td>\n''', '', 1)

metric_fn = '''function Metric({ label, value, active = false }: { label: string; value: number; active?: boolean }) { return <div className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[9.5px] font-semibold ${active ? "bg-[#0F2A55] text-white" : "text-[#526178]"}`}><span>{label}</span><span className={`rounded-md px-1.5 py-0.5 text-[9px] ${active ? "bg-white/15 text-white" : "bg-[#F1F4F8] text-[#0F2A55]"}`}>{value}</span></div>; }\n'''
text = text.replace(metric_fn, '', 1)

path.write_text(text)
