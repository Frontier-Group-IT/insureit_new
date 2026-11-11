import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../lib/format.ts', import.meta.url), 'utf8');

assert.ok(screen.includes("const wholeRupeeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });"));
assert.ok(screen.includes('function formatInsurerRupees(amount: number | string): string'));
assert.ok(screen.includes('const numericAmount = Number(amount);'));
assert.ok(screen.includes('wholeRupeeFormatter.format(Number.isFinite(numericAmount) ? numericAmount : 0)'));
assert.ok(!screen.includes('formatIndianCurrency'));
assert.ok(shared.includes('hasPaise ? 2 : 0'));

for (const field of ['premium', 'payin', 'retention', 'payout']) {
  assert.ok(screen.includes(`return row.${field}`) || (field === 'premium' && screen.includes('return row.premium')), `Must preserve role-available money field ${field}`);
}
assert.ok(screen.includes("amount == null ? '—' : formatInsurerRupees(amount)"), 'Missing amounts render unavailable, not zero');
assert.ok(screen.includes("column.key === 'policies' ? insurer.policies"), 'Policies remains a separate always-visible column');
assert.ok(screen.includes('adjustsFontSizeToFit minimumFontScale={0.75}'), 'Display full amounts in scrolling metric cells');
assert.ok(screen.includes('getPartnerInsurerRegister(from, to)'));
assert.ok(screen.includes("context?.identity.actor_kind === 'employee'"), 'Employee/non-employee amounts remain scoped');

assert.ok(screen.includes('accessibilityLabel="Date Range"'), 'Full-width Date Range opens the inline calendar');
assert.ok(screen.includes('dateExpanded ? ('), 'Calendar is expanded beneath the date trigger');
assert.ok(screen.includes("const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from')"), 'Single calendar selects both endpoints');
assert.ok(screen.includes('calendarCells.map((day, index)'), 'A single month calendar grid is rendered');
assert.ok(screen.includes('setDraft((current) => ({ ...current, [pickerTarget]: selected }))'), 'Calendar updates the selected endpoint');
assert.ok(screen.includes('disabled={!validDraft}'), 'Invalid date ranges cannot be applied');
assert.ok(screen.includes('getPartnerInsurerRegister(from, to)'), 'Range remains connected to scoped report fetch');
assert.ok(!screen.includes('DateTimePicker'), 'Avoid clipped native inline calendar');
assert.ok(!screen.includes('dateModalOpen'), 'Date range is inline, not modal');
assert.ok(!screen.includes('accessibilityLabel="Financial filters, Date Range and Sort"'), 'Financial filter row removed');
assert.ok(!screen.includes('accessibilityLabel="Sort insurer register"'), 'Sort filter removed');
assert.ok(screen.includes("label: 'Pay-In'") && screen.includes("label: 'Retention'"), 'Employee columns retained');
assert.ok(screen.includes("label: 'Payout'"), 'Non-employee payout column retained');
assert.ok(screen.includes('showsHorizontalScrollIndicator'), 'Wide register preserves horizontal scrolling');

const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
for (const [value, expected] of [
  [592992, '₹5,92,992'], [427895.28, '₹4,27,895'], [153273.96, '₹1,53,274'],
  [8320.85, '₹8,321'], [23.71, '₹24'], [0.53, '₹1'], [0, '₹0'],
]) {
  assert.equal('₹' + formatter.format(value), expected);
}
console.log('Partner insurer performance date range, register and whole-rupee regressions passed.');
