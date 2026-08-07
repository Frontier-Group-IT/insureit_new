from pathlib import Path

path = Path('apps/web-portal/components/policy-form-authbridge.tsx')
text = path.read_text(encoding='utf-8')

old_section = '''      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Manual + master selections">
        <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required />

        <Select label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} options={["Pramod","Parsottam","Krishan Kumar","Megha","Jayesh","Jatin"]} placeholder="Select RM" required />
        <Select label="Intermediary type" value={form.intermediaryType} onChange={e=>update("intermediaryType",e.target.value)} options={["POSP","MISP","SIBL / Partner"]} placeholder="Select type" required />
        <Field label="Lead source" value={form.leadSource} onChange={e=>update("leadSource",e.target.value)} placeholder="Search person / channel" />
        <SourceDerivedStrip
          month={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto"}
          code={form.intermediaryCode}
          onCodeChange={(value) => update("intermediaryCode", value.toUpperCase())}
        />
        <Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select policy type" />
      </Section>'''

new_section = '''      <Section number="01" title="Policy source & ownership" subtitle="Who brought the business and how the policy should be classified." badge="Master linked">
        <div>
          <Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required />
          <CompactSourceMeta label="Month" value={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto"} source="Auto" />
        </div>
        <div>
          <Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={["Motor"]} placeholder="Select policy type" required />
        </div>
        <div>
          <Select label="Intermediary type" value={form.intermediaryType} onChange={e=>update("intermediaryType",e.target.value)} options={["POSP","MISP","SIBL / Partner"]} placeholder="Select type" required />
          <CompactSourceMeta label="RM" value={form.rmName || "Select lead source"} source={form.rmName ? "Assigned" : undefined} />
          <div className="hidden" aria-hidden="true">
            <Select label="RM name" value={form.rmName} onChange={e=>update("rmName",e.target.value)} options={[]} placeholder="RM not assigned" />
          </div>
        </div>
        <div>
          <Field label="Lead source" value={form.leadSource} onChange={e=>update("leadSource",e.target.value)} placeholder={form.intermediaryType ? "Start typing a name" : "Select intermediary type first"} disabled={!form.intermediaryType} required />
          <CompactSourceMeta
            label="Intermediary code"
            value={form.intermediaryCode || "Select lead source"}
            source={form.intermediaryCode ? "Master" : undefined}
            hiddenValue={form.intermediaryCode}
            onHiddenChange={(value) => update("intermediaryCode", value.toUpperCase())}
          />
        </div>
      </Section>'''

if old_section not in text:
    raise SystemExit('Section 01 source block not found')
text = text.replace(old_section, new_section, 1)

old_helper = '''function SourceDerivedStrip({ month, code, onCodeChange }: { month: string; code: string; onCodeChange: (value: string) => void }) {
  return <div className="md:col-span-2 xl:col-span-2 grid grid-cols-2 gap-5 border-t border-dashed border-[#D9E2F0] pt-2.5">
    <DerivedDisplay label="Month" value={month} source="Auto" />
    <div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3">
      <label className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">
        Intermediary code
        <span className="rounded-full bg-[#EEF3FF] px-1.5 py-0.5 text-[7px] font-bold text-[#315B9A]">Master</span>
      </label>
      <input
        className="sr-only"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        readOnly={false}
        tabIndex={-1}
        aria-label="Intermediary code"
      />
      <div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{code || "Select a lead source"}</div>
    </div>
  </div>;
}
'''

new_helper = '''function CompactSourceMeta({ label, value, source, hiddenValue, onHiddenChange }: { label: string; value: string; source?: string; hiddenValue?: string; onHiddenChange?: (value: string) => void }) {
  return <div className="mt-1.5 min-h-[15px] px-0.5 leading-none">
    <label className="flex min-w-0 items-center gap-1.5 text-[7.5px] font-semibold tracking-[.02em] text-[#7A8CA5]">
      <span className="shrink-0">{label}</span>
      {source ? <span className="text-[6.5px] font-bold uppercase tracking-[.08em] text-[#4F8C7A]">{source}</span> : null}
      {onHiddenChange ? <input className="sr-only" value={hiddenValue ?? ""} onChange={(event) => onHiddenChange(event.target.value)} tabIndex={-1} aria-label={label} /> : null}
      <span className={`min-w-0 truncate text-[8.5px] font-semibold ${value && value !== "Select lead source" ? "text-[#526A87]" : "text-[#A0AAB8]"}`}>· {value}</span>
    </label>
  </div>;
}
'''

if old_helper not in text:
    raise SystemExit('SourceDerivedStrip helper not found')
text = text.replace(old_helper, new_helper, 1)

required = [
    'label="Policy issuance date"',
    'label="Policy type"',
    'label="Intermediary type"',
    'label="Lead source"',
    'label="RM name"',
    'label="Intermediary code"',
    'onboardPolicy(payload)',
    'Book Active Policy',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Missing required token after patch: {token}')

path.write_text(text, encoding='utf-8')
