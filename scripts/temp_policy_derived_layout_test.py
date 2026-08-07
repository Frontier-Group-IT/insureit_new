from pathlib import Path
import re

path = Path('apps/web-portal/components/policy-form-authbridge.tsx')
text = path.read_text(encoding='utf-8')
original = text


def sub(pattern: str, replacement: str, name: str, count: int = 1):
    global text
    text, n = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if n != count:
        raise SystemExit(f'{name}: expected {count} replacement(s), got {n}')

# 1. Remove standalone Month control. It will be grouped with intermediary code.
sub(
    r'<ReadOnly label="Month" value=\{form\.issuanceDate\?.*?:"Auto"\}/>',
    '',
    'month read-only',
)

# 2. Replace the read-only-looking intermediary code field with a grouped derived strip.
sub(
    r'<Field label="Intermediary code" value=\{form\.intermediaryCode\} onChange=\{e=>update\("intermediaryCode",e\.target\.value\.toUpperCase\(\)\)\} placeholder="[^"]*"\s*/>',
    '''<SourceDerivedStrip
          month={form.issuanceDate ? new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Auto"}
          code={form.intermediaryCode}
          onCodeChange={(value) => update("intermediaryCode", value.toUpperCase())}
        />''',
    'source derived strip',
)

# 3. Vehicle class description becomes derived metadata, not an input-style control.
sub(
    r'<ReadOnly label="Vehicle class description" value=\{vehicleMeta\?\.description\|\|"Auto from class"\}/>',
    '<DerivedDisplay label="Vehicle classification" value={vehicleMeta?.description || "Auto from class"} source="Auto" />',
    'vehicle classification',
)

# 4. Net/GST/Gross become one premium calculation band.
sub(
    r'<ReadOnly label="Net premium" value=\{money\.format\(calculations\.net\)\} strong/><ReadOnly label="GST" value=\{money\.format\(calculations\.gst\)\} strong/><ReadOnly label="Gross premium" value=\{money\.format\(calculations\.gross\)\} strong accent/>',
    '''<PremiumCalculationBand
          net={calculations.net}
          gst={calculations.gst}
          gross={calculations.gross}
          gstRule={form.vehicleClass === "GCV" ? "18% OD + CPA · 5% TP" : "18% on Net"}
        />''',
    'premium calculation band',
)

# 5. Projected insurer amounts become compact outcomes beside editable percentage fields.
sub(
    r'<ReadOnly label="Projected OD pay-in" value=\{money\.format\(calculations\.projectedOd\)\} strong/>',
    '<CalculatedOutcome label="Projected OD amount" value={money.format(calculations.projectedOd)} />',
    'projected od outcome',
)
sub(
    r'<ReadOnly label="Projected TP pay-in" value=\{money\.format\(calculations\.projectedTp\)\} strong/>',
    '<CalculatedOutcome label="Projected TP amount" value={money.format(calculations.projectedTp)} />',
    'projected tp outcome',
)

# 6. Total pay-in/TDS/after-TDS become one related financial result strip.
sub(
    r'<ReadOnly label="Total projected pay-in" value=\{money\.format\(calculations\.totalPayin\)\} strong accent/><ReadOnly label="TDS on pay-in" value=\{money\.format\(calculations\.tds\)\}/><ReadOnly label="Pay-in after TDS" value=\{money\.format\(calculations\.payinAfterTds\)\} strong/>',
    '''<PayinCalculationBand
          total={calculations.totalPayin}
          tds={calculations.tds}
          afterTds={calculations.payinAfterTds}
        />''',
    'payin calculation band',
)

# 7. Gross payout is a calculated outcome, not an input-like field.
sub(
    r'<ReadOnly label="Gross payout" value=\{money\.format\(calculations\.grossPayout\)\} strong accent\s*/>',
    '<CalculatedOutcome label="Gross partner payout" value={money.format(calculations.grossPayout)} accent />',
    'gross payout outcome',
)

helpers = r'''
function DerivedDisplay({ label, value, source }: { label: string; value: string; source?: string }) {
  return <div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3">
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">{label}</span>
      {source ? <span className="rounded-full bg-[#EDF7F2] px-1.5 py-0.5 text-[7px] font-bold text-[#18794E]">{source}</span> : null}
    </div>
    <div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{value || "—"}</div>
  </div>;
}

function SourceDerivedStrip({ month, code, onCodeChange }: { month: string; code: string; onCodeChange: (value: string) => void }) {
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

function PremiumCalculationBand({ net, gst, gross, gstRule }: { net: number; gst: number; gross: number; gstRule: string }) {
  return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[linear-gradient(90deg,#F8FBFF,#F4F8FD)]">
    <div className="grid grid-cols-3 divide-x divide-[#DFE7F1]">
      <CalculationMetric label="Net premium" value={money.format(net)} />
      <CalculationMetric label="GST" value={money.format(gst)} note={gstRule} />
      <CalculationMetric label="Gross premium" value={money.format(gross)} accent />
    </div>
  </div>;
}

function PayinCalculationBand({ total, tds, afterTds }: { total: number; tds: number; afterTds: number }) {
  return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]">
    <div className="grid grid-cols-3 divide-x divide-[#DFE7F1]">
      <CalculationMetric label="Total projected pay-in" value={money.format(total)} />
      <CalculationMetric label="TDS" value={money.format(tds)} note="10%" />
      <CalculationMetric label="Pay-in after TDS" value={money.format(afterTds)} accent />
    </div>
  </div>;
}

function CalculationMetric({ label, value, note, accent = false }: { label: string; value: string; note?: string; accent?: boolean }) {
  return <div className={`px-3 py-2.5 ${accent ? "bg-[#EEF4FF]" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</span>
      {note ? <span className="text-[7px] font-semibold text-[#98A2B3]">{note}</span> : null}
    </div>
    <div className={`mt-1 text-[12px] font-bold ${accent ? "text-[#4F46E5]" : "text-[#17365D]"}`}>{value}</div>
  </div>;
}

function CalculatedOutcome({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex min-h-10 items-center justify-between gap-3 border-b border-dashed border-[#D9E2F0] px-1 py-1">
    <div>
      <div className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</div>
      <div className="mt-0.5 text-[7px] font-medium text-[#98A2B3]">Calculated</div>
    </div>
    <div className={`text-[11px] font-bold ${accent ? "text-[#4F46E5]" : "text-[#17365D]"}`}>{value}</div>
  </div>;
}

'''
marker = 'function LiveSummary('
if 'function PremiumCalculationBand(' not in text:
    if marker not in text:
        raise SystemExit('helper insertion marker not found')
    text = text.replace(marker, helpers + marker, 1)

if text == original:
    raise SystemExit('No changes made')

# Safety assertions: editable source inputs and core actions remain present.
required = [
    'label="RM name"',
    'label="Lead source"',
    'label="Policy product"',
    'label="OD premium"',
    'label="Projected OD pay-in %"',
    'label="Payout OD %"',
    'Book Active Policy',
    'onboardPolicy(payload)',
]
for token in required:
    if token not in text:
        raise SystemExit(f'Safety assertion failed: {token}')

path.write_text(text, encoding='utf-8')
