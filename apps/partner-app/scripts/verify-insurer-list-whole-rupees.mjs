import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../lib/format.ts', import.meta.url), 'utf8');

// The display formatter is local to this screen: the shared formatter keeps
// precise paise where needed by other workflows.
assert.ok(screen.includes("const wholeRupeeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });"));
assert.ok(screen.includes("return `₹${wholeRupeeFormatter.format(amount)}`;"));
assert.ok(!screen.includes('formatIndianCurrency'));
assert.ok(shared.includes('hasPaise ? 2 : 0'));

for (const field of ['premium', 'payin', 'retention', 'payout']) {
  assert.ok(screen.includes(`formatInsurerRupees(insurer.${field})`), `${field} must display whole rupees`);
}
assert.ok(screen.includes("insurer.payin == null ? '—'"));
assert.ok(screen.includes("insurer.retention == null ? '—'"));
assert.ok(screen.includes("insurer.payout == null ? '—'"));
assert.ok(screen.includes('numberOfLines={1}>{insurer.policies}</Text>'));
assert.equal((screen.match(/numberOfLines={1}>/g) ?? []).length, 5, 'All count and money cells must render on one line.');
assert.ok(screen.includes('const METRIC_WIDTH = 125;'));
assert.ok(screen.includes('getPartnerInsurerRegister(from, to)'));
assert.ok(screen.includes("context?.identity.actor_kind === 'employee'"), 'Employee/non-employee visibility stays scoped.');

const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
for (const [value, expected] of [
  [592992, '₹5,92,992'],
  [427895.28, '₹4,27,895'],
  [153273.96, '₹1,53,274'],
  [8320.85, '₹8,321'],
  [23.71, '₹24'],
  [0.53, '₹1'],
  [0, '₹0'],
]) {
  assert.equal('₹' + formatter.format(value), expected);
}
console.log('Partner Insurer List whole-rupee presentation regression passed.');
