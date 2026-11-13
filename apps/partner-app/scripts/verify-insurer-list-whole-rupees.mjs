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
assert.ok(screen.includes("const exactAmount = amount == null ? '—' : formatInsurerRupees(amount)"), 'Missing amounts render unavailable, not zero');
assert.ok(screen.includes("amount == null ? '—' : formatInsurerCompactRupees(amount)"), 'Compact display must preserve missing-value fallback');
assert.ok(screen.includes('>{insurer.policies}</Text>'), 'Policies remains a separate always-visible numeric cell');
assert.ok(screen.includes('adjustsFontSizeToFit minimumFontScale={0.7}'), 'Compact amount cells must fit on narrow devices');
assert.ok(screen.includes('onPress={() => Alert.alert('), 'Tapping a compact amount must show the original full rupee value');
assert.ok(screen.includes('accessibilityLabel={`${insurer.name}, ${column.label}, ${exactAmount}. Tap for full amount`}'), 'Exact rupees must remain available to accessibility users');
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
assert.ok(screen.includes("label: 'Pay-In'") && screen.includes("label: 'Retention'"), 'Employee commercial columns retained');
assert.ok(!screen.includes("label: 'Amount'") && !screen.includes("key: 'amounts'"), 'Do not duplicate Net Premium as Amount');
assert.ok(screen.includes("label: 'Net Premium'"), 'Preserve Net Premium as the single premium field');
assert.ok(screen.includes("label: 'Payout'"), 'Non-employee payout column retained');
assert.ok(!screen.includes('showsHorizontalScrollIndicator'), 'All permitted columns should be on screen, not horizontally scrolled');
assert.ok(!screen.includes('<ScrollView horizontal'), 'Remove nested horizontal financial scroller');
assert.ok(screen.includes("fixedNames: { width: '31%'"), 'Insurer names get responsive width');
assert.ok(screen.includes("financialColumns: { flex: 1, minWidth: 0 }"), 'Remaining permitted financial columns fill the row');
assert.ok(screen.includes("policyColumn: { width: '17%' }"), 'Policies column stays narrower than financial amounts');
assert.ok(screen.includes("amountColumn: { flex: 1, minWidth: 0 }"), 'Each authorized money column shares remaining width');
assert.ok(screen.includes('const ROW_HEIGHT = 46'), 'Rows use compact, aligned height');
assert.ok(screen.includes('function formatInsurerCompactRupees(amount: number | string): string'), 'Compact formatting is limited to the insurer table');
for (const suffix of ["'Cr'", "'L'", "'k'"]) assert.ok(screen.includes(suffix), `Missing compact rupee suffix ${suffix}`);


const sessionSource = readFileSync(new URL('../lib/partner-session.ts', import.meta.url), 'utf8');
const providerSource = readFileSync(new URL('../providers/partner-session-provider.tsx', import.meta.url), 'utf8');
const permissionEndpoint = readFileSync(new URL('../../web-portal/app/api/partner/effective-permissions/route.ts', import.meta.url), 'utf8');
const commercialAccess = readFileSync(new URL('../../web-portal/lib/policy-commercial-access.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../supabase/migrations/20261111173000_partner_insurer_register_commercial_authorization.sql', import.meta.url), 'utf8');
assert.ok(screen.includes("const canViewCommercials = employee && context?.can_view_insurer_commercials === true"), 'Fail closed on commercial permission');
assert.ok(screen.includes("...(canViewCommercials ? [{ key: 'payin' as const") && screen.includes("{ key: 'retention' as const"), 'Commercial columns require permission');
assert.ok(screen.includes("if (sortKey === 'payin_desc' && canViewCommercials)") && screen.includes("if (sortKey === 'retention_desc' && canViewCommercials)"), 'Commercial sorts require permission');
assert.ok(screen.includes("{ key: 'payout', label: 'Payout' }"), 'Partner payout remains available');
assert.ok(sessionSource.includes("can_view_insurer_commercials: identity.actor_kind === 'employee' && access.can_view_insurer_commercials === true"), 'Commercial grant is authenticated and fail-closed');
assert.ok(providerSource.includes("can_view_insurer_commercials: false"), 'Session refresh failure removes commercial permission');
assert.ok(permissionEndpoint.includes('canAccessPolicyCommercials(profile)'), 'API uses existing Operations commercial guard');
assert.ok(permissionEndpoint.includes('can_view_insurer_commercials: false'), 'Intermediaries cannot receive employee commercial grant');
assert.ok(migration.includes("where p.id = auth.uid() and v_actor = 'employee'"), 'RPC checks calling employee identity');
assert.ok(migration.includes("v_actor='employee' and v_commercial_allowed"), 'RPC redacts Pay-In and Retention for unauthorized employees');
assert.ok(migration.includes("when v_actor='intermediary'"), 'Existing partner payout computation remains scoped');
const configuredIds = [...commercialAccess.matchAll(/"([0-9a-f-]{36})"/g)].map((match) => match[1]).sort();
const migrationIds = [...migration.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map((match) => match[1]).sort();
assert.deepEqual(migrationIds, configuredIds, 'Database and Operations commercial allowlists must stay in sync');

const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
for (const [value, expected] of [
  [592992, '₹5,92,992'], [427895.28, '₹4,27,895'], [153273.96, '₹1,53,274'],
  [8320.85, '₹8,321'], [23.71, '₹24'], [0.53, '₹1'], [0, '₹0'],
]) {
  assert.equal('₹' + formatter.format(value), expected);
}
console.log('Partner insurer performance date range, register and whole-rupee regressions passed.');
