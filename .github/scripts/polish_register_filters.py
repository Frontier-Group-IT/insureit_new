from pathlib import Path
import re

# POSP/MISP shared register
p = Path('apps/web-portal/app/intermediaries/structured-account-register.tsx')
s = p.read_text()

s = s.replace('export async function StructuredAccountRegister({ type, search = "" }: { type: AccountType; search?: string }) {', 'export async function StructuredAccountRegister({ type, search = "", status = "all" }: { type: AccountType; search?: string; status?: "all" | "active" | "onboarding" }) {', 1)
s = s.replace('  const title = type.toUpperCase();\n  const onboardHref = `/customers/posp-misp/new?partner_type=${type}`;\n', '  const title = type.toUpperCase();\n  const visibleRows = rows.filter((row) => {\n    if (status === "all") return true;\n    const isActive = stageFor(appMap.get(row.application_id ?? "")) === "Active";\n    return status === "active" ? isActive : !isActive;\n  });\n  const filterHref = (nextStatus: "all" | "active" | "onboarding") => {\n    const params = new URLSearchParams();\n    if (search) params.set("q", search);\n    if (nextStatus !== "all") params.set("status", nextStatus);\n    const query = params.toString();\n    return `/intermediaries/${type}${query ? `?${query}` : ""}`;\n  };\n', 1)

old_header = '''          <div className="grid items-center gap-3 border-b border-[#E7ECF3] bg-[#FAFBFD] px-4 py-2.5 lg:grid-cols-[auto_minmax(260px,1fr)_auto_auto]">\n            <h2 className="whitespace-nowrap text-[12px] font-semibold text-[#17203A]">{title} Register</h2>\n            <form method="get" className="relative min-w-0">\n              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />\n              <input name="q" defaultValue={search} placeholder={`Search ${title} name, ID, Partner ID, mobile or email`} className="h-8 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />\n            </form>\n            <Link href={onboardHref} className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-[#0F2A55] px-3.5 text-[9.5px] font-semibold text-white transition hover:bg-[#173A70]">Onboard {title}</Link>\n            <div className="flex items-center justify-end gap-3 whitespace-nowrap text-[9.5px] font-medium text-[#64748B]">\n              <span>All <strong className="ml-1 text-[#0F2A55]">{rows.length}</strong></span>\n              <span>Active <strong className="ml-1 text-emerald-700">{counts.active}</strong></span>\n              <span>Onboarding <strong className="ml-1 text-amber-700">{counts.onboarding}</strong></span>\n            </div>\n          </div>'''
new_header = '''          <div className="grid items-center gap-5 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-3.5 lg:grid-cols-[auto_minmax(280px,460px)_1fr]">\n            <h2 className="whitespace-nowrap text-[12.5px] font-semibold text-[#17203A]">{title} Register</h2>\n            <form method="get" className="relative min-w-0 max-w-[460px]">\n              {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}\n              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />\n              <input name="q" defaultValue={search} placeholder={`Search ${title} name, ID, Partner ID, mobile or email`} className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10.5px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />\n            </form>\n            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[9.5px] font-semibold">\n              <Link href={filterHref("all")} className={`rounded-lg px-2.5 py-1.5 transition ${status === "all" ? "bg-[#0F2A55] text-white" : "text-[#526178] hover:bg-white hover:text-[#0F2A55]"}`}>All <span className="ml-1">{rows.length}</span></Link>\n              <Link href={filterHref("active")} className={`rounded-lg px-2.5 py-1.5 transition ${status === "active" ? "bg-emerald-100 text-emerald-800" : "text-[#526178] hover:bg-emerald-50 hover:text-emerald-700"}`}>Active <span className="ml-1">{counts.active}</span></Link>\n              <Link href={filterHref("onboarding")} className={`rounded-lg px-2.5 py-1.5 transition ${status === "onboarding" ? "bg-amber-100 text-amber-800" : "text-[#526178] hover:bg-amber-50 hover:text-amber-700"}`}>Onboarding <span className="ml-1">{counts.onboarding}</span></Link>\n            </div>\n          </div>'''
if old_header not in s:
    raise SystemExit('POSP/MISP header block not found')
s = s.replace(old_header, new_header, 1)
s = s.replace('''          {error ? <div className="px-5 py-14 text-center text-[11px] text-red-700">The register could not be loaded.</div> : rows.length ? (''', '''          {error ? <div className="px-5 py-14 text-center text-[11px] text-red-700">The register could not be loaded.</div> : visibleRows.length ? (''', 1)
s = s.replace('''<tbody className="divide-y divide-[#E7ECF3]">{rows.map((row) => {''', '''<tbody className="divide-y divide-[#E7ECF3]">{visibleRows.map((row) => {''', 1)
s = s.replace('''<th className="px-3 py-3.5 text-right">Action</th>''', '''<th className="px-3 py-3.5 pr-8 text-right">Action</th>''', 1)
s = s.replace('''<td className="px-3 py-3.5 text-right">{row.application_id ?''', '''<td className="px-3 py-3.5 pr-8 text-right">{row.application_id ?''', 1)
p.write_text(s)

# Route params for POSP/MISP
for route in ['posp', 'misp']:
    p = Path(f'apps/web-portal/app/intermediaries/{route}/page.tsx')
    s = p.read_text()
    s = s.replace('type Query = { q?: string };', 'type Query = { q?: string; status?: string };')
    if 'type Query={q?:string};' in s:
        s = s.replace('type Query={q?:string};', 'type Query={q?:string;status?:string};')
    s = s.replace(f'<StructuredAccountRegister type="{route}" search={{query.q?.trim().slice(0, 80) ?? ""}} />', f'<StructuredAccountRegister type="{route}" search={{query.q?.trim().slice(0, 80) ?? ""}} status={{query.status === "active" || query.status === "onboarding" ? query.status : "all"}} />')
    s = s.replace(f'<StructuredAccountRegister type="{route}" search={{q.q?.trim().slice(0,80)??""}}/>', f'<StructuredAccountRegister type="{route}" search={{q.q?.trim().slice(0,80)??""}} status={{q.status === "active" || q.status === "onboarding" ? q.status : "all"}}/>')
    p.write_text(s)

# Partner register
p = Path('apps/web-portal/app/intermediaries/intermediary-register.tsx')
s = p.read_text()
s = s.replace('if (accountStatus) request = request.eq("account_status", accountStatus);', 'if (accountStatus && selectedType !== "partner") request = request.eq("account_status", accountStatus);', 1)
needle = '  if (registrationStatus) rows = rows.filter((row) => applicationMap.get(row.application_id as string)?.registration_status === registrationStatus);\n'
insert = needle + '  const partnerCountRows = selectedType === "partner" ? [...rows] : [];\n  if (selectedType === "partner" && accountStatus) {\n    rows = rows.filter((row) => {\n      const active = applicationMap.get(row.application_id as string)?.partner_status === "active_partner";\n      return accountStatus === "active" ? active : accountStatus === "onboarding" ? !active : true;\n    });\n  }\n'
if needle not in s:
    raise SystemExit('Partner filter insertion point missing')
s = s.replace(needle, insert, 1)
s = s.replace('''  const partnerCounts = selectedType === "partner"\n    ? rows.reduce((acc, row) => {''', '''  const partnerCounts = selectedType === "partner"\n    ? partnerCountRows.reduce((acc, row) => {''', 1)

old_header_pattern = re.compile(r'''          <div className="grid items-center gap-3 border-b border-\[#E7ECF3\] bg-\[#FAFBFD\] px-4 py-2\.5 lg:grid-cols-\[auto_minmax\(260px,1fr\)_auto_auto\]">.*?          </div>''', re.S)
m = old_header_pattern.search(s)
if not m:
    raise SystemExit('Partner header block not found')
new_partner_header = '''          <div className="grid items-center gap-5 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-3.5 lg:grid-cols-[auto_minmax(280px,460px)_1fr]">\n            <h2 className="whitespace-nowrap text-[12.5px] font-semibold text-[#17203A]">{selectedType === "partner" ? "Partner Register" : "Intermediary Register"}</h2>\n            <form method="get" action={searchAction} className="relative min-w-0 max-w-[460px]">\n              {accountStatus ? <input type="hidden" name="account_status" value={accountStatus} /> : null}\n              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />\n              <input name="q" defaultValue={search} placeholder="Search name, mobile, email or ID" className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10.5px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />\n            </form>\n            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap text-[9.5px] font-semibold">\n              <Link href={registerFilterHref(searchAction, search, "")} className={`rounded-lg px-2.5 py-1.5 transition ${!accountStatus ? "bg-[#0F2A55] text-white" : "text-[#526178] hover:bg-white hover:text-[#0F2A55]"}`}>All <span className="ml-1">{partnerCountRows.length}</span></Link>\n              <Link href={registerFilterHref(searchAction, search, "active")} className={`rounded-lg px-2.5 py-1.5 transition ${accountStatus === "active" ? "bg-emerald-100 text-emerald-800" : "text-[#526178] hover:bg-emerald-50 hover:text-emerald-700"}`}>Active <span className="ml-1">{partnerCounts.active}</span></Link>\n              <Link href={registerFilterHref(searchAction, search, "onboarding")} className={`rounded-lg px-2.5 py-1.5 transition ${accountStatus === "onboarding" ? "bg-amber-100 text-amber-800" : "text-[#526178] hover:bg-amber-50 hover:text-amber-700"}`}>Onboarding <span className="ml-1">{partnerCounts.onboarding}</span></Link>\n            </div>\n          </div>'''
s = s[:m.start()] + new_partner_header + s[m.end():]

s = s.replace('''<th className="px-3 py-3 text-right">Action</th>''', '''<th className="px-3 py-3 pr-8 text-right">Action</th>''', 1)
s = s.replace('''<td className="px-3 py-3 text-right">{action}</td>''', '''<td className="px-3 py-3 pr-8 text-right">{action}</td>''', 1)
s = s.replace('''<Status value={linked ? linkedAccountLabel(linkedType, linked.registration_status) : "Not created"} />''', '''<Status value={linked ? linkedAccountLabel(linkedType, linked.registration_status) : "Not created"} tone="linked" />''', 1)
s = s.replace('''<Status value={portalAccessLabel(row.portal_access_status)} />''', '''<Status value={portalAccessLabel(row.portal_access_status)} tone="portal" />''', 1)
s = s.replace('''<Status value={partnerStatusLabel(app?.partner_status ?? row.account_status)} />''', '''<Status value={partnerStatusLabel(app?.partner_status ?? row.account_status)} tone="account" />''', 1)

# Replace compact Status helper with tone-aware colors.
status_re = re.compile(r'function Status\(\{ value \}: \{ value: string \}\) \{.*?\n\}', re.S)
if status_re.search(s):
    s = status_re.sub('''function Status({ value, tone = "default" }: { value: string; tone?: "default" | "linked" | "portal" | "account" }) {\n  const normalized = value.toLowerCase();\n  const cls = tone === "linked"\n    ? "border-violet-200 bg-violet-50 text-violet-700"\n    : tone === "portal"\n      ? "border-sky-200 bg-sky-50 text-sky-700"\n      : tone === "account"\n        ? normalized.includes("active") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"\n        : "border-slate-200 bg-slate-50 text-slate-700";\n  return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>;\n}''', s, count=1)
else:
    # Common one-line helper fallback
    s = re.sub(r'function Status\([^\n]+\n?', '''function Status({ value, tone = "default" }: { value: string; tone?: "default" | "linked" | "portal" | "account" }) {\n  const normalized = value.toLowerCase();\n  const cls = tone === "linked" ? "border-violet-200 bg-violet-50 text-violet-700" : tone === "portal" ? "border-sky-200 bg-sky-50 text-sky-700" : tone === "account" ? (normalized.includes("active") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700") : "border-slate-200 bg-slate-50 text-slate-700";\n  return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>;\n}\n''', s, count=1)

# Helper for clickable partner counters.
helper_anchor = 'function mobile10(value: string | null | undefined)'
helper = '''function registerFilterHref(base: string, search: string, status: string) {\n  const params = new URLSearchParams();\n  if (search) params.set("q", search);\n  if (status) params.set("account_status", status);\n  const query = params.toString();\n  return `${base}${query ? `?${query}` : ""}`;\n}\n'''
if helper_anchor in s and 'function registerFilterHref' not in s:
    s = s.replace(helper_anchor, helper + helper_anchor, 1)
p.write_text(s)
